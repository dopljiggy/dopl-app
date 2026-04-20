import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import NotificationsClient from '../notifications-client'
import { NotificationsProvider } from '@/components/notifications-context'

// Spy on useNotifications — it must NOT be called by NotificationsClient.
vi.mock('@/hooks/use-notifications', () => ({
  useNotifications: vi.fn(() => {
    throw new Error('useNotifications should not be called in NotificationsClient')
  }),
}))

describe('NotificationsClient', () => {
  it('consumes context instead of calling useNotifications directly', () => {
    const value = {
      notifications: [],
      unreadCount: 0,
      markAllRead: vi.fn(async () => {}),
    }
    // Should not throw — it reads from the provider, not the hook.
    expect(() =>
      render(
        <NotificationsProvider value={value}>
          <NotificationsClient
            tradingConnected={false}
            tradingName={null}
            tradingWebsite={null}
          />
        </NotificationsProvider>
      )
    ).not.toThrow()
  })
})
