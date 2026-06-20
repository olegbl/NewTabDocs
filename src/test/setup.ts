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
    },
  },
  identity: {
    getAuthToken: vi.fn(),
    removeCachedAuthToken: vi.fn(),
  },
}

Object.defineProperty(global, 'chrome', { value: chromeMock, writable: true })

beforeEach(() => {
  store = {}
  vi.clearAllMocks()
})
