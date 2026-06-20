import { useState } from 'react'
import { deriveTitle, formatRelativeTime } from '../utils'
import type { Tab } from '../types'

interface Props {
  tab: Tab
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
}

export default function TabItem({ tab, isActive, onSelect, onDelete }: Props) {
  const [hovered, setHovered] = useState(false)

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (window.confirm(`Delete "${deriveTitle(tab.content)}"?`)) {
      onDelete()
    }
  }

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '8px 10px',
        cursor: 'pointer',
        borderLeft: isActive ? '2px solid #4a9eff' : '2px solid transparent',
        background: isActive ? '#252525' : 'transparent',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        position: 'relative',
      }}
    >
      <div style={{ overflow: 'hidden' }}>
        <div style={{
          fontSize: 13,
          color: isActive ? '#e0e0e0' : '#888',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {deriveTitle(tab.content)}
        </div>
        <div style={{ fontSize: 10, color: '#444', marginTop: 2 }}>
          {formatRelativeTime(tab.updatedAt)}
        </div>
      </div>
      {hovered && (
        <button
          onClick={handleDelete}
          aria-label="Delete tab"
          style={{
            background: 'none', border: 'none', color: '#666',
            fontSize: 14, cursor: 'pointer', lineHeight: 1,
            padding: '0 0 0 4px', flexShrink: 0,
          }}
        >
          ×
        </button>
      )}
    </div>
  )
}
