import type { Tab, SyncStatus } from '../types'

interface Props {
  tabs: Tab[]
  activeTabId: string | null
  syncStatus: SyncStatus
  onNewTab: () => void
  onSelectTab: (id: string) => void
  onDeleteTab: (id: string) => void
}

export default function Sidebar(_props: Props) {
  return <div style={{ width: 200, background: '#1a1a1a' }}>Sidebar</div>
}
