import type { Tab } from '../types'
import TabItem from './TabItem'

interface Props {
  tabs: Tab[]
  activeTabId: string | null
  onSelectTab: (id: string) => void
  onDeleteTab: (id: string) => void
}

export default function TabList({ tabs, activeTabId, onSelectTab, onDeleteTab }: Props) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
      {tabs.map(tab => (
        <TabItem
          key={tab.id}
          tab={tab}
          isActive={tab.id === activeTabId}
          onSelect={() => onSelectTab(tab.id)}
          onDelete={() => onDeleteTab(tab.id)}
        />
      ))}
    </div>
  )
}
