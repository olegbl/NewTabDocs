# New Tab Docs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome extension that replaces the new tab page with a pseudo-WYSIWYG markdown notes app with Google Drive sync and conflict resolution.

**Architecture:** React 18 + CodeMirror 6 new tab page, all data in `chrome.storage.local`, Drive sync triggered on every edit (2s debounce) via Google Drive REST API + `chrome.identity` OAuth. Conflict detection compares Drive etag against last-known version; a modal lets the user choose which version wins.

**Tech Stack:** React 18, TypeScript 5, Vite 5, Yarn, CodeMirror 6 (`@codemirror/lang-markdown`), Chrome Extension Manifest V3, Google Drive API v3.

---

## File Map

| File | Responsibility |
|---|---|
| `newtab.html` | Vite HTML entry point |
| `public/manifest.json` | Chrome extension manifest (copied to dist as-is) |
| `vite.config.ts` | Vite build + Vitest config |
| `tsconfig.json` | TypeScript config |
| `src/types.ts` | Shared interfaces: `Tab`, `SyncMeta`, `SyncStatus`, `DriveFile`, `ConflictState` |
| `src/storage.ts` | `chrome.storage.local` helpers: `loadState`, `saveState` |
| `src/utils.ts` | Pure functions: `deriveTitle`, `formatRelativeTime`, `generateId` |
| `src/main.tsx` | React mount: `createRoot().render(<App />)` |
| `src/App.tsx` | Root component; owns all state; orchestrates storage + Drive sync |
| `src/components/Sidebar.tsx` | Left panel shell (200px fixed) |
| `src/components/SyncIndicator.tsx` | Colored dot: green=synced, amber=syncing, red=error |
| `src/components/TabList.tsx` | Scrollable tab list |
| `src/components/TabItem.tsx` | Single tab row: title + relative time + hover delete button |
| `src/components/DriveStatus.tsx` | "Connected" label or "Connect Drive" button |
| `src/components/Editor.tsx` | CodeMirror 6 wrapper; pseudo-WYSIWYG markdown |
| `src/components/ConflictDialog.tsx` | Modal for choosing between local vs Drive versions |
| `src/hooks/useDriveSync.ts` | Drive sync hook: upload, conflict detection, resolution |
| `src/drive/auth.ts` | `chrome.identity.getAuthToken` wrapper |
| `src/drive/api.ts` | Drive REST API: `getFileMeta`, `downloadFile`, `uploadFile` |
| `src/test/setup.ts` | Vitest globals setup + Chrome API mocks |
| `src/utils.test.ts` | Unit tests for `utils.ts` |
| `src/storage.test.ts` | Unit tests for `storage.ts` |
| `src/drive/auth.test.ts` | Unit tests for `auth.ts` |
| `src/drive/api.test.ts` | Unit tests for `api.ts` |
| `src/hooks/useDriveSync.test.ts` | Unit tests for conflict detection logic |
| `src/components/TabItem.test.tsx` | Component test: hover delete + confirm |
| `src/components/ConflictDialog.test.tsx` | Component test: button callbacks |

---

## Task 1: Scaffold project

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `newtab.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx` (stub)

- [ ] **Step 1: Create package.json**

```json
{
  "name": "new-tab-docs",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "vite build",
    "dev": "vite build --watch",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@codemirror/commands": "^6.7.1",
    "@codemirror/lang-markdown": "^6.3.1",
    "@codemirror/language": "^6.10.8",
    "@codemirror/state": "^6.5.2",
    "@codemirror/view": "^6.36.3",
    "@lezer/highlight": "^1.2.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/chrome": "^0.0.315",
    "@types/react": "^18.3.20",
    "@types/react-dom": "^18.3.5",
    "@vitejs/plugin-react": "^4.3.4",
    "jsdom": "^26.1.0",
    "typescript": "^5.8.3",
    "vite": "^6.3.5",
    "vitest": "^3.2.3"
  }
}
```

- [ ] **Step 2: Create vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: { newtab: resolve(__dirname, 'newtab.html') },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
  },
})
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "types": ["chrome", "vite/client", "vitest/globals"]
  },
  "include": ["src", "newtab.html", "vite.config.ts"]
}
```

- [ ] **Step 4: Create newtab.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>New Tab Docs</title>
    <style>
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      html, body, #root { height: 100%; }
      body { background: #141414; color: #ccc; font-family: sans-serif; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create src/main.tsx**

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

- [ ] **Step 6: Create stub src/App.tsx**

```typescript
export default function App() {
  return <div>New Tab Docs</div>
}
```

- [ ] **Step 7: Install dependencies**

```bash
yarn install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 8: Verify build**

```bash
yarn build
```

Expected: `dist/newtab.html` and `dist/assets/newtab-*.js` created.

- [ ] **Step 9: Create public/manifest.json**

```json
{
  "manifest_version": 3,
  "name": "New Tab Docs",
  "version": "1.0.0",
  "description": "Markdown notes on every new tab, synced to Google Drive.",
  "chrome_url_overrides": { "newtab": "newtab.html" },
  "permissions": ["storage", "identity"],
  "oauth2": {
    "client_id": "YOUR_GOOGLE_CLIENT_ID",
    "scopes": ["https://www.googleapis.com/auth/drive.file"]
  }
}
```

> **Setup note:** Replace `YOUR_GOOGLE_CLIENT_ID` with a real client ID from Google Cloud Console. Add the extension's Chrome ID as an authorized origin. See: https://developer.chrome.com/docs/extensions/how-to/integrate/oauth

- [ ] **Step 10: Verify extension loads**

1. Run `yarn build`
2. Open Chrome → `chrome://extensions` → Enable Developer Mode → Load unpacked → select `dist/`
3. Open a new tab — should show "New Tab Docs" text

- [ ] **Step 11: Commit**

```bash
git add package.json vite.config.ts tsconfig.json newtab.html public/manifest.json src/main.tsx src/App.tsx
git commit -m "feat: scaffold Vite + React + TS extension project"
```

---

## Task 2: Chrome API mocks + test setup

**Files:**
- Create: `src/test/setup.ts`

- [ ] **Step 1: Create src/test/setup.ts**

```typescript
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
```

- [ ] **Step 2: Verify test setup runs**

Create a temporary file `src/test/smoke.test.ts`:
```typescript
it('chrome mock is defined', () => {
  expect(chrome.storage.local.get).toBeDefined()
})
```

Run:
```bash
yarn test
```

Expected: `1 passed`.

Delete `src/test/smoke.test.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/test/setup.ts
git commit -m "test: add Vitest setup with Chrome API mocks"
```

---

## Task 3: Shared types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Create src/types.ts**

