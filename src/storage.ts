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
