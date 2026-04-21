import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UserChip } from '@/components/ui/user-chip'

describe('UserChip', () => {
  it('role=subscriber, handle="alice" → chip shows @alice', () => {
    render(
      <UserChip handle="alice" displayName="Alice" role="subscriber" onSignOut={() => {}} />
    )
    expect(screen.getByText('@alice')).toBeInTheDocument()
  })

  it('role=subscriber, handle=null → chip shows @you', () => {
    render(
      <UserChip handle={null} role="subscriber" onSignOut={() => {}} />
    )
    expect(screen.getByText('@you')).toBeInTheDocument()
  })

  it('subscriber dropdown → shows "feed" + "settings" + "sign out"', () => {
    render(
      <UserChip handle="alice" role="subscriber" onSignOut={() => {}} />
    )
    fireEvent.click(screen.getByText('@alice'))
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
      <UserChip handle="alice" role="subscriber" onSignOut={onSignOut} />
    )
    fireEvent.click(screen.getByText('@alice'))
    fireEvent.click(screen.getByText('sign out'))
    expect(onSignOut).toHaveBeenCalledOnce()
  })
})
