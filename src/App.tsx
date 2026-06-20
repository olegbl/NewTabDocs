import { useEffect, useRef, useState, useCallback } from 'react'
import type { Tab, SyncStatus, ConflictState } from './types'
import { loadState, saveState } from './storage'
import { generateId } from './utils'
import Sidebar from './components/Sidebar'
import Editor from './components/Editor'
import ConflictDialog from './components/ConflictDialog'

const SAVE_DEBOUNCE_MS = 500

export default function App() {
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('disconnected')
  const [driveConnected, setDriveConnected] = useState(false)
  const [conflict, setConflict] = useState<ConflictState | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load initial state
  useEffect(() => {
    loadState().then(state => {
      let initialTabs = state.tabs
      let initialActiveId = state.activeTabId

      if (initialTabs.length === 0) {
        const newTab: Tab = { id: generateId(), content: '# New note\n', updatedAt: Date.now() }
        initialTabs = [newTab]
        initialActiveId = newTab.id
      }

      setTabs(initialTabs)
      setActiveTabId(initialActiveId ?? initialTabs[0]?.id ?? null)
    })
  }, [])

  const activeTab = tabs.find(t => t.id === activeTabId) ?? null

  const handleContentChange = useCallback((content: string) => {
    const now = Date.now()
    setTabs(prev => {
      const updated = prev.map(t => t.id === activeTabId ? { ...t, content, updatedAt: now } : t)
      const sorted = [...updated].sort((a, b) => b.updatedAt - a.updatedAt)
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => saveState({ tabs: sorted }), SAVE_DEBOUNCE_MS)
      return sorted
    })
  }, [activeTabId])

  const handleNewTab = useCallback(() => {
    const tab: Tab = { id: generateId(), content: '# New note\n', updatedAt: Date.now() }
    setTabs(prev => {
      const updated = [tab, ...prev]
      saveState({ tabs: updated, activeTabId: tab.id })
      return updated
    })
    setActiveTabId(tab.id)
  }, [])

  const handleDeleteTab = useCallback((id: string) => {
    setTabs(prev => {
      const updated = prev.filter(t => t.id !== id)
      const withFallback = updated.length === 0
        ? [{ id: generateId(), content: '# New note\n', updatedAt: Date.now() }]
        : updated
      const newActiveId = id === activeTabId ? (withFallback[0]?.id ?? null) : activeTabId
      saveState({ tabs: withFallback, activeTabId: newActiveId })
      setActiveTabId(newActiveId)
      return withFallback
    })
  }, [activeTabId])

  const handleTabSelect = useCallback((id: string) => {
    setActiveTabId(id)
    saveState({ activeTabId: id })
  }, [])

  const handleConnectDrive = useCallback(() => {
    setDriveConnected(true)
  }, [])

  const handleDisconnectDrive = useCallback(() => {
    setDriveConnected(false)
    setSyncStatus('disconnected')
  }, [])

  const handleConflictResolve = useCallback((winner: 'local' | 'remote') => {
    if (!conflict) return
    const winningTabs = winner === 'local' ? conflict.local.tabs : conflict.remote.tabs
    setTabs(winningTabs)
    setConflict(null)
    saveState({ tabs: winningTabs })
  }, [conflict])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar
        tabs={tabs}
        activeTabId={activeTabId}
        syncStatus={syncStatus}
        driveConnected={driveConnected}
        onNewTab={handleNewTab}
        onSelectTab={handleTabSelect}
        onDeleteTab={handleDeleteTab}
        onConnectDrive={handleConnectDrive}
        onDisconnectDrive={handleDisconnectDrive}
      />
      <Editor
        key={activeTabId ?? 'none'}
        content={activeTab?.content ?? ''}
        onChange={handleContentChange}
      />
      {conflict && (
        <ConflictDialog
          conflict={conflict}
          onResolve={handleConflictResolve}
        />
      )}
    </div>
  )
}
