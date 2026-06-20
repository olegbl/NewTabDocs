import { describe, it, expect } from 'vitest'
import { detectConflict } from './useDriveSync'
import type { SyncMeta } from '../types'

describe('detectConflict', () => {
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
