import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MeClient, { type MeSubscription } from '../me-client'
import { NotificationsProvider } from '@/components/notifications-context'

function stubProviderValue() {
  return {
    notifications: [],
    unreadCount: 0,
    markAllRead: vi.fn(async () => {}),
    activeSubscribedPortfolioIds: new Set<string>(),
  }
}

function makeSub(overrides: Partial<MeSubscription> = {}): MeSubscription {
  return {
    id: overrides.id ?? 'sub-1',
    // Use `in`-check so `price_cents: null` overrides don't silently
    // fall back to the default.
    price_cents: 'price_cents' in overrides ? overrides.price_cents ?? null : 1500,
    created_at: overrides.created_at ?? new Date().toISOString(),
    portfolio: overrides.portfolio ?? {
      id: 'p-1',
      name: 'TechGrowth',
      tier: 'core',
      price_cents: 1500,
    },
    fund_manager: overrides.fund_manager ?? {
      id: 'fm-1',
      handle: 'alice',
      display_name: 'Alice',
    },
  }
}

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(global as any).fetch = fetchMock
})

afterEach(() => {
  vi.restoreAllMocks()
})

function renderMe(subs: MeSubscription[]) {
  return render(
    <NotificationsProvider value={stubProviderValue()}>
      <MeClient userId="u-1" subscriptions={subs} />
    </NotificationsProvider>
  )
}

describe('MeClient', () => {
  it('renders subscription cards with handle + name + price', () => {
    renderMe([
      makeSub({
        id: 's-1',
        price_cents: 1500,
        portfolio: {
          id: 'p-1',
          name: 'TechGrowth',
          tier: 'core',
          price_cents: 1500,
        },
        fund_manager: {
          id: 'fm-1',
          handle: 'alice',
          display_name: 'Alice',
        },
      }),
    ])
    expect(screen.getByText('@alice')).toBeInTheDocument()
    expect(screen.getByText('TechGrowth')).toBeInTheDocument()
    expect(screen.getByText(/\$15\/mo/)).toBeInTheDocument()
  })

  it('monthly spend = sum of active sub prices / 100', () => {
    renderMe([
      makeSub({ id: 's-1', price_cents: 1500 }),
      makeSub({ id: 's-2', price_cents: 2500 }),
      makeSub({ id: 's-3', price_cents: null }), // free tier
    ])
    // 1500 + 2500 + 0 = 4000 cents = $40
    expect(screen.getByText(/\$40\b/)).toBeInTheDocument()
  })

  it('cancel → two-click confirm → DELETE fetch → row removed on success', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    })
    renderMe([makeSub({ id: 's-delete-me' })])
    const cancelBtn = screen.getByRole('button', { name: /^cancel$/i })
    fireEvent.click(cancelBtn)
    // First click: flips to "confirm cancel", no fetch yet.
    expect(
      await screen.findByRole('button', { name: /confirm cancel/i })
    ).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /confirm cancel/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/subscriptions',
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ subscription_id: 's-delete-me' }),
      })
    )

    // Row fades out — TechGrowth name no longer in DOM (or in exit transition).
    await waitFor(() =>
      expect(screen.queryByText('TechGrowth')).not.toBeInTheDocument()
    )
  })

  it('cancel failure surfaces <InlineError> and row stays', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'stripe timed out' }),
    })
    renderMe([makeSub({ id: 's-fail' })])
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    fireEvent.click(
      await screen.findByRole('button', { name: /confirm cancel/i })
    )
    await waitFor(() =>
      expect(screen.getByText(/stripe timed out/i)).toBeInTheDocument()
    )
    // Row still rendered.
    expect(screen.getByText('TechGrowth')).toBeInTheDocument()
  })

  it('empty state renders "not dopling yet" copy + /leaderboard CTA', () => {
    renderMe([])
    expect(
      screen.getByText(/not dopling anyone yet/i)
    ).toBeInTheDocument()
    const cta = screen.getByRole('link', { name: /discover fund managers/i })
    expect(cta).toHaveAttribute('href', '/leaderboard')
  })
})
