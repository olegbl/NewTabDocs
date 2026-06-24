import { useState, useRef, useEffect } from 'react'
import type { SyncStatus, SyncMeta } from '../types'

const DOT_COLOR: Record<SyncStatus, string> = {
  idle: '#2a5a8a',
  syncing: '#f0a500',
  synced: '#2ea043',
  error: '#d73a49',
  disconnected: '#444',
}

const SYNC_LABEL: Record<SyncStatus, string> = {
  idle: 'Connected',
  syncing: 'Syncing…',
  synced: 'Synced',
  error: 'Sync error',
  disconnected: 'Not connected',
}

function relativeTime(ts: number | null): string {
  if (ts === null) return 'Never'
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'Just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function Dot({ color }: { color: string }) {
  return (
    <span style={{
      display: 'inline-block', width: 7, height: 7,
      borderRadius: '50%', background: color, flexShrink: 0,
    }} />
  )
}

interface Props {
  connected: boolean
  syncStatus: SyncStatus
  syncMeta: SyncMeta
  onConnect: () => void
  onDisconnect: () => void
}

export default function DriveStatus({ connected, syncStatus, syncMeta, onConnect, onDisconnect }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const btnStyle: React.CSSProperties = {
    background: 'none',
    border: '1px solid #333',
    color: '#777',
    fontSize: 11,
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: 3,
    alignSelf: 'flex-start',
  }

  return (
    <div ref={rootRef} style={{ position: 'relative', borderTop: '1px solid #2a2a2a' }}>

      {open && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0, right: 0,
          background: '#1e1e1e', borderTop: '1px solid #333', borderRight: '1px solid #333', borderLeft: '1px solid #2a2a2a',
          padding: '12px 12px 10px',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <span style={{ fontSize: 10, color: '#555', letterSpacing: '.08em', textTransform: 'uppercase' }}>
            Google Drive
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#bbb' }}>
            <Dot color={DOT_COLOR[syncStatus]} />
            {SYNC_LABEL[syncStatus]}
          </div>

          <div style={{ fontSize: 11, color: '#555' }}>
            Last synced: {relativeTime(syncMeta.lastSyncedAt)}
          </div>

          {connected ? (
            <button
              style={btnStyle}
              onClick={() => {
                setOpen(false)
                if (window.confirm('Disconnect Google Drive? Your docs will remain saved locally.')) {
                  onDisconnect()
                }
              }}
            >
              Disconnect
            </button>
          ) : (
            <button
              style={btnStyle}
              onClick={() => { setOpen(false); onConnect() }}
            >
              Connect Drive
            </button>
          )}
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', background: 'none', border: 'none',
          color: '#666', fontSize: 11, cursor: 'pointer',
          padding: '9px 10px',
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        <Dot color={DOT_COLOR[syncStatus]} />
        {connected ? `Drive · ${SYNC_LABEL[syncStatus]}` : 'Connect Drive'}
      </button>

    </div>
  )
}