```typescript
export interface Tab {
  id: string
  content: string
  updatedAt: number
}

export interface SyncMeta {
  lastSyncedAt: number | null
  lastSyncedDriveVersion: string | null
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'disconnected'

export interface DriveFile {
  id: string
  etag: string
  modifiedTime: string
}

export interface DriveBackup {
  tabs: Tab[]
  savedAt: number
}

export interface ConflictState {
  local: DriveBackup
  remote: DriveBackup
  remoteEtag: string
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add shared TypeScript types"
```

---

## Task 4: Utility functions (TDD)

**Files:**
- Create: `src/utils.ts`
- Create: `src/utils.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/utils.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { deriveTitle, formatRelativeTime, generateId } from './utils'

describe('deriveTitle', () => {
  it('returns first line stripped of leading # chars', () => {
    expect(deriveTitle('# Hello World\nsome content')).toBe('Hello World')
  })

  it('handles ## headings', () => {
    expect(deriveTitle('## Section\nstuff')).toBe('Section')
  })

  it('returns first line as-is when no heading prefix', () => {
    expect(deriveTitle('Plain line\nmore stuff')).toBe('Plain line')
  })

  it('skips empty lines to find first non-empty line', () => {
    expect(deriveTitle('\n\n# After blank\ncontent')).toBe('After blank')
  })

  it('returns "Untitled" when content is empty', () => {
    expect(deriveTitle('')).toBe('Untitled')
  })

  it('returns "Untitled" when content is only whitespace', () => {
    expect(deriveTitle('   \n\n  ')).toBe('Untitled')
  })
})

describe('formatRelativeTime', () => {
  it('returns "just now" for timestamps within 60 seconds', () => {
    const now = Date.now()
    expect(formatRelativeTime(now - 30_000)).toBe('just now')
  })

  it('returns minutes ago', () => {
    const now = Date.now()
    expect(formatRelativeTime(now - 5 * 60_000)).toBe('5 minutes ago')
  })

  it('returns "1 minute ago" singular', () => {
    const now = Date.now()
    expect(formatRelativeTime(now - 90_000)).toBe('1 minute ago')
  })

  it('returns hours ago', () => {
    const now = Date.now()
    expect(formatRelativeTime(now - 2 * 3600_000)).toBe('2 hours ago')
  })

  it('returns "yesterday" for ~24 hours ago', () => {
    const now = Date.now()
    expect(formatRelativeTime(now - 25 * 3600_000)).toBe('yesterday')
  })

  it('returns days ago beyond 2 days', () => {
    const now = Date.now()
    expect(formatRelativeTime(now - 3 * 86400_000)).toBe('3 days ago')
  })
})

describe('generateId', () => {
  it('returns a non-empty string', () => {
    expect(typeof generateId()).toBe('string')
    expect(generateId().length).toBeGreaterThan(0)
  })

  it('returns unique values on each call', () => {
    expect(generateId()).not.toBe(generateId())
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
yarn test src/utils.test.ts
```

Expected: fail with `Cannot find module './utils'`

- [ ] **Step 3: Implement src/utils.ts**

```typescript
export function deriveTitle(content: string): string {
  const firstLine = content.split('\n').find(line => line.trim() !== '')
  if (!firstLine) return 'Untitled'
  return firstLine.replace(/^#+\s*/, '').trim() || 'Untitled'
}

export function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

export function generateId(): string {
  return crypto.randomUUID()
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
yarn test src/utils.test.ts
```

Expected: `7 passed`

- [ ] **Step 5: Commit**

```bash
git add src/utils.ts src/utils.test.ts
git commit -m "feat: add utility functions with tests"
```

---

## Task 5: Storage helpers (TDD)

**Files:**
- Create: `src/storage.ts`
- Create: `src/storage.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/storage.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { loadState, saveState } from './storage'
import type { Tab, SyncMeta } from './types'

const tab1: Tab = { id: 'a', content: '# Hello', updatedAt: 1000 }
const tab2: Tab = { id: 'b', content: '# World', updatedAt: 2000 }

describe('loadState', () => {
  it('returns defaults when storage is empty', async () => {
    const state = await loadState()
    expect(state.tabs).toEqual([])
    expect(state.activeTabId).toBeNull()
    expect(state.syncMeta).toEqual({ lastSyncedAt: null, lastSyncedDriveVersion: null })
  })

  it('returns stored tabs', async () => {
    await chrome.storage.local.set({ tabs: [tab1, tab2] })
    const state = await loadState()
    expect(state.tabs).toEqual([tab1, tab2])
  })

  it('returns stored activeTabId', async () => {
    await chrome.storage.local.set({ activeTabId: 'a' })
    const state = await loadState()
    expect(state.activeTabId).toBe('a')
  })
})

describe('saveState', () => {
  it('writes tabs to storage', async () => {
    await saveState({ tabs: [tab1] })
    const state = await loadState()
    expect(state.tabs).toEqual([tab1])
  })

  it('writes activeTabId to storage', async () => {
    await saveState({ activeTabId: 'b' })
    const state = await loadState()
    expect(state.activeTabId).toBe('b')
  })

  it('writes syncMeta to storage', async () => {
    const syncMeta: SyncMeta = { lastSyncedAt: 9999, lastSyncedDriveVersion: 'etag-abc' }
    await saveState({ syncMeta })
    const state = await loadState()
    expect(state.syncMeta).toEqual(syncMeta)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
yarn test src/storage.test.ts
```

Expected: fail with `Cannot find module './storage'`

- [ ] **Step 3: Implement src/storage.ts**

```typescript
import type { Tab, SyncMeta } from './types'

interface AppState {
  tabs: Tab[]
  activeTabId: string | null
  syncMeta: SyncMeta
}

const DEFAULTS: AppState = {
  tabs: [],
  activeTabId: null,
  syncMeta: { lastSyncedAt: null, lastSyncedDriveVersion: null },
}

export async function loadState(): Promise<AppState> {
  const result = await chrome.storage.local.get(['tabs', 'activeTabId', 'syncMeta'])
  return {
    tabs: (result.tabs as Tab[] | undefined) ?? DEFAULTS.tabs,
    activeTabId: (result.activeTabId as string | null | undefined) ?? DEFAULTS.activeTabId,
    syncMeta: (result.syncMeta as SyncMeta | undefined) ?? DEFAULTS.syncMeta,
  }
}

export async function saveState(patch: Partial<AppState>): Promise<void> {
  await chrome.storage.local.set(patch as Record<string, unknown>)
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
yarn test src/storage.test.ts
```

Expected: `6 passed`

- [ ] **Step 5: Commit**

```bash
git add src/storage.ts src/storage.test.ts
git commit -m "feat: add chrome.storage.local helpers with tests"
```

---

## Task 6: Drive auth module (TDD)

**Files:**
- Create: `src/drive/auth.ts`
- Create: `src/drive/auth.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/drive/auth.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
yarn test src/drive/auth.test.ts
```

