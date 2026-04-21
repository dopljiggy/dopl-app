import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FinishSetupChecklist } from '@/components/ui/finish-setup-checklist'

describe('FinishSetupChecklist', () => {
  it('renders all items with labels', () => {
    render(
      <FinishSetupChecklist
        items={[
          { label: 'connect broker', done: false, href: '/a' },
          { label: 'create portfolio', done: true },
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
          { label: 'a', done: true },
          { label: 'b', done: true },
        ]}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders CTA link with default label when href provided and !done', () => {
    render(
      <FinishSetupChecklist
        items={[{ label: 'connect', done: false, href: '/dashboard/connect' }]}
      />
    )
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/dashboard/connect')
    expect(link).toHaveTextContent('go →')
  })

  it('does not render CTA when item is done, even if href present', () => {
    render(
      <FinishSetupChecklist
        items={[{ label: 'connect', done: true, href: '/dashboard/connect' }]}
      />
    )
    expect(screen.queryByRole('link')).toBeNull()
  })
})
