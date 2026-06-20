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
