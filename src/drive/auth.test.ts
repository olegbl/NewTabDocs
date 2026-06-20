import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getToken, clearCachedToken } from './auth'

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
