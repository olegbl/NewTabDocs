import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import ConflictDialog from './ConflictDialog'
import type { ConflictState } from '../types'

const conflict: ConflictState = {
  local: { tabs: [{ id: '1', content: '# Local', updatedAt: 1000 }], savedAt: 1000 },
  remote: { tabs: [{ id: '2', content: '# Remote', updatedAt: 2000 }, { id: '3', content: '# B', updatedAt: 900 }], savedAt: 2000 },
  remoteVersion: '"etag-xyz"',
}

describe('ConflictDialog', () => {
  it('shows note counts for both versions', () => {
    render(<ConflictDialog conflict={conflict} onResolve={vi.fn()} />)
    expect(screen.getByText(/1 note/)).toBeInTheDocument()
    expect(screen.getByText(/2 notes/)).toBeInTheDocument()
  })

  it('calls onResolve with "local" when local button clicked', async () => {
    const onResolve = vi.fn()
    render(<ConflictDialog conflict={conflict} onResolve={onResolve} />)
    await userEvent.click(screen.getByRole('button', { name: /keep this device/i }))
    expect(onResolve).toHaveBeenCalledWith('local')
  })

  it('calls onResolve with "remote" when remote button clicked', async () => {
    const onResolve = vi.fn()
    render(<ConflictDialog conflict={conflict} onResolve={onResolve} />)
    await userEvent.click(screen.getByRole('button', { name: /use drive copy/i }))
    expect(onResolve).toHaveBeenCalledWith('remote')
  })
})
