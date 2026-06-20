import { describe, it, expect, vi } from 'vitest'
import { getToken, revokeToken } from './auth'

describe('getToken', () => {
  it('resolves with token when chrome.identity succeeds', async () => {
    vi.mocked(chrome.identity.getAuthToken).mockImplementation(
      (_opts, cb) => { cb?.('fake-token'); return Promise.resolve('fake-token') }
    )
    const token = await getToken()
    expect(token).toBe('fake-token')
  })

  it('resolves with null when chrome.identity returns no token', async () => {
    vi.mocked(chrome.identity.getAuthToken).mockImplementation(
      (_opts, cb) => { cb?.(undefined); return Promise.resolve(undefined) }
    )
    const token = await getToken()
    expect(token).toBeNull()
  })
})

describe('revokeToken', () => {
  it('calls removeCachedAuthToken', async () => {
    vi.mocked(chrome.identity.removeCachedAuthToken).mockImplementation(
      (_opts, cb) => { cb?.(); return Promise.resolve() }
    )
    await revokeToken('fake-token')
    expect(chrome.identity.removeCachedAuthToken).toHaveBeenCalledWith(
      { token: 'fake-token' },
      expect.any(Function)
    )
  })
})
