import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InlineError } from '@/components/ui/inline-error'

describe('InlineError', () => {
  it('renders the message', () => {
    render(<InlineError message="something broke" />)
    expect(screen.getByText('something broke')).toBeInTheDocument()
  })

  it('renders nextHref link with default nextLabel when provided', () => {
    render(
      <InlineError
        message="needs setup"
        nextHref="/dashboard/billing"
      />
    )
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/dashboard/billing')
    expect(link).toHaveTextContent('go set it up →')
  })

  it('dismiss button fires onDismiss', () => {
    const onDismiss = vi.fn()
    render(<InlineError message="dismissable" onDismiss={onDismiss} />)
    fireEvent.click(screen.getByLabelText('dismiss'))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('warning variant applies amber classes', () => {
    const { container } = render(
      <InlineError message="watch out" variant="warning" />
    )
    const banner = container.firstChild as HTMLElement
    expect(banner.className).toContain('amber')
  })
})