Expected: fail with `Cannot find module './auth'`

- [ ] **Step 3: Create src/drive/auth.ts**

```typescript
export async function getToken(): Promise<string | null> {
  return new Promise(resolve => {
    chrome.identity.getAuthToken({ interactive: true }, token => {
      resolve(token ?? null)
    })
  })
}

export async function revokeToken(token: string): Promise<void> {
  return new Promise(resolve => {
    chrome.identity.removeCachedAuthToken({ token }, resolve)
  })
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
yarn test src/drive/auth.test.ts
```

Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add src/drive/auth.ts src/drive/auth.test.ts
git commit -m "feat: add Drive auth helpers with tests"
```

---

## Task 7: Drive API module (TDD)

**Files:**
- Create: `src/drive/api.ts`
- Create: `src/drive/api.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/drive/api.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getFileMeta, downloadFile, uploadFile } from './api'
import type { DriveBackup } from '../types'

const FILE_NAME = 'newtabdocs-backup.json'
const TOKEN = 'test-token'
const FILE_ID = 'file-123'
const ETAG = '"etag-abc"'

const mockFileMeta = { id: FILE_ID, etag: ETAG, modifiedTime: '2026-01-01T00:00:00Z' }
const mockBackup: DriveBackup = { tabs: [], savedAt: 1000 }

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

describe('getFileMeta', () => {
  it('returns file meta when file exists', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [mockFileMeta] }),
      } as Response)
    const meta = await getFileMeta(TOKEN)
    expect(meta).toEqual(mockFileMeta)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(FILE_NAME),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }) })
    )
  })

  it('returns null when no file found', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ files: [] }),
    } as Response)
    const meta = await getFileMeta(TOKEN)
    expect(meta).toBeNull()
  })
})

describe('downloadFile', () => {
  it('returns parsed JSON from Drive', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockBackup,
    } as Response)
    const data = await downloadFile(TOKEN, FILE_ID)
    expect(data).toEqual(mockBackup)
  })
})

describe('uploadFile', () => {
  it('creates a new file when fileId is null', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: FILE_ID, etag: ETAG }),
    } as Response)
    const result = await uploadFile(TOKEN, null, mockBackup)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('upload/drive/v3/files'),
      expect.objectContaining({ method: 'POST' })
    )
    expect(result).toEqual({ id: FILE_ID, etag: ETAG })
  })

  it('updates existing file when fileId is provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: FILE_ID, etag: '"etag-new"' }),
    } as Response)
    const result = await uploadFile(TOKEN, FILE_ID, mockBackup)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining(FILE_ID),
      expect.objectContaining({ method: 'PATCH' })
    )
    expect(result.etag).toBe('"etag-new"')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
yarn test src/drive/api.test.ts
```

Expected: fail with `Cannot find module './api'`

- [ ] **Step 3: Create src/drive/api.ts**

```typescript
import type { DriveBackup, DriveFile } from '../types'

const FILE_NAME = 'newtabdocs-backup.json'
const BASE = 'https://www.googleapis.com'

function headers(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

export async function getFileMeta(token: string): Promise<DriveFile | null> {
  const q = encodeURIComponent(`name='${FILE_NAME}' and trashed=false`)
  const fields = 'files(id,etag,modifiedTime)'
  const res = await fetch(
    `${BASE}/drive/v3/files?q=${q}&fields=${fields}&spaces=drive`,
    { headers: headers(token) }
  )
  const data = await res.json()
  return data.files?.[0] ?? null
}

export async function downloadFile(token: string, fileId: string): Promise<DriveBackup> {
  const res = await fetch(
    `${BASE}/drive/v3/files/${fileId}?alt=media`,
    { headers: headers(token) }
  )
  return res.json()
}

export async function uploadFile(
  token: string,
  fileId: string | null,
  backup: DriveBackup
): Promise<{ id: string; etag: string }> {
  const metadata = fileId ? {} : { name: FILE_NAME, mimeType: 'application/json' }
  const body = new FormData()
  body.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  body.append('media', new Blob([JSON.stringify(backup)], { type: 'application/json' }))

  const url = fileId
    ? `${BASE}/upload/drive/v3/files/${fileId}?uploadType=multipart&fields=id,etag`
    : `${BASE}/upload/drive/v3/files?uploadType=multipart&fields=id,etag`
  const method = fileId ? 'PATCH' : 'POST'

  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    body,
  })
  return res.json()
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
yarn test src/drive/api.test.ts
```

Expected: `5 passed`

- [ ] **Step 5: Commit**

```bash
git add src/drive/api.ts src/drive/api.test.ts
git commit -m "feat: add Drive REST API helpers with tests"
```

---

## Task 8: App root with tab state

**Files:**
- Modify: `src/App.tsx`
- Create: `src/components/Sidebar.tsx` (stub)
- Create: `src/components/Editor.tsx` (stub)

- [ ] **Step 1: Replace App.tsx with full state management**

```typescript
import { useEffect, useRef, useState, useCallback } from 'react'
import type { Tab, SyncMeta, SyncStatus, ConflictState } from './types'
import { loadState, saveState } from './storage'
import { generateId } from './utils'
import Sidebar from './components/Sidebar'
import Editor from './components/Editor'
import ConflictDialog from './components/ConflictDialog'

const SAVE_DEBOUNCE_MS = 500
const SYNC_DEBOUNCE_MS = 2000

