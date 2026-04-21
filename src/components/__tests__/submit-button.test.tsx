import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SubmitButton } from '@/components/ui/submit-button'

afterEach(() => vi.restoreAllMocks())

describe('SubmitButton', () => {
  it('renders with isPending=true → spinner visible, pendingLabel text, button disabled', () => {
    render(
      <SubmitButton isPending pendingLabel="saving...">
        save
      </SubmitButton>
    )
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
    expect(screen.getByText('saving...')).toBeInTheDocument()
    expect(screen.queryByText('save')).not.toBeInTheDocument()
  })

  it('renders with isPending=false → children visible, enabled', () => {
    render(<SubmitButton>save</SubmitButton>)
    const btn = screen.getByRole('button')
    expect(btn).not.toBeDisabled()
    expect(screen.getByText('save')).toBeInTheDocument()
  })

  it('onClick returning Promise → pending flips true during, false after resolve', async () => {
    let resolvePromise: () => void = () => {}
    const handler = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvePromise = resolve
        })
    )
    render(
      <SubmitButton onClick={handler} pendingLabel="saving...">
        save
      </SubmitButton>
    )
    const btn = screen.getByRole('button')
    fireEvent.click(btn)
    await waitFor(() => expect(screen.getByText('saving...')).toBeInTheDocument())
    expect(btn).toBeDisabled()
    resolvePromise()
    await waitFor(() => expect(screen.getByText('save')).toBeInTheDocument())
    expect(btn).not.toBeDisabled()
  })

  it('onClick synchronous fn → pending never flips (no flicker)', () => {
    const handler = vi.fn(() => undefined)
    render(
      <SubmitButton onClick={handler} pendingLabel="saving...">
        save
      </SubmitButton>
    )
    fireEvent.click(screen.getByRole('button'))
    expect(handler).toHaveBeenCalledOnce()
    expect(screen.queryByText('saving...')).not.toBeInTheDocument()
  })

  it('disabled=true overrides — even with isPending=false, button disabled', () => {
    render(
      <SubmitButton disabled isPending={false}>
        save
      </SubmitButton>
    )
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
