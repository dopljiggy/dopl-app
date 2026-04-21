import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UserChip } from '@/components/ui/user-chip'

describe('UserChip', () => {
  it('role=fund_manager with handle → chip shows @handle', () => {
    render(
      <UserChip handle="bob" role="fund_manager" onSignOut={() => {}} />
    )
    expect(screen.getByText('@bob')).toBeInTheDocument()
  })

  it('role=subscriber with displayName → chip shows displayName (no @)', () => {
    render(
      <UserChip handle={null} displayName="Alice" role="subscriber" onSignOut={() => {}} />
    )
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.queryByText(/^@/)).not.toBeInTheDocument()
  })

  it('role=subscriber with only handle (no displayName) → falls back to @handle', () => {
    render(
      <UserChip handle="alice" role="subscriber" onSignOut={() => {}} />
    )
    expect(screen.getByText('@alice')).toBeInTheDocument()
  })

  it('role=subscriber, neither handle nor displayName → falls back to "me"', () => {
    render(
      <UserChip handle={null} role="subscriber" onSignOut={() => {}} />
    )
    expect(screen.getByText('me')).toBeInTheDocument()
  })

  it('subscriber dropdown → shows "feed" + "settings" + "sign out"', () => {
    render(
      <UserChip handle={null} displayName="Alice" role="subscriber" onSignOut={() => {}} />
    )
    fireEvent.click(screen.getByText('Alice'))
    expect(screen.getByText('feed')).toBeInTheDocument()
    expect(screen.getByText('settings')).toBeInTheDocument()
    expect(screen.getByText('sign out')).toBeInTheDocument()
  })

  it('fund_manager dropdown → shows "dashboard" instead of "feed"', () => {
    render(
      <UserChip handle="bob" role="fund_manager" onSignOut={() => {}} />
    )
    fireEvent.click(screen.getByText('@bob'))
    expect(screen.getByText('dashboard')).toBeInTheDocument()
    expect(screen.queryByText('feed')).not.toBeInTheDocument()
  })

  it('clicking "sign out" calls onSignOut once', () => {
    const onSignOut = vi.fn()
    render(
      <UserChip handle="alice" role="fund_manager" onSignOut={onSignOut} />
    )
    fireEvent.click(screen.getByText('@alice'))
    fireEvent.click(screen.getByText('sign out'))
    expect(onSignOut).toHaveBeenCalledOnce()
  })
})
