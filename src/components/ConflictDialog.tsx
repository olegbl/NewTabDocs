import type { ConflictState } from '../types'

interface Props {
  conflict: ConflictState
  onResolve: (winner: 'local' | 'remote') => void
}

function VersionCard({ label, tabCount, savedAt }: { label: string; tabCount: number; savedAt: number }) {
  const date = new Date(savedAt).toLocaleString()
  const noteLabel = tabCount === 1 ? '1 note' : `${tabCount} notes`
  return (
    <div style={{
      border: '1px solid #333', borderRadius: 6, padding: '12px 16px',
      flex: 1, textAlign: 'center', background: '#1e1e1e',
    }}>
      <div style={{ fontWeight: 600, color: '#ccc', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, color: '#888' }}>{noteLabel}</div>
      <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>{date}</div>
    </div>
  )
}

export default function ConflictDialog({ conflict, onResolve }: Props) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <div style={{
        background: '#1a1a1a', border: '1px solid #333', borderRadius: 8,
        padding: 24, width: 400, maxWidth: '90vw',
      }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#e0e0e0', marginBottom: 8 }}>
          ⚠ Sync conflict detected
        </div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>
          Both this device and another device made changes since the last sync.
        </div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
          <VersionCard label="This device" tabCount={conflict.local.tabs.length} savedAt={conflict.local.savedAt} />
          <VersionCard label="Drive copy" tabCount={conflict.remote.tabs.length} savedAt={conflict.remote.savedAt} />
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            onClick={() => onResolve('local')}
            style={{
              background: '#2a2a2a', border: '1px solid #444', color: '#ccc',
              padding: '8px 16px', borderRadius: 4, cursor: 'pointer', fontSize: 13,
            }}
          >
            Keep this device
          </button>
          <button
            onClick={() => onResolve('remote')}
            style={{
              background: '#4a9eff', border: 'none', color: '#fff',
              padding: '8px 16px', borderRadius: 4, cursor: 'pointer', fontSize: 13,
            }}
          >
            Use Drive copy
          </button>
        </div>
      </div>
    </div>
  )
}
