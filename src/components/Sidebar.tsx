import type { Tab, SyncStatus } from '../types'
import SyncIndicator from './SyncIndicator'
import TabList from './TabList'
import DriveStatus from './DriveStatus'

interface Props {
  tabs: Tab[]
  activeTabId: string | null
  syncStatus: SyncStatus
  driveConnected: boolean
  onNewTab: () => void
  onSelectTab: (id: string) => void
  onDeleteTab: (id: string) => void
  onConnectDrive: () => void
  onDisconnectDrive: () => void
}

export default function Sidebar({
  tabs, activeTabId, syncStatus, driveConnected,
  onNewTab, onSelectTab, onDeleteTab, onConnectDrive, onDisconnectDrive,
}: Props) {
  return (
    <div style={{
      width: 200,
      background: '#1a1a1a',
      borderRight: '1px solid #2a2a2a',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      <div style={{
        padding: '12px 10px 8px',
        borderBottom: '1px solid #2a2a2a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: '#555', letterSpacing: '.08em', textTransform: 'uppercase' }}>
            Notes
          </span>
          <SyncIndicator status={syncStatus} />
        </div>
        <button
          onClick={onNewTab}
          title="New note"
          style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}
        >
          +
        </button>
      </div>

      <TabList
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={onSelectTab}
        onDeleteTab={onDeleteTab}
      />

      <DriveStatus
        connected={driveConnected}
        onConnect={onConnectDrive}
        onDisconnect={onDisconnectDrive}
      />
    </div>
  )
}
