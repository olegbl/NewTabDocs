import '@testing-library/jest-dom'
import { vi, beforeEach } from 'vitest'

// In-memory store backing the mock
let store: Record<string, unknown> = {}

const chromeMock = {
  storage: {
    local: {
      get: vi.fn((keys: string | string[] | null) =>
        Promise.resolve(
          keys === null
            ? { ...store }
            : Array.isArray(keys)
              ? Object.fromEntries(keys.map(k => [k, store[k]]))
              : { [keys as string]: store[keys as string] }
        )
      ),
      set: vi.fn((items: Record<string, unknown>) => {
        Object.assign(store, items)
        return Promise.resolve()
      }),
      remove: vi.fn((keys: string | string[]) => {
        const ks = Array.isArray(keys) ? keys : [keys]
        ks.forEach(k => { delete store[k] })
        return Promise.resolve()
      }),
    },
  },
  identity: {
    getAuthToken: vi.fn(),
    removeCachedAuthToken: vi.fn(),
    launchWebAuthFlow: vi.fn(),
    getRedirectURL: vi.fn(() => 'https://test.chromiumapp.org/'),
  },
  runtime: {
    getManifest: vi.fn(() => ({ oauth2: { client_id: 'test-client-id' } })),
    lastError: undefined as chrome.runtime.LastError | undefined,
  },
}

Object.defineProperty(global, 'chrome', { value: chromeMock, writable: true })

beforeEach(() => {
  store = {}
  vi.clearAllMocks()
})
