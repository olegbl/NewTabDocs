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
  const optsRef = useRef(opts)
  optsRef.current = opts

  const sync = useCallback(async () => {
    const o = optsRef.current
    let token: string | null
    try {
      token = await getToken()
    } catch {
      o.setSyncStatus('error')
      return
    }
    if (!token) { o.setSyncStatus('disconnected'); return }

    o.setSyncStatus('syncing')
    try {
      const meta = await getFileMeta(token)
      const fileId = meta?.id ?? o.driveFileId

      if (!meta) {
        const result = await uploadFile(token, null, { tabs: o.tabs, savedAt: Date.now() })
        const newMeta: SyncMeta = { lastSyncedAt: Date.now(), lastSyncedDriveVersion: result.etag }
        o.setSyncMeta(newMeta)
        o.setDriveFileId(result.id)
        await saveState({ syncMeta: newMeta })
        o.setSyncStatus('synced')
        return
      }

      const action = detectConflict(o.syncMeta, meta.etag, o.lastLocalChangeAt)

      if (action === 'no-change') {
        o.setSyncStatus('synced')
        return
      }

      if (action === 'pull') {
        const remote = await downloadFile(token, meta.id)
        o.setTabs(remote.tabs)
        const newMeta: SyncMeta = { lastSyncedAt: Date.now(), lastSyncedDriveVersion: meta.etag }
        o.setSyncMeta(newMeta)
        await saveState({ tabs: remote.tabs, syncMeta: newMeta })
        o.setSyncStatus('synced')
        return
      }

      if (action === 'push') {
        const result = await uploadFile(token, fileId ?? null, { tabs: o.tabs, savedAt: Date.now() })
        const newMeta: SyncMeta = { lastSyncedAt: Date.now(), lastSyncedDriveVersion: result.etag }
        o.setSyncMeta(newMeta)
        o.setDriveFileId(result.id)
        await saveState({ syncMeta: newMeta })
        o.setSyncStatus('synced')
        return
      }

      // conflict
      const remote = await downloadFile(token, meta.id)
      o.setConflict({
        local: { tabs: o.tabs, savedAt: o.lastLocalChangeAt },
        remote,
        remoteEtag: meta.etag,
      })
      o.setSyncStatus('idle')
    } catch {
      o.setSyncStatus('error')
    }
  }, []) // stable ref — reads latest opts via optsRef

  const scheduleSyncAfterEdit = useCallback(() => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    syncTimerRef.current = setTimeout(sync, 2000)
  }, [sync])

  const connect = useCallback(async () => {
    const o = optsRef.current
    let token: string | null
    try {
      token = await getToken()
    } catch {
      o.setSyncStatus('error')
      return
    }
    if (!token) {
      o.setSyncStatus('disconnected')
      return
    }
    o.setDriveConnected(true)
    await sync()
  }, [sync])

  return { scheduleSyncAfterEdit, sync, connect }
}