export default function App() {
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [syncMeta, setSyncMeta] = useState<SyncMeta>({ lastSyncedAt: null, lastSyncedDriveVersion: null })
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('disconnected')
  const [conflict, setConflict] = useState<ConflictState | null>(null)
  const [driveFileId, setDriveFileId] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load initial state
  useEffect(() => {
    loadState().then(state => {
      let initialTabs = state.tabs
      let initialActiveId = state.activeTabId

      if (initialTabs.length === 0) {
        const newTab: Tab = { id: generateId(), content: '# New note\n', updatedAt: Date.now() }
        initialTabs = [newTab]
        initialActiveId = newTab.id
      }

      setTabs(initialTabs)
      setActiveTabId(initialActiveId ?? initialTabs[0]?.id ?? null)
      setSyncMeta(state.syncMeta)
    })
  }, [])

  const activeTab = tabs.find(t => t.id === activeTabId) ?? null

  const handleContentChange = useCallback((content: string) => {
    const now = Date.now()
    setTabs(prev => {
      const updated = prev.map(t => t.id === activeTabId ? { ...t, content, updatedAt: now } : t)
      const sorted = [...updated].sort((a, b) => b.updatedAt - a.updatedAt)
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => saveState({ tabs: sorted }), SAVE_DEBOUNCE_MS)
      return sorted
    })
  }, [activeTabId])

  const handleNewTab = useCallback(() => {
    const tab: Tab = { id: generateId(), content: '# New note\n', updatedAt: Date.now() }
    setTabs(prev => {
      const updated = [tab, ...prev]
      saveState({ tabs: updated, activeTabId: tab.id })
      return updated
    })
    setActiveTabId(tab.id)
  }, [])

  const handleDeleteTab = useCallback((id: string) => {
    setTabs(prev => {
      const updated = prev.filter(t => t.id !== id)
      const withFallback = updated.length === 0
        ? [{ id: generateId(), content: '# New note\n', updatedAt: Date.now() }]
        : updated
      const newActiveId = id === activeTabId ? (withFallback[0]?.id ?? null) : activeTabId
      saveState({ tabs: withFallback, activeTabId: newActiveId })
      setActiveTabId(newActiveId)
      return withFallback
    })
  }, [activeTabId])

  const handleTabSelect = useCallback((id: string) => {
    setActiveTabId(id)
    saveState({ activeTabId: id })
  }, [])

  const handleConflictResolve = useCallback((winner: 'local' | 'remote') => {
    if (!conflict) return
    const winningTabs = winner === 'local' ? conflict.local.tabs : conflict.remote.tabs
    setTabs(winningTabs)
    setConflict(null)
    saveState({ tabs: winningTabs })
  }, [conflict])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar
        tabs={tabs}
        activeTabId={activeTabId}
        syncStatus={syncStatus}
        onNewTab={handleNewTab}
        onSelectTab={handleTabSelect}
        onDeleteTab={handleDeleteTab}
      />
      <Editor
        key={activeTabId ?? 'none'}
        content={activeTab?.content ?? ''}
        onChange={handleContentChange}
      />
      {conflict && (
        <ConflictDialog
          conflict={conflict}
          onResolve={handleConflictResolve}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create stub src/components/Sidebar.tsx**

```typescript
import type { Tab, SyncStatus } from '../types'

interface Props {
  tabs: Tab[]
  activeTabId: string | null
  syncStatus: SyncStatus
  onNewTab: () => void
  onSelectTab: (id: string) => void
  onDeleteTab: (id: string) => void
}

export default function Sidebar(_props: Props) {
  return <div style={{ width: 200, background: '#1a1a1a' }}>Sidebar</div>
}
```

- [ ] **Step 3: Create stub src/components/Editor.tsx**

```typescript
interface Props {
  content: string
  onChange: (content: string) => void
}

export default function Editor({ content, onChange }: Props) {
  return (
    <textarea
      style={{ flex: 1, background: '#141414', color: '#ccc', border: 'none', padding: 16 }}
      value={content}
      onChange={e => onChange(e.target.value)}
    />
  )
}
```

- [ ] **Step 4: Create stub src/components/ConflictDialog.tsx**

```typescript
import type { ConflictState } from '../types'

interface Props {
  conflict: ConflictState
  onResolve: (winner: 'local' | 'remote') => void
}

export default function ConflictDialog({ onResolve }: Props) {
  return (
    <div>
      <button onClick={() => onResolve('local')}>Keep local</button>
      <button onClick={() => onResolve('remote')}>Use Drive copy</button>
    </div>
  )
}
```

- [ ] **Step 5: Build and verify extension loads in Chrome**

```bash
yarn build
```

Open a new tab in Chrome (reload the extension first at `chrome://extensions`). Should show the app with a sidebar and a textarea editor.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/Sidebar.tsx src/components/Editor.tsx src/components/ConflictDialog.tsx
git commit -m "feat: wire up App state with stubs for all components"
```

---

## Task 9: Sidebar, TabList, TabItem components

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Create: `src/components/TabList.tsx`
- Create: `src/components/TabItem.tsx`
- Create: `src/components/SyncIndicator.tsx`
- Create: `src/components/DriveStatus.tsx`
- Create: `src/components/TabItem.test.tsx`

- [ ] **Step 1: Create src/components/SyncIndicator.tsx**

```typescript
import type { SyncStatus } from '../types'

const COLOR: Record<SyncStatus, string> = {
  idle: '#555',
  syncing: '#f0a500',
  synced: '#2ea043',
  error: '#d73a49',
  disconnected: '#555',
}

const LABEL: Record<SyncStatus, string> = {
  idle: 'Not synced',
  syncing: 'Syncing…',
  synced: 'Synced to Drive',
  error: 'Sync error',
  disconnected: 'Drive not connected',
}

interface Props { status: SyncStatus }

export default function SyncIndicator({ status }: Props) {
  return (
    <div
      title={LABEL[status]}
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: COLOR[status],
        flexShrink: 0,
      }}
    />
  )
}
```

- [ ] **Step 2: Create src/components/DriveStatus.tsx**

```typescript
interface Props {
  connected: boolean
  onConnect: () => void
  onDisconnect: () => void
}

