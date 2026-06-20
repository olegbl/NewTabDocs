import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import TabItem from './TabItem'
import type { Tab } from '../types'

const tab: Tab = { id: '1', content: '# My Note\nsome text', updatedAt: Date.now() }

describe('TabItem', () => {
  it('renders title derived from content', () => {
    render(<TabItem tab={tab} isActive={false} onSelect={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('My Note')).toBeInTheDocument()
  })

  it('calls onSelect when clicked', async () => {
    const onSelect = vi.fn()
    render(<TabItem tab={tab} isActive={false} onSelect={onSelect} onDelete={vi.fn()} />)
    await userEvent.click(screen.getByText('My Note'))
    expect(onSelect).toHaveBeenCalledOnce()
  })

  it('shows delete button on hover', async () => {
    render(<TabItem tab={tab} isActive={false} onSelect={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
    await userEvent.hover(screen.getByText('My Note').parentElement!.parentElement!)
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
  })

  it('calls onDelete after confirm', async () => {
    const onDelete = vi.fn()
    vi.stubGlobal('confirm', vi.fn(() => true))
    render(<TabItem tab={tab} isActive={false} onSelect={vi.fn()} onDelete={onDelete} />)
    await userEvent.hover(screen.getByText('My Note').parentElement!.parentElement!)
    await userEvent.click(screen.getByRole('button', { name: /delete/i }))
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it('does not call onDelete when confirm is cancelled', async () => {
    const onDelete = vi.fn()
    vi.stubGlobal('confirm', vi.fn(() => false))
    render(<TabItem tab={tab} isActive={false} onSelect={vi.fn()} onDelete={onDelete} />)
    await userEvent.hover(screen.getByText('My Note').parentElement!.parentElement!)
    await userEvent.click(screen.getByRole('button', { name: /delete/i }))
    expect(onDelete).not.toHaveBeenCalled()
  })
})
