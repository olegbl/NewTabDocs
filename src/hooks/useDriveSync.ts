import { useRef, useCallback, type MutableRefObject } from 'react'
import type { Tab, SyncMeta, SyncStatus, ConflictState } from '../types'
import { getToken, clearCachedToken } from '../drive/auth'
import { getFileMeta, downloadFile, uploadFile, DriveAuthError } from '../drive/api'
import { saveState } from '../storage'

export type SyncAction = 'no-change' | 'pull' | 'push' | 'conflict'

export function detectConflict(
  syncMeta: SyncMeta,
  remoteVersion: string,
  lastLocalChangeAt: number
): SyncAction {
  if (syncMeta.lastSyncedAt === null) return 'push'
  const driveChanged = remoteVersion !== syncMeta.lastSyncedDriveVersion
  const localChanged = lastLocalChangeAt > syncMeta.lastSyncedAt
  if (!driveChanged && !localChanged) return 'no-change'
  if (driveChanged && !localChanged) return 'pull'
  if (!driveChanged && localChanged) return 'push'
  return 'conflict'
}

interface UseDriveSyncOptions {
  tabs: Tab[]
  syncMeta: SyncMeta
  lastLocalChangeAtRef: MutableRefObject<number>
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
  optsRef.current = opts  // always latest, even when sync fires from a stale timer

  const sync = useCallback(async (retried = false) => {
    const o = optsRef.current
    const token = await getToken()
    if (!token) { o.setSyncStatus('disconnected'); return }

    o.setSyncStatus('syncing')
    try {
      const meta = await getFileMeta(token)
      const fileId = meta?.id ?? o.driveFileId

      if (!meta) {
        const result = await uploadFile(token, null, { tabs: o.tabs, savedAt: Date.now() })
        const newMeta: SyncMeta = { lastSyncedAt: Date.now(), lastSyncedDriveVersion: result.modifiedTime }
        o.setSyncMeta(newMeta)
        o.setDriveFileId(result.id)
        await saveState({ syncMeta: newMeta })
        o.setSyncStatus('synced')
        return
      }

      const action = detectConflict(o.syncMeta, meta.modifiedTime, o.lastLocalChangeAtRef.current)

      if (action === 'no-change') {
        o.setSyncStatus('synced')
        return
      }

      if (action === 'pull') {
        const remote = await downloadFile(token, meta.id)
        o.setTabs(remote.tabs)
        const newMeta: SyncMeta = { lastSyncedAt: Date.now(), lastSyncedDriveVersion: meta.modifiedTime }
        o.setSyncMeta(newMeta)
        await saveState({ tabs: remote.tabs, syncMeta: newMeta })
        o.setSyncStatus('synced')
        return
      }

      if (action === 'push') {
        const result = await uploadFile(token, fileId ?? null, { tabs: o.tabs, savedAt: Date.now() })
        const newMeta: SyncMeta = { lastSyncedAt: Date.now(), lastSyncedDriveVersion: result.modifiedTime }
        o.setSyncMeta(newMeta)
        o.setDriveFileId(result.id)
        await saveState({ syncMeta: newMeta })
        o.setSyncStatus('synced')
        return
      }

      // conflict
      const remote = await downloadFile(token, meta.id)
      o.setConflict({
        local: { tabs: o.tabs, savedAt: o.lastLocalChangeAtRef.current },
        remote,
        remoteVersion: meta.modifiedTime,
      })
      o.setSyncStatus('idle')
    } catch (err) {
      if (!retried && err instanceof DriveAuthError) {
        // Token expired — clear it, try silent refresh then interactive, retry once
        await clearCachedToken()
        const silent = await getToken(false)
        if (!silent) await getToken(true)
        await sync(true)
        return
      }
      optsRef.current.setSyncStatus('error')
    }
  }, [])

  const scheduleSyncAfterEdit = useCallback(() => {
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    syncTimerRef.current = setTimeout(sync, 2000)
  }, [sync])

  const connect = useCallback(async () => {
    const token = await getToken()
    if (!token) {
      optsRef.current.setSyncStatus('error')
      return
    }
    optsRef.current.setDriveConnected(true)
    await sync()
  }, [sync])

  // Called after the user picks a winner in the conflict dialog.
  // Bypasses detectConflict — we already know what to do.
  const resolveConflict = useCallback(async (
    winner: 'local' | 'remote',
    winningTabs: Tab[],
    remoteVersion: string,
  ) => {
    const o = optsRef.current
    const token = await getToken()
    if (!token) { o.setSyncStatus('error'); return }

    o.setSyncStatus('syncing')
    try {
      if (winner === 'local') {
        const result = await uploadFile(token, o.driveFileId, { tabs: winningTabs, savedAt: Date.now() })
        const newMeta: SyncMeta = { lastSyncedAt: Date.now(), lastSyncedDriveVersion: result.modifiedTime }
        o.setSyncMeta(newMeta)
        o.setDriveFileId(result.id)
        await saveState({ syncMeta: newMeta })
      } else {
        // Remote tabs already applied by caller; just record the synced version.
        const newMeta: SyncMeta = { lastSyncedAt: Date.now(), lastSyncedDriveVersion: remoteVersion }
        o.setSyncMeta(newMeta)
        await saveState({ syncMeta: newMeta })
      }
      o.setSyncStatus('synced')
    } catch {
      o.setSyncStatus('error')
    }
  }, [])

  return { scheduleSyncAfterEdit, sync, connect, resolveConflict }
}