export default function DriveStatus({ connected, onConnect, onDisconnect }: Props) {
  return (
    <div style={{ padding: '8px 10px', borderTop: '1px solid #2a2a2a' }}>
      {connected ? (
        <button
          onClick={onDisconnect}
          title="Disconnect Google Drive"
          style={{ background: 'none', border: 'none', color: '#555', fontSize: 11, cursor: 'pointer', padding: 0 }}
        >
          🔒 Drive connected
        </button>
      ) : (
        <button
          onClick={onConnect}
          style={{ background: 'none', border: '1px solid #333', color: '#888', fontSize: 11, cursor: 'pointer', padding: '3px 6px', borderRadius: 3 }}
        >
          Connect Drive
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create src/components/TabItem.tsx**

```typescript
import { useState } from 'react'
import { deriveTitle, formatRelativeTime } from '../utils'
import type { Tab } from '../types'

interface Props {
  tab: Tab
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
}

export default function TabItem({ tab, isActive, onSelect, onDelete }: Props) {
  const [hovered, setHovered] = useState(false)

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (window.confirm(`Delete "${deriveTitle(tab.content)}"?`)) {
      onDelete()
    }
  }

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '8px 10px',
        cursor: 'pointer',
        borderLeft: isActive ? '2px solid #4a9eff' : '2px solid transparent',
        background: isActive ? '#252525' : 'transparent',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        position: 'relative',
      }}
    >
      <div style={{ overflow: 'hidden' }}>
        <div style={{
          fontSize: 13,
          color: isActive ? '#e0e0e0' : '#888',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {deriveTitle(tab.content)}
        </div>
        <div style={{ fontSize: 10, color: '#444', marginTop: 2 }}>
          {formatRelativeTime(tab.updatedAt)}
        </div>
      </div>
      {hovered && (
        <button
          onClick={handleDelete}
          aria-label="Delete tab"
          style={{
            background: 'none', border: 'none', color: '#666',
            fontSize: 14, cursor: 'pointer', lineHeight: 1,
            padding: '0 0 0 4px', flexShrink: 0,
          }}
        >
          ×
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create src/components/TabList.tsx**

```typescript
import type { Tab } from '../types'
import TabItem from './TabItem'

interface Props {
  tabs: Tab[]
  activeTabId: string | null
  onSelectTab: (id: string) => void
  onDeleteTab: (id: string) => void
}

export default function TabList({ tabs, activeTabId, onSelectTab, onDeleteTab }: Props) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
      {tabs.map(tab => (
        <TabItem
          key={tab.id}
          tab={tab}
          isActive={tab.id === activeTabId}
          onSelect={() => onSelectTab(tab.id)}
          onDelete={() => onDeleteTab(tab.id)}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Replace Sidebar.tsx with full implementation**

```typescript
import type { Tab, SyncStatus } from '../types'
import SyncIndicator from './SyncIndicator'
import TabList from './TabList'
import DriveStatus from './DriveStatus'

interface Props {
  tabs: Tab[]
  activeTabId: string | null
  syncStatus: SyncStatus
  driveConnected: boolean
  onNewTab: () => void
  onSelectTab: (id: string) => void
  onDeleteTab: (id: string) => void
  onConnectDrive: () => void
  onDisconnectDrive: () => void
}

export default function Sidebar({
  tabs, activeTabId, syncStatus, driveConnected,
  onNewTab, onSelectTab, onDeleteTab, onConnectDrive, onDisconnectDrive,
}: Props) {
  return (
    <div style={{
      width: 200,
      background: '#1a1a1a',
      borderRight: '1px solid #2a2a2a',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      <div style={{
        padding: '12px 10px 8px',
        borderBottom: '1px solid #2a2a2a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#555', letterSpacing: '.08em', textTransform: 'uppercase' }}>
            Notes
          </span>
          <SyncIndicator status={syncStatus} />
        </div>
        <button
          onClick={onNewTab}
          title="New note"
          style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}
        >
          +
        </button>
      </div>

      <TabList
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={onSelectTab}
        onDeleteTab={onDeleteTab}
      />

      <DriveStatus
        connected={driveConnected}
        onConnect={onConnectDrive}
        onDisconnect={onDisconnectDrive}
      />
    </div>
  )
}
```

- [ ] **Step 6: Update App.tsx to pass new Sidebar props**

Add `driveConnected`, `onConnectDrive`, `onDisconnectDrive` to Sidebar in App.tsx. Replace the Sidebar usage:

```typescript
// Add to App state:
const [driveConnected, setDriveConnected] = useState(false)

// Add handlers:
const handleConnectDrive = useCallback(() => {
  // Implemented in Task 11
}, [])

const handleDisconnectDrive = useCallback(() => {
  setDriveConnected(false)
  setSyncStatus('disconnected')
}, [])

// Replace Sidebar usage in JSX:
<Sidebar
  tabs={tabs}
  activeTabId={activeTabId}
  syncStatus={syncStatus}
  driveConnected={driveConnected}
  onNewTab={handleNewTab}
  onSelectTab={handleTabSelect}
  onDeleteTab={handleDeleteTab}
  onConnectDrive={handleConnectDrive}
  onDisconnectDrive={handleDisconnectDrive}
/>
```

- [ ] **Step 7: Write TabItem tests**

Create `src/components/TabItem.test.tsx`:
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import TabItem from './TabItem'
import type { Tab } from '../types'

const tab: Tab = { id: '1', content: '# My Note\nsome text', updatedAt: Date.now() }

describe('TabItem', () => {
  it('renders title derived from content', () => {
    render(<TabItem tab={tab} isActive={false} onSelect={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('My Note')).toBeInTheDocument()
  })

  it('calls onSelect when clicked', async () => {
    const onSelect = vi.fn()
    render(<TabItem tab={tab} isActive={false} onSelect={onSelect} onDelete={vi.fn()} />)
    await userEvent.click(screen.getByText('My Note'))
    expect(onSelect).toHaveBeenCalledOnce()
  })

  it('shows delete button on hover', async () => {
    render(<TabItem tab={tab} isActive={false} onSelect={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
    await userEvent.hover(screen.getByText('My Note').parentElement!.parentElement!)
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
  })

  it('calls onDelete after confirm', async () => {
    const onDelete = vi.fn()
    vi.stubGlobal('confirm', vi.fn(() => true))
    render(<TabItem tab={tab} isActive={false} onSelect={vi.fn()} onDelete={onDelete} />)
    await userEvent.hover(screen.getByText('My Note').parentElement!.parentElement!)
    await userEvent.click(screen.getByRole('button', { name: /delete/i }))
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it('does not call onDelete when confirm is cancelled', async () => {
    const onDelete = vi.fn()
    vi.stubGlobal('confirm', vi.fn(() => false))
    render(<TabItem tab={tab} isActive={false} onSelect={vi.fn()} onDelete={onDelete} />)
    await userEvent.hover(screen.getByText('My Note').parentElement!.parentElement!)
    await userEvent.click(screen.getByRole('button', { name: /delete/i }))
    expect(onDelete).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 8: Run tests**

```bash
yarn test src/components/TabItem.test.tsx
```

Expected: `5 passed`

- [ ] **Step 9: Build and test in Chrome**

```bash
yarn build
```

Reload extension, open new tab. Verify: sidebar shows, new tab button works, tabs list updates, relative times show, hover reveals delete button.

- [ ] **Step 10: Commit**

```bash
git add src/components/
git commit -m "feat: implement Sidebar, TabList, TabItem, SyncIndicator, DriveStatus"
```

---

## Task 10: CodeMirror 6 editor

**Files:**
- Modify: `src/components/Editor.tsx`

- [ ] **Step 1: Replace Editor.tsx with CodeMirror 6 implementation**

```typescript
import { useEffect, useRef } from 'react'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language'
import { tags } from '@lezer/highlight'

const markdownHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontSize: '1.5em', fontWeight: '700', color: '#ffffff', lineHeight: '1.4' },
  { tag: tags.heading2, fontSize: '1.25em', fontWeight: '700', color: '#e8e8e8' },
  { tag: tags.heading3, fontSize: '1.1em', fontWeight: '700', color: '#d8d8d8' },
  { tag: tags.strong, fontWeight: '700', color: '#ffffff' },
  { tag: tags.emphasis, fontStyle: 'italic', color: '#cccccc' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: '#666666' },
  { tag: tags.monospace, fontFamily: 'monospace', color: '#b8b8ff', fontSize: '0.9em' },
  { tag: tags.link, color: '#4a9eff', textDecoration: 'underline' },
  { tag: tags.url, color: '#4a9eff' },
  // Dim syntax characters
  { tag: tags.processingInstruction, color: '#3a3a3a' },
  { tag: tags.meta, color: '#3a3a3a' },
  { tag: tags.punctuation, color: '#3d3d3d' },
])

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '14px', lineHeight: '1.7' },
  '.cm-scroller': { fontFamily: 'ui-monospace, monospace', overflow: 'auto', padding: '24px 32px' },
  '.cm-content': { caretColor: '#4a9eff', minHeight: '100%' },
  '.cm-cursor': { borderLeftColor: '#4a9eff' },
  '.cm-selectionBackground, ::selection': { background: '#264f78 !important' },
  '.cm-focused': { outline: 'none' },
  '&.cm-focused .cm-cursor': { borderLeftColor: '#4a9eff' },
}, { dark: true })

interface Props {
  content: string
  onChange: (content: string) => void
}

export default function Editor({ content, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const view = new EditorView({
      state: EditorState.create({
        doc: content,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          markdown(),
          syntaxHighlighting(markdownHighlight),
          theme,
          EditorView.lineWrapping,
          EditorView.updateListener.of(update => {
            if (update.docChanged) {
              onChange(update.state.doc.toString())
            }
          }),
        ],
      }),
      parent: containerRef.current,
    })

    viewRef.current = view
    view.focus()

    return () => view.destroy()
  }, []) // Mount once; content swapped via key prop in App

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, overflow: 'hidden', background: '#141414' }}
    />
  )
}
```

- [ ] **Step 2: Build and verify in Chrome**

```bash
yarn build
```

Reload extension, open new tab. Verify:
- Editor has syntax highlighting (# dims, heading text is large/white)
- Bold `**text**` markers are dim, text between is bold
- Tab changes switch the editor content (via `key` prop)
- Undo/redo works (Ctrl+Z / Ctrl+Shift+Z)
- Text wraps at editor boundary

- [ ] **Step 3: Commit**

```bash
git add src/components/Editor.tsx
git commit -m "feat: implement CodeMirror 6 pseudo-WYSIWYG markdown editor"
```

---

## Task 11: Drive sync hook + ConflictDialog

**Files:**
- Create: `src/hooks/useDriveSync.ts`
- Modify: `src/components/ConflictDialog.tsx`
- Modify: `src/App.tsx`
- Create: `src/hooks/useDriveSync.test.ts`
- Create: `src/components/ConflictDialog.test.tsx`

- [ ] **Step 1: Write ConflictDialog tests**

Create `src/components/ConflictDialog.test.tsx`:
```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import ConflictDialog from './ConflictDialog'
import type { ConflictState } from '../types'

const conflict: ConflictState = {
  local: { tabs: [{ id: '1', content: '# Local', updatedAt: 1000 }], savedAt: 1000 },
  remote: { tabs: [{ id: '2', content: '# Remote', updatedAt: 2000 }, { id: '3', content: '# B', updatedAt: 900 }], savedAt: 2000 },
  remoteEtag: '"etag-xyz"',
}

describe('ConflictDialog', () => {
  it('shows note counts for both versions', () => {
    render(<ConflictDialog conflict={conflict} onResolve={vi.fn()} />)
    expect(screen.getByText(/1 note/)).toBeInTheDocument()
    expect(screen.getByText(/2 notes/)).toBeInTheDocument()
  })

  it('calls onResolve with "local" when local button clicked', async () => {
    const onResolve = vi.fn()
    render(<ConflictDialog conflict={conflict} onResolve={onResolve} />)
    await userEvent.click(screen.getByRole('button', { name: /keep this device/i }))
    expect(onResolve).toHaveBeenCalledWith('local')
  })

  it('calls onResolve with "remote" when remote button clicked', async () => {
    const onResolve = vi.fn()
    render(<ConflictDialog conflict={conflict} onResolve={onResolve} />)
    await userEvent.click(screen.getByRole('button', { name: /use drive copy/i }))
    expect(onResolve).toHaveBeenCalledWith('remote')
  })
})
```

- [ ] **Step 2: Run ConflictDialog tests — verify they fail**

```bash
yarn test src/components/ConflictDialog.test.tsx
```

Expected: fail (stub doesn't have the right content)

- [ ] **Step 3: Replace ConflictDialog.tsx with full implementation**

```typescript
import type { ConflictState } from '../types'

interface Props {
  conflict: ConflictState
  onResolve: (winner: 'local' | 'remote') => void
}

function VersionCard({ label, tabCount, savedAt }: { label: string; tabCount: number; savedAt: number }) {
  const date = new Date(savedAt).toLocaleString()
  const noteLabel = tabCount === 1 ? '1 note' : `${tabCount} notes`
  return (
    <div style={{
      border: '1px solid #333', borderRadius: 6, padding: '12px 16px',
      flex: 1, textAlign: 'center', background: '#1e1e1e',
    }}>
      <div style={{ fontWeight: 600, color: '#ccc', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#888' }}>{noteLabel}</div>
      <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>{date}</div>
    </div>
  )
}

export default function ConflictDialog({ conflict, onResolve }: Props) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <div style={{
        background: '#1a1a1a', border: '1px solid #333', borderRadius: 8,
        padding: 24, width: 400, maxWidth: '90vw',
      }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#e0e0e0', marginBottom: 8 }}>
          ⚠ Sync conflict detected
        </div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>
          Both this device and another device made changes since the last sync.
        </div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          <VersionCard label="This device" tabCount={conflict.local.tabs.length} savedAt={conflict.local.savedAt} />
          <VersionCard label="Drive copy" tabCount={conflict.remote.tabs.length} savedAt={conflict.remote.savedAt} />
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            onClick={() => onResolve('local')}
            style={{
              background: '#2a2a2a', border: '1px solid #444', color: '#ccc',
              padding: '8px 16px', borderRadius: 4, cursor: 'pointer', fontSize: 13,
            }}
          >
            Keep this device
          </button>
          <button
            onClick={() => onResolve('remote')}
            style={{
              background: '#4a9eff', border: 'none', color: '#fff',
              padding: '8px 16px', borderRadius: 4, cursor: 'pointer', fontSize: 13,
            }}
          >
            Use Drive copy
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run ConflictDialog tests — verify they pass**

```bash
yarn test src/components/ConflictDialog.test.tsx
```

Expected: `3 passed`

- [ ] **Step 5: Write useDriveSync tests**

Create `src/hooks/useDriveSync.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { detectConflict } from './useDriveSync'
import type { SyncMeta, DriveBackup } from '../types'

describe('detectConflict', () => {
  const remoteBackup: DriveBackup = { tabs: [], savedAt: 2000 }
  const remoteEtag = '"etag-v2"'

  it('returns "no-change" when Drive etag matches last synced version and no local changes', () => {
    const syncMeta: SyncMeta = { lastSyncedAt: 1500, lastSyncedDriveVersion: '"etag-v2"' }
    const lastLocalChange = 1000 // before lastSyncedAt
    expect(detectConflict(syncMeta, remoteEtag, lastLocalChange)).toBe('no-change')
  })

  it('returns "pull" when Drive etag changed but no local changes since last sync', () => {
    const syncMeta: SyncMeta = { lastSyncedAt: 1500, lastSyncedDriveVersion: '"etag-v1"' }
    const lastLocalChange = 1000 // before lastSyncedAt
    expect(detectConflict(syncMeta, remoteEtag, lastLocalChange)).toBe('pull')
  })

  it('returns "push" when Drive etag unchanged and we have local changes', () => {
    const syncMeta: SyncMeta = { lastSyncedAt: 1500, lastSyncedDriveVersion: '"etag-v2"' }
    const lastLocalChange = 2000 // after lastSyncedAt
    expect(detectConflict(syncMeta, remoteEtag, lastLocalChange)).toBe('push')
  })

  it('returns "conflict" when Drive etag changed AND we have local changes', () => {
    const syncMeta: SyncMeta = { lastSyncedAt: 1500, lastSyncedDriveVersion: '"etag-v1"' }
    const lastLocalChange = 2000 // after lastSyncedAt
    expect(detectConflict(syncMeta, remoteEtag, lastLocalChange)).toBe('conflict')
  })

  it('returns "push" when never synced before', () => {
    const syncMeta: SyncMeta = { lastSyncedAt: null, lastSyncedDriveVersion: null }
    const lastLocalChange = 1000
    expect(detectConflict(syncMeta, remoteEtag, lastLocalChange)).toBe('push')
  })
})
```

- [ ] **Step 6: Run useDriveSync tests — verify they fail**

```bash
yarn test src/hooks/useDriveSync.test.ts
```

Expected: fail with `Cannot find module './useDriveSync'`

- [ ] **Step 7: Create src/hooks/useDriveSync.ts**

```typescript
import { useRef, useCallback } from 'react'
import type { Tab, SyncMeta, SyncStatus, ConflictState, DriveBackup } from '../types'
import { getToken } from '../drive/auth'
import { getFileMeta, downloadFile, uploadFile } from '../drive/api'
import { saveState } from '../storage'

export type SyncAction = 'no-change' | 'pull' | 'push' | 'conflict'

export function detectConflict(
  syncMeta: SyncMeta,
  remoteEtag: string,
  lastLocalChangeAt: number
): SyncAction {
  if (syncMeta.lastSyncedAt === null) return 'push'
  const driveChanged = remoteEtag !== syncMeta.lastSyncedDriveVersion
  const localChanged = lastLocalChangeAt > syncMeta.lastSyncedAt
  if (!driveChanged && !localChanged) return 'no-change'
  if (driveChanged && !localChanged) return 'pull'
  if (!driveChanged && localChanged) return 'push'
  return 'conflict'
}

interface UseDriveSyncOptions {
  tabs: Tab[]
  syncMeta: SyncMeta
  lastLocalChangeAt: number
  driveFileId: string | null
  setTabs: (tabs: Tab[]) => void
  setSyncMeta: (meta: SyncMeta) => void
  setSyncStatus: (status: SyncStatus) => void
  setConflict: (conflict: ConflictState | null) => void
  setDriveFileId: (id: string | null) => void
  setDriveConnected: (connected: boolean) => void
}

export function useDriveSync(opts: UseDriveSyncOptions) {
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sync = useCallback(async () => {
    let token: string | null
    try {
      token = await getToken()
    } catch {
      opts.setSyncStatus('error')
      return
    }
    if (!token) { opts.setSyncStatus('disconnected'); return }

    opts.setSyncStatus('syncing')
    try {
      const meta = await getFileMeta(token)
      const fileId = meta?.id ?? opts.driveFileId

      if (!meta) {
        // No Drive file yet — push immediately
        const result = await uploadFile(token, null, { tabs: opts.tabs, savedAt: Date.now() })
        const newMeta: SyncMeta = { lastSyncedAt: Date.now(), lastSyncedDriveVersion: result.etag }
        opts.setSyncMeta(newMeta)
        opts.setDriveFileId(result.id)
        await saveState({ syncMeta: newMeta })
        opts.setSyncStatus('synced')
        return
      }

      const action = detectConflict(opts.syncMeta, meta.etag, opts.lastLocalChangeAt)

      if (action === 'no-change') {
        opts.setSyncStatus('synced')
        return
      }

      if (action === 'pull') {
        const remote = await downloadFile(token, meta.id)
        opts.setTabs(remote.tabs)
        const newMeta: SyncMeta = { lastSyncedAt: Date.now(), lastSyncedDriveVersion: meta.etag }
        opts.setSyncMeta(newMeta)
        await saveState({ tabs: remote.tabs, syncMeta: newMeta })
        opts.setSyncStatus('synced')
        return
      }

      if (action === 'push') {
        const result = await uploadFile(token, fileId ?? null, { tabs: opts.tabs, savedAt: Date.now() })
        const newMeta: SyncMeta = { lastSyncedAt: Date.now(), lastSyncedDriveVersion: result.etag }
        opts.setSyncMeta(newMeta)
        opts.setDriveFileId(result.id)
        await saveState({ syncMeta: newMeta })
        opts.setSyncStatus('synced')
        return
      }

      // conflict
      const remote = await downloadFile(token, meta.id)
      opts.setConflict({
        local: { tabs: opts.tabs, savedAt: opts.lastLocalChangeAt },
        remote,
        remoteEtag: meta.etag,
      })
      opts.setSyncStatus('idle')
    } catch {
      opts.setSyncStatus('error')
    }
  }, [opts])

  const scheduleSyncAfterEdit = useCallback(() => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    syncTimerRef.current = setTimeout(sync, 2000)
  }, [sync])

  const connect = useCallback(async () => {
    opts.setDriveConnected(true)
    await sync()
  }, [sync, opts])

  return { scheduleSyncAfterEdit, sync, connect }
}
```

- [ ] **Step 8: Run useDriveSync tests — verify they pass**

```bash
yarn test src/hooks/useDriveSync.test.ts
```

Expected: `5 passed`

- [ ] **Step 9: Commit**

```bash
git add src/hooks/useDriveSync.ts src/hooks/useDriveSync.test.ts src/components/ConflictDialog.tsx src/components/ConflictDialog.test.tsx
git commit -m "feat: implement Drive sync hook and ConflictDialog with tests"
```

---

## Task 12: Wire Drive sync into App + conflict resolution

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace App.tsx with Drive-wired version**

```typescript
import { useEffect, useRef, useState, useCallback } from 'react'
import type { Tab, SyncMeta, SyncStatus, ConflictState } from './types'
import { loadState, saveState } from './storage'
import { generateId } from './utils'
import { useDriveSync } from './hooks/useDriveSync'
import Sidebar from './components/Sidebar'
import Editor from './components/Editor'
import ConflictDialog from './components/ConflictDialog'

const SAVE_DEBOUNCE_MS = 500

export default function App() {
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [syncMeta, setSyncMeta] = useState<SyncMeta>({ lastSyncedAt: null, lastSyncedDriveVersion: null })
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('disconnected')
  const [conflict, setConflict] = useState<ConflictState | null>(null)
  const [driveConnected, setDriveConnected] = useState(false)
  const [driveFileId, setDriveFileId] = useState<string | null>(null)
  const lastLocalChangeAtRef = useRef<number>(0)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    loadState().then(state => {
      let initialTabs = state.tabs
      let initialActiveId = state.activeTabId

      if (initialTabs.length === 0) {
        const newTab: Tab = { id: generateId(), content: '# New note\n', updatedAt: Date.now() }
        initialTabs = [newTab]
        initialActiveId = newTab.id
      }

      setTabs(initialTabs)
      setActiveTabId(initialActiveId ?? initialTabs[0]?.id ?? null)
      setSyncMeta(state.syncMeta)
      lastLocalChangeAtRef.current = Math.max(...initialTabs.map(t => t.updatedAt), 0)
    })
  }, [])

  // Flush to storage on page close
  useEffect(() => {
    const flush = () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
        chrome.storage.local.set({ tabs })
      }
    }
    window.addEventListener('beforeunload', flush)
    return () => window.removeEventListener('beforeunload', flush)
  }, [tabs])

  const activeTab = tabs.find(t => t.id === activeTabId) ?? null

  const { scheduleSyncAfterEdit, sync, connect } = useDriveSync({
    tabs,
    syncMeta,
    lastLocalChangeAt: lastLocalChangeAtRef.current,
    driveFileId,
    setTabs,
    setSyncMeta,
    setSyncStatus,
    setConflict,
    setDriveFileId,
    setDriveConnected,
  })

  const handleContentChange = useCallback((content: string) => {
    const now = Date.now()
    lastLocalChangeAtRef.current = now
    setTabs(prev => {
      const updated = prev.map(t => t.id === activeTabId ? { ...t, content, updatedAt: now } : t)
      const sorted = [...updated].sort((a, b) => b.updatedAt - a.updatedAt)
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => saveState({ tabs: sorted }), SAVE_DEBOUNCE_MS)
      if (driveConnected) scheduleSyncAfterEdit()
      return sorted
    })
  }, [activeTabId, driveConnected, scheduleSyncAfterEdit])

  const handleNewTab = useCallback(() => {
    const tab: Tab = { id: generateId(), content: '# New note\n', updatedAt: Date.now() }
    setTabs(prev => {
      const updated = [tab, ...prev]
      saveState({ tabs: updated, activeTabId: tab.id })
      return updated
    })
    setActiveTabId(tab.id)
  }, [])

  const handleDeleteTab = useCallback((id: string) => {
    setTabs(prev => {
      const updated = prev.filter(t => t.id !== id)
      const withFallback = updated.length === 0
        ? [{ id: generateId(), content: '# New note\n', updatedAt: Date.now() }]
        : updated
      const newActiveId = id === activeTabId ? (withFallback[0]?.id ?? null) : activeTabId
      saveState({ tabs: withFallback, activeTabId: newActiveId })
      setActiveTabId(newActiveId)
      return withFallback
    })
  }, [activeTabId])

  const handleTabSelect = useCallback((id: string) => {
    setActiveTabId(id)
    saveState({ activeTabId: id })
  }, [])

  const handleConnectDrive = useCallback(async () => {
    await connect()
  }, [connect])

  const handleDisconnectDrive = useCallback(() => {
    setDriveConnected(false)
    setSyncStatus('disconnected')
    // Chrome caches the OAuth token — next "Connect Drive" click will silently reuse it.
    // Token revocation is not needed for v1.
  }, [])

  const handleConflictResolve = useCallback(async (winner: 'local' | 'remote') => {
    if (!conflict) return
    const winningTabs = winner === 'local' ? conflict.local.tabs : conflict.remote.tabs
    setTabs(winningTabs)
    setConflict(null)
    await saveState({ tabs: winningTabs })
    // Push winner to Drive immediately
    await sync()
  }, [conflict, sync])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar
        tabs={tabs}
        activeTabId={activeTabId}
        syncStatus={syncStatus}
        driveConnected={driveConnected}
        onNewTab={handleNewTab}
        onSelectTab={handleTabSelect}
        onDeleteTab={handleDeleteTab}
        onConnectDrive={handleConnectDrive}
        onDisconnectDrive={handleDisconnectDrive}
      />
      <Editor
        key={activeTabId ?? 'none'}
        content={activeTab?.content ?? ''}
        onChange={handleContentChange}
      />
      {conflict && (
        <ConflictDialog
          conflict={conflict}
          onResolve={handleConflictResolve}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run all tests**

```bash
yarn test
```

Expected: all tests pass.

- [ ] **Step 3: Build and do full manual test in Chrome**

```bash
yarn build
```

Manual test checklist:
1. Open new tab — notes app loads instantly
2. Type in the editor — tab title updates from first line
3. Create a new note (`+` button) — moves to top
4. Delete a note (hover → ×) — confirm dialog appears
5. Click "Connect Drive" — Chrome OAuth popup appears (requires real client ID configured in manifest)
6. After connecting — sync dot turns green

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire Drive sync and conflict resolution into App"
```

---

## Task 13: GitHub repo + final checks

**Files:**
- No code changes

- [ ] **Step 1: Run full test suite one final time**

```bash
yarn test
```

Expected: all tests pass, 0 failures.

- [ ] **Step 2: Build final dist**

```bash
yarn build
```

Expected: `dist/` contains `newtab.html`, `dist/assets/*.js`, `dist/manifest.json`.

- [ ] **Step 3: Create GitHub repository**

```bash
gh repo create olegbl/NewTabDocs --public --description "Markdown notes on every new tab, synced to Google Drive" --source=. --remote=origin --push
```

Expected: repo created at `https://github.com/olegbl/NewTabDocs`, all commits pushed.

- [ ] **Step 4: Verify repo**

```bash
gh repo view olegbl/NewTabDocs --web
```

Expected: GitHub page opens showing the repo with commit history.

---

## Post-implementation: Google Cloud Console setup

Before the Drive sync will work in practice:

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → Enable Google Drive API
3. Create OAuth 2.0 credentials → Chrome Extension type
4. Set the **Application ID** to your extension's Chrome ID (shown at `chrome://extensions` when loaded unpacked)
5. Copy the client ID → replace `YOUR_GOOGLE_CLIENT_ID` in `public/manifest.json`
6. Rebuild: `yarn build`, reload extension in Chrome
