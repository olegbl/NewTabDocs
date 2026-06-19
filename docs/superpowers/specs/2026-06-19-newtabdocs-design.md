# New Tab Docs — Design Spec

**Date:** 2026-06-19
**Status:** Approved

## Overview

A Chrome extension that replaces the new tab page with a lightweight markdown note-taking app. Multiple notes ("tabs") are listed in a left sidebar and edited in a pseudo-WYSIWYG CodeMirror editor. Content is stored locally in `chrome.storage.local` for instant load times. Google Drive provides optional automatic backup and cross-device sync with Steam-style conflict resolution.

---

## Tech Stack

- **Framework:** React 18 + TypeScript
- **Build tool:** Vite
- **Package manager:** Yarn
- **Editor:** CodeMirror 6 with `@codemirror/lang-markdown`
- **Extension API:** Manifest V3
- **Sync:** Google Drive REST API via `chrome.identity` OAuth

---

## Project Structure

```
NewTabDocs/
├── src/
│   ├── newtab/              # React app (new tab page)
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── SyncIndicator.tsx
│   │   │   ├── TabList.tsx
│   │   │   ├── TabItem.tsx
│   │   │   ├── DriveStatus.tsx
│   │   │   ├── Editor.tsx
│   │   │   └── ConflictDialog.tsx
│   │   ├── hooks/
│   │   │   ├── useStorage.ts    # chrome.storage.local read/write
│   │   │   └── useDriveSync.ts  # Drive upload/download/conflict logic
│   │   └── newtab.html
│   └── types.ts                 # shared interfaces
├── public/
│   └── manifest.json
├── dist/                        # built extension — load this in Chrome
├── package.json
└── vite.config.ts
```

---

## Data Model

```typescript
// src/types.ts

interface Tab {
  id: string;        // UUID (crypto.randomUUID())
  content: string;   // raw markdown
  updatedAt: number; // ms timestamp — used for sort order (desc) and sync detection
}

interface SyncMeta {
  lastSyncedAt: number | null;           // ms timestamp of last successful Drive upload
  lastSyncedDriveVersion: string | null; // Drive file etag at time of last sync
}

// chrome.storage.local keys:
//   "tabs"        → Tab[]
//   "activeTabId" → string | null
//   "syncMeta"    → SyncMeta
```

**Tab title** is derived at render time from the first non-empty line of `content` (strips leading `#` and whitespace). Never stored separately.

**Drive file** (`newtabdocs-backup.json`):
```json
{ "tabs": [...], "savedAt": 1234567890 }
```

---

## Storage Strategy

All persistent data uses `chrome.storage.local`:
- Reads are synchronous-feeling (Promise resolves immediately from local disk)
- No quota issues for a text-only notes app
- Survives service worker restarts

On every edit, data is written to `chrome.storage.local` first (500ms debounce), then uploaded to Drive (2s debounce). Local write always happens regardless of Drive status.

---

## UI Layout

Full-window new tab page. Dark theme.

```
┌─────────────────────────────────────────────────────┐
│  NOTES                               ● [+]           │  ← sidebar header: sync dot + new tab button
├──────────────────┬──────────────────────────────────┤
│                  │                                   │
│  Shopping List   │  # Shopping List                  │
│  just now        │                                   │
│                  │  Here are things I need to        │
│  Project Ideas   │  **buy this week**:               │
│  2 hours ago     │  - Milk                           │
│                  │  - Eggs                           │
│  Meeting Notes   │  ~~- Bread (already have)~~       │
│  yesterday       │                                   │
│                  │  *Don't forget Saturday*          │
│                  │                                   │
│                  │  > "Buy local when possible"      │
│                  │                                   │
├──────────────────┤                                   │
│  🔒 Drive synced │                                   │
└──────────────────┴──────────────────────────────────┘
   200px sidebar         flex: 1 editor
```

- Active tab: left blue border, slightly lighter background
- Tab list sorted by `updatedAt` descending — editing a tab moves it to top
- Sidebar width: fixed 200px; editor: `flex: 1`
- No toolbar — users type markdown syntax directly

---

## React Component Tree

