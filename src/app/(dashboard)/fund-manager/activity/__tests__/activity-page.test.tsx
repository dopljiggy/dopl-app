import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ActivityClient from '../activity-client'
import { FmNotificationsProvider } from '@/components/fm-notifications-context'
import type { Notification } from '@/types/database'

// Direct-hook-use regression guard. Mirrors the Sprint 3 Task 6 pattern for
// notifications-client: if ActivityClient (or any descendant within this
// test) ever bypasses the context and calls the hook directly, the throw
// below fails the whole suite with a clear message.
vi.mock('@/hooks/use-fm-notifications', () => ({
  useFmNotifications: vi.fn(() => {
    throw new Error(
      'ActivityClient must consume useFmNotificationsContext, not useFmNotifications directly'
    )
  }),
}))

function stubProviderValue(notifications: Notification[] = []) {
  return {
    notifications,
    unreadCount: notifications.filter((n) => !n.read).length,
    markAllRead: vi.fn(async () => {}),
  }
}

function makeNotification(
  overrides: Partial<Notification> = {}
): Notification {
  return {
    id: overrides.id ?? 'n-1',
    user_id: 'fm-alice',
    portfolio_update_id: null,
    title: 'some title',
    body: 'some body',
    read: false,
    actionable: false,
    change_type: 'subscription_added',
    ticker: null,
    meta: {},
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('ActivityClient', () => {
  it('filters out non-FM change_types from the rendered list (fetch-predicate defense)', () => {
    const mixed: Notification[] = [
      makeNotification({
        id: 'fm-1',
        title: 'new dopler on TechGrowth',
        change_type: 'subscription_added',
      }),
      makeNotification({
        id: 'fm-2',
        title: 'dopler left TechGrowth',
        change_type: 'subscription_cancelled',
      }),
      makeNotification({
        id: 'buy-1',
        title: 'stray position update — should not appear',
        change_type: 'buy',
      }),
      makeNotification({
        id: 'sell-1',
        title: 'stray sell — should not appear',
        change_type: 'sell',
      }),
    ]
    render(
      <FmNotificationsProvider value={stubProviderValue([])}>
        <ActivityClient userId="fm-alice" initial={mixed} />
      </FmNotificationsProvider>
    )
    expect(screen.getByText(/new dopler on TechGrowth/)).toBeInTheDocument()
    expect(screen.getByText(/dopler left TechGrowth/)).toBeInTheDocument()
    expect(
      screen.queryByText(/stray position update/)
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/stray sell/)).not.toBeInTheDocument()
  })

  it('throws the expected error when mounted outside a FmNotificationsProvider', () => {
    // Silence the expected React error noise.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() =>
      render(<ActivityClient userId="fm-alice" initial={[]} />)
    ).toThrow(/FmNotificationsProvider/i)
    spy.mockRestore()
  })
})
