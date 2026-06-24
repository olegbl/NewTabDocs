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
  modifiedTime: string
}

export interface DriveBackup {
  tabs: Tab[]
  savedAt: number
}

export interface ConflictState {
  local: DriveBackup
  remote: DriveBackup
  remoteVersion: string
}
