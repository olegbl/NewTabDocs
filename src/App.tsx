import { useEffect, useRef, useState, useCallback } from 'react'
import type { Tab, SyncMeta, SyncStatus, ConflictState } from './types'
import { loadState, saveState } from './storage'
import { generateId } from './utils'
import { getToken } from './drive/auth'
import { useDriveSync } from './hooks/useDriveSync'
import Sidebar from './components/Sidebar'
import Editor from './components/Editor'
import ConflictDialog from './components/ConflictDialog'

const SAVE_DEBOUNCE_MS = 500

export default function App() {
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [syncMeta, setSyncMeta] = useState<SyncMeta>({ lastSyncedAt: null, lastSyncedDriveVersion: null })
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('disconnected')
  const [conflict, setConflict] = useState<ConflictState | null>(null)
  const [driveConnected, setDriveConnected] = useState(false)
  const [driveFileId, setDriveFileId] = useState<string | null>(null)
  const lastLocalChangeAtRef = useRef<number>(0)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    loadState().then(async state => {
      let initialTabs = state.tabs
      let initialActiveId = state.activeTabId

      if (initialTabs.length === 0) {
        const newTab: Tab = { id: generateId(), content: '# New note\n', updatedAt: Date.now() }
        initialTabs = [newTab]
        initialActiveId = newTab.id
      }

      setTabs(initialTabs)
      setActiveTabId(initialActiveId ?? initialTabs[0]?.id ?? null)
      setSyncMeta(state.syncMeta)
      lastLocalChangeAtRef.current = Math.max(...initialTabs.map(t => t.updatedAt), 0)

      // Auto-reconnect if Chrome has a cached Drive token from a previous session
      const token = await getToken(false).catch(() => null)
      if (token) setDriveConnected(true)
    })
  }, [])

  // Flush to storage on page close
  useEffect(() => {
    const flush = () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
        chrome.storage.local.set({ tabs })
      }
    }
    window.addEventListener('beforeunload', flush)
    return () => window.removeEventListener('beforeunload', flush)
  }, [tabs])

  const activeTab = tabs.find(t => t.id === activeTabId) ?? null

  const { scheduleSyncAfterEdit, sync, connect } = useDriveSync({
    tabs,
    syncMeta,
    lastLocalChangeAt: lastLocalChangeAtRef.current,
    driveFileId,
    setTabs,
    setSyncMeta,
    setSyncStatus,
    setConflict,
    setDriveFileId,
    setDriveConnected,
  })

  const handleContentChange = useCallback((content: string) => {
    const now = Date.now()
    lastLocalChangeAtRef.current = now
    setTabs(prev => {
      const updated = prev.map(t => t.id === activeTabId ? { ...t, content, updatedAt: now } : t)
      const sorted = [...updated].sort((a, b) => b.updatedAt - a.updatedAt)
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => saveState({ tabs: sorted }), SAVE_DEBOUNCE_MS)
      if (driveConnected) scheduleSyncAfterEdit()
      return sorted
    })
  }, [activeTabId, driveConnected, scheduleSyncAfterEdit])

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

  const handleConnectDrive = useCallback(async () => {
    await connect()
  }, [connect])

  const handleDisconnectDrive = useCallback(() => {
    setDriveConnected(false)
    setSyncStatus('disconnected')
  }, [])

  const handleConflictResolve = useCallback(async (winner: 'local' | 'remote') => {
    if (!conflict) return
    const winningTabs = winner === 'local' ? conflict.local.tabs : conflict.remote.tabs
    setTabs(winningTabs)
    setConflict(null)
    await saveState({ tabs: winningTabs })
    await sync()
  }, [conflict, sync])

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
