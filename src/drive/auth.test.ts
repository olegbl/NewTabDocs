import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getToken, clearCachedToken, revokeActiveToken } from './auth'

const REDIRECT = 'https://test.chromiumapp.org/'
const TOKEN_REDIRECT = `${REDIRECT}#access_token=fake-token&token_type=Bearer&expires_in=3600`

beforeEach(async () => {
  // Clear in-memory and storage cache between tests
  await clearCachedToken()
})

describe('getToken', () => {
  it('resolves with token parsed from redirect URL', async () => {
    vi.mocked(chrome.identity.launchWebAuthFlow).mockImplementation(
      (_opts, cb) => { cb?.(TOKEN_REDIRECT) }
    )
    const token = await getToken()
    expect(token).toBe('fake-token')
  })

  it('returns cached token on second call without launching flow again', async () => {
    vi.mocked(chrome.identity.launchWebAuthFlow).mockImplementation(
      (_opts, cb) => { cb?.(TOKEN_REDIRECT) }
    )
    await getToken()
    await getToken()
    expect(chrome.identity.launchWebAuthFlow).toHaveBeenCalledOnce()
  })

  it('resolves with null when no redirect URL returned', async () => {
    vi.mocked(chrome.identity.launchWebAuthFlow).mockImplementation(
      (_opts, cb) => { cb?.(undefined) }
    )
    const token = await getToken()
    expect(token).toBeNull()
  })

  it('passes interactive:false for non-interactive requests', async () => {
    vi.mocked(chrome.identity.launchWebAuthFlow).mockImplementation(
      (_opts, cb) => { cb?.(undefined) }
    )
    await getToken(false)
    expect(chrome.identity.launchWebAuthFlow).toHaveBeenCalledWith(
      expect.objectContaining({ interactive: false }),
      expect.any(Function)
    )
  })
})

describe('clearCachedToken', () => {
  it('forces a new flow call after clearing', async () => {
    vi.mocked(chrome.identity.launchWebAuthFlow).mockImplementation(
      (_opts, cb) => { cb?.(TOKEN_REDIRECT) }
    )
    await getToken()
    await clearCachedToken()
    await getToken()
    expect(chrome.identity.launchWebAuthFlow).toHaveBeenCalledTimes(2)
  })
})

describe('revokeActiveToken', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('revokes the active token at Google and clears the cache', async () => {
    const fetchMock = vi.fn((..._args: unknown[]) => Promise.resolve({ ok: true } as Response))
    vi.stubGlobal('fetch', fetchMock)
    vi.mocked(chrome.identity.launchWebAuthFlow).mockImplementation(
      (_opts, cb) => { cb?.(TOKEN_REDIRECT) }
    )
    await getToken()

    await revokeActiveToken()

    expect(fetchMock).toHaveBeenCalledOnce()
    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain('oauth2.googleapis.com/revoke')
    expect(url).toContain('fake-token')

    // Cache was cleared, so the next getToken launches the flow again.
    await getToken()
    expect(chrome.identity.launchWebAuthFlow).toHaveBeenCalledTimes(2)
  })

  it('does not call the network when there is no active token', async () => {
    const fetchMock = vi.fn((..._args: unknown[]) => Promise.resolve({ ok: true } as Response))
    vi.stubGlobal('fetch', fetchMock)

    await revokeActiveToken()

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
