import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getToken, invalidateAccessToken, revokeActiveToken, clearStoredTokens } from './auth'

const REDIRECT = 'https://test.chromiumapp.org/'
const CODE_REDIRECT = `${REDIRECT}?code=auth-code-123`
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke'

type ResponseLike = Partial<Response>

function tokenResponse(body: Record<string, unknown>): ResponseLike {
  return { ok: true, json: () => Promise.resolve(body), text: () => Promise.resolve('') }
}

function errorResponse(status: number): ResponseLike {
  return { ok: false, status, json: () => Promise.resolve({}), text: () => Promise.resolve('error') }
}

function stubFetch(router: (url: string, init?: RequestInit) => ResponseLike) {
  const fn = vi.fn((url: string, init?: RequestInit) => Promise.resolve(router(String(url), init) as Response))
  vi.stubGlobal('fetch', fn)
  return fn
}

// Default happy-path router: code exchange and refresh both succeed.
function defaultFetch() {
  return stubFetch((url, init) => {
    const body = String(init?.body ?? '')
    if (url === TOKEN_ENDPOINT && body.includes('grant_type=authorization_code')) {
      return tokenResponse({ access_token: 'access-1', refresh_token: 'refresh-1', expires_in: 3600 })
    }
    if (url === TOKEN_ENDPOINT && body.includes('grant_type=refresh_token')) {
      return tokenResponse({ access_token: 'access-2', expires_in: 3600 })
    }
    if (url.startsWith(REVOKE_ENDPOINT)) return tokenResponse({})
    return errorResponse(404)
  })
}

function returnsCode() {
  vi.mocked(chrome.identity.launchWebAuthFlow).mockImplementation(
    (_opts, cb) => { cb?.(CODE_REDIRECT) }
  )
}

async function seedStoredAuth(auth: { accessToken: string; refreshToken: string | null; expiresAt: number }) {
  await chrome.storage.local.set({ driveAuth: auth })
}

beforeEach(async () => {
  await clearStoredTokens() // reset in-memory cache between tests
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getToken — first connect', () => {
  it('runs the auth-code flow and returns the access token', async () => {
    returnsCode()
    defaultFetch()
    const token = await getToken()
    expect(token).toBe('access-1')
  })

  it('exchanges the code via PKCE with grant_type=authorization_code', async () => {
    returnsCode()
    const fetchMock = defaultFetch()
    await getToken()
    const exchange = fetchMock.mock.calls.find(c => String(c[1]?.body).includes('grant_type=authorization_code'))
    expect(exchange).toBeDefined()
    expect(String(exchange?.[1]?.body)).toContain('code_verifier=')
  })

  it('caches the token and does not re-launch the flow on the next call', async () => {
    returnsCode()
    defaultFetch()
    await getToken()
    await getToken()
    expect(chrome.identity.launchWebAuthFlow).toHaveBeenCalledOnce()
  })

  it('returns null without prompting when non-interactive and no token exists', async () => {
    defaultFetch()
    const token = await getToken(false)
    expect(token).toBeNull()
    expect(chrome.identity.launchWebAuthFlow).not.toHaveBeenCalled()
  })
})

describe('getToken — silent refresh', () => {
  it('refreshes silently when the access token is expired', async () => {
    const fetchMock = defaultFetch()
    await seedStoredAuth({ accessToken: 'old', refreshToken: 'refresh-1', expiresAt: Date.now() - 1000 })

    const token = await getToken()

    expect(token).toBe('access-2')
    expect(chrome.identity.launchWebAuthFlow).not.toHaveBeenCalled()
    const refresh = fetchMock.mock.calls.find(c => String(c[1]?.body).includes('grant_type=refresh_token'))
    expect(String(refresh?.[1]?.body)).toContain('refresh_token=refresh-1')
  })

  it('does not refresh while the access token is still valid', async () => {
    const fetchMock = defaultFetch()
    await seedStoredAuth({ accessToken: 'still-good', refreshToken: 'refresh-1', expiresAt: Date.now() + 3_600_000 })

    const token = await getToken()

    expect(token).toBe('still-good')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('falls back to interactive auth when the refresh token is rejected', async () => {
    returnsCode()
    const fetchMock = stubFetch((_url, init) => {
      const body = String(init?.body ?? '')
      if (body.includes('grant_type=refresh_token')) return errorResponse(400)
      if (body.includes('grant_type=authorization_code')) {
        return tokenResponse({ access_token: 'access-1', refresh_token: 'refresh-2', expires_in: 3600 })
      }
      return errorResponse(404)
    })
    await seedStoredAuth({ accessToken: 'old', refreshToken: 'dead', expiresAt: Date.now() - 1000 })

    const token = await getToken(true)

    expect(token).toBe('access-1')
    expect(chrome.identity.launchWebAuthFlow).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls.some(c => String(c[1]?.body).includes('grant_type=refresh_token'))).toBe(true)
  })

  it('returns null when the refresh token is rejected and non-interactive', async () => {
    stubFetch(() => errorResponse(400))
    await seedStoredAuth({ accessToken: 'old', refreshToken: 'dead', expiresAt: Date.now() - 1000 })

    const token = await getToken(false)

    expect(token).toBeNull()
    expect(chrome.identity.launchWebAuthFlow).not.toHaveBeenCalled()
  })
})

describe('invalidateAccessToken', () => {
  it('forces a silent refresh on the next getToken', async () => {
    returnsCode()
    defaultFetch()
    await getToken() // access-1, valid

    await invalidateAccessToken()
    const token = await getToken()

    expect(token).toBe('access-2') // came from the refresh endpoint
    expect(chrome.identity.launchWebAuthFlow).toHaveBeenCalledOnce() // no new prompt
  })
})

describe('revokeActiveToken', () => {
  it('revokes the refresh token at Google and clears stored auth', async () => {
    returnsCode()
    const fetchMock = defaultFetch()
    await getToken() // establishes refresh-1

    await revokeActiveToken()

    const revoke = fetchMock.mock.calls.find(c => String(c[0]).startsWith(REVOKE_ENDPOINT))
    expect(revoke).toBeDefined()
    expect(String(revoke?.[0])).toContain('token=refresh-1')

    // Auth is cleared: a non-interactive getToken now yields null.
    expect(await getToken(false)).toBeNull()
  })

  it('does not call the network when there is no active token', async () => {
    const fetchMock = defaultFetch()
    await revokeActiveToken()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
