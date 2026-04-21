import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FinishSetupChecklist } from '@/components/ui/finish-setup-checklist'

describe('FinishSetupChecklist', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.clear()
    }
  })

  it('renders all items with labels', () => {
    render(
      <FinishSetupChecklist
        items={[
          { key: 'broker', label: 'connect broker', done: false, href: '/a' },
          { key: 'portfolio', label: 'create portfolio', done: true },
        ]}
      />
    )
    expect(screen.getByText('connect broker')).toBeInTheDocument()
    expect(screen.getByText('create portfolio')).toBeInTheDocument()
  })

  it('hides entirely when every item is done', () => {
    const { container } = render(
      <FinishSetupChecklist
        items={[
          { key: 'broker', label: 'a', done: true },
          { key: 'portfolio', label: 'b', done: true },
        ]}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders CTA link with default label when href provided and !done', () => {
    render(
      <FinishSetupChecklist
        items={[{ key: 'broker', label: 'connect', done: false, href: '/dashboard/connect' }]}
      />
    )
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/dashboard/connect')
    expect(link).toHaveTextContent('go →')
  })

  it('does not render CTA when item is done, even if href present', () => {
    render(
      <FinishSetupChecklist
        items={[
          // Need at least one undone item or component returns null
          { key: 'portfolio', label: 'portfolio', done: false, href: '/p' },
          { key: 'broker', label: 'connect', done: true, href: '/dashboard/connect' },
        ]}
      />
    )
    expect(screen.queryByRole('link', { name: /connect/i })).toBeNull()
  })

  it('localStorage share flag forces share item to done', () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('dopl_shared', '1')
    }
    const { container } = render(
      <FinishSetupChecklist
        items={[
          { key: 'broker', label: 'broker', done: true },
          { key: 'portfolio', label: 'portfolio', done: true },
          { key: 'positions', label: 'positions', done: true },
          { key: 'stripe', label: 'stripe', done: true },
          { key: 'share', label: 'share your dopl link', done: false, href: '/dashboard/share' },
        ]}
      />
    )
    // Every item done (share forced by localStorage), card auto-hides
    expect(container.firstChild).toBeNull()
  })

  it('progress summary shows N of M complete', () => {
    render(
      <FinishSetupChecklist
        items={[
          { key: 'broker', label: 'a', done: true },
          { key: 'portfolio', label: 'b', done: false },
          { key: 'positions', label: 'c', done: true },
        ]}
      />
    )
    expect(screen.getByText(/2 of 3 complete/i)).toBeInTheDocument()
  })
})
