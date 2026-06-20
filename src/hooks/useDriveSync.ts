import { useRef, useCallback } from 'react'
import type { Tab, SyncMeta, SyncStatus, ConflictState } from '../types'
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
    const token = await getToken()
    if (!token) { opts.setSyncStatus('disconnected'); return }

    opts.setSyncStatus('syncing')
    try {
      const meta = await getFileMeta(token)
      const fileId = meta?.id ?? opts.driveFileId

      if (!meta) {
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
    const token = await getToken()
    if (!token) {
      opts.setSyncStatus('error')
      return
    }
    opts.setDriveConnected(true)
    await sync()
  }, [sync, opts])

  return { scheduleSyncAfterEdit, sync, connect }
}
