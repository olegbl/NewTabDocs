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