```
<App>                        # owns all state; orchestrates storage + sync
├── <Sidebar>
│   ├── <SyncIndicator>      # dot: green=synced, amber=syncing, red=error
│   ├── <TabList>
│   │   └── <TabItem>        # title (derived) + relative timestamp
│   └── <DriveStatus>        # "Connected" label or "Connect Drive" button
├── <Editor>                 # CodeMirror 6, uncontrolled ref, no toolbar
└── <ConflictDialog>         # modal; null when no conflict
    ├── <VersionCard>        # "This device" — tab count + timestamp
    └── <VersionCard>        # "Drive copy" — tab count + timestamp
```

State lives entirely in `App` and flows down as props. No global state library needed.

---

## Drive Sync

### Authentication

Uses `chrome.identity.getAuthToken()` — Chrome handles the OAuth popup natively, no redirect URI needed.

OAuth scope: `https://www.googleapis.com/auth/drive.file`
(App can only access files it creates. The backup file lives in a Google-managed app-specific folder, not visible in the user's Drive root.)

### Sync Flow

On every edit:
1. **500ms debounce** → write to `chrome.storage.local`
2. **2s debounce** → upload to Drive (if connected)
3. On upload success: store new `lastSyncedAt` + Drive file etag as `lastSyncedDriveVersion`

### Conflict Detection

Runs at page load and before each upload:

1. Fetch Drive file's current etag (cheap HEAD request)
2. Compare to `syncMeta.lastSyncedDriveVersion`
3. Determine state:
   - **No Drive change** → push local state (safe)
   - **Drive changed, no local changes since `lastSyncedAt`** → pull from Drive (safe)
   - **Drive changed AND local changes since `lastSyncedAt`** → **conflict**

### Conflict Resolution UI

Modal dialog (non-blocking appearance but requires a choice before next sync):

```
┌──────────────────────────────────────────────┐
│  ⚠  Sync conflict detected                   │
│                                              │
│  Both this device and another device made    │
│  changes since the last sync.                │
│                                              │
│  ┌─────────────────┐  ┌─────────────────┐    │
│  │  This device    │  │  Drive copy     │    │
│  │  3 notes        │  │  5 notes        │    │
│  │  2 minutes ago  │  │  47 minutes ago │    │
│  └─────────────────┘  └─────────────────┘    │
│                                              │
│  [Keep this device]   [Use Drive copy]       │
└──────────────────────────────────────────────┘
```

The chosen version is immediately written to both `chrome.storage.local` and Drive. `syncMeta` is updated to reflect the new baseline.

---

## CodeMirror Editor Setup

- `@codemirror/lang-markdown` for markdown parsing
- Custom theme: markdown syntax characters (`#`, `**`, `*`, `-`, `>`, `` ` ``) dimmed to ~25% opacity; rendered text styled (headings larger, bold actual bold, strikethrough applied)
- `EditorView.updateListener` → change event → debounce → save + sync
- Editor mounts once; active tab content swapped via `EditorView.dispatch` (not remount)

---

## Empty State

- On first install (no tabs in storage): auto-create one empty tab with placeholder content `# New note`
- If the user deletes all tabs: auto-create one empty tab immediately
- The auto-created tab is treated like any user-created tab (editable, syncable)

---

## Tab Deletion

No toolbar exists, so deletion is exposed via a **hover-revealed × button** on each `<TabItem>` in the sidebar. Hovering the tab item shows a small × in the top-right corner of the item. Clicking it deletes the tab after a confirmation (browser `confirm()` dialog is acceptable for v1 — no custom modal needed).

---

## Manifest (V3)

```json
{
  "manifest_version": 3,
  "name": "New Tab Docs",
  "version": "1.0.0",
  "chrome_url_overrides": { "newtab": "newtab.html" },
  "permissions": ["storage", "identity"],
  "oauth2": {
    "client_id": "YOUR_GOOGLE_CLIENT_ID",
    "scopes": ["https://www.googleapis.com/auth/drive.file"]
  }
}
```

The `oauth2` field lets `chrome.identity.getAuthToken()` work without a separate redirect URI. No background service worker is needed — Drive sync runs entirely from the newtab page. Pending local writes are flushed synchronously via `window.addEventListener('beforeunload', ...)`.

**Setup note:** `YOUR_GOOGLE_CLIENT_ID` must be replaced with a real client ID from Google Cloud Console. The extension's Chrome Web Store ID (or the unpacked extension ID) must be added as an authorized origin in the OAuth client config.

---

## Repository

- **GitHub:** `https://github.com/olegbl/NewTabDocs`
- **Local:** `C:\Users\olegb\Projects\NewTabDocs\`
- `.superpowers/` added to `.gitignore`
