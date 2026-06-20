interface Props {
  connected: boolean
  onConnect: () => void
  onDisconnect: () => void
}

export default function DriveStatus({ connected, onConnect, onDisconnect }: Props) {
  return (
    <div style={{ padding: '8px 10px', borderTop: '1px solid #2a2a2a' }}>
      {connected ? (
        <button
          onClick={onDisconnect}
          title="Disconnect Google Drive"
          style={{ background: 'none', border: 'none', color: '#555', fontSize: 11, cursor: 'pointer', padding: 0 }}
        >
          🔒 Drive connected
        </button>
      ) : (
        <button
          onClick={onConnect}
          style={{ background: 'none', border: '1px solid #333', color: '#888', fontSize: 11, cursor: 'pointer', padding: '3px 6px', borderRadius: 3 }}
        >
          Connect Drive
        </button>
      )}
    </div>
  )
}
