import { describe, it, expect, vi } from 'vitest'
import { getToken } from './auth'

const REDIRECT = 'https://test.chromiumapp.org/'
const TOKEN_REDIRECT = `${REDIRECT}#access_token=fake-token&token_type=Bearer&expires_in=3600`

describe('getToken', () => {
  it('resolves with token parsed from redirect URL', async () => {
    vi.mocked(chrome.identity.launchWebAuthFlow).mockImplementation(
      (_opts, cb) => { cb?.(TOKEN_REDIRECT) }
    )
    const token = await getToken()
    expect(token).toBe('fake-token')
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
