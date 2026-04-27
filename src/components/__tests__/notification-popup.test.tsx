import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NotificationPopup } from '@/components/ui/notification-popup'

afterEach(() => vi.restoreAllMocks())

describe('NotificationPopup — stale-actionable guard', () => {
  it('renders "view portfolio" CTA when notification.meta.portfolio_id is not in the dopler active-subs set', () => {
    render(
      <NotificationPopup
        notification={{
          id: 'n1',
          title: 'TechGrowth',
          body: 'bought AAPL',
          created_at: new Date().toISOString(),
          actionable: true,
          meta: { portfolio_id: 'p-old' },
        }}
        brokerPreference="Fidelity"
        activeSubscribedPortfolioIds={new Set(['p-new'])}
        onClose={() => {}}
      />
    )
    expect(screen.getByText(/view portfolio/i)).toBeInTheDocument()
    expect(screen.queryByText(/dopl AAPL/i)).not.toBeInTheDocument()
  })

  it('renders deep-link dopl CTA + view-portfolio secondary when portfolio_id IS in the active-subs set', () => {
    render(
      <NotificationPopup
        notification={{
          id: 'n1',
          title: 'TechGrowth',
          body: 'bought AAPL',
          created_at: new Date().toISOString(),
          actionable: true,
          meta: { portfolio_id: 'p-active' },
        }}
        brokerPreference="Fidelity"
        activeSubscribedPortfolioIds={new Set(['p-active'])}
        onClose={() => {}}
      />
    )
    expect(
      screen.getByText(/dopl AAPL on Fidelity/i)
    ).toBeInTheDocument()
    expect(screen.getByText(/view portfolio/i)).toBeInTheDocument()
  })

  it('renders deep-link dopl CTA with no view-portfolio secondary when meta.portfolio_id is missing (legacy row)', () => {
    render(
      <NotificationPopup
        notification={{
          id: 'n1',
          title: 'TechGrowth',
          body: 'bought AAPL',
          created_at: new Date().toISOString(),
          actionable: true,
          meta: null,
        }}
        brokerPreference="Fidelity"
        activeSubscribedPortfolioIds={new Set()}
        onClose={() => {}}
      />
    )
    expect(
      screen.getByText(/dopl AAPL on Fidelity/i)
    ).toBeInTheDocument()
    expect(screen.queryByText(/view portfolio/i)).not.toBeInTheDocument()
  })
})

describe('NotificationPopup — broker preference CTA', () => {
  it('prefers typed ticker over regex extraction and uses the broker pattern URL', () => {
    render(
      <NotificationPopup
        notification={{
          id: 'n1',
          title: 'TechGrowth',
          body: 'some body text without a ticker token',
          created_at: new Date().toISOString(),
          actionable: true,
          ticker: 'NVDA',
          change_type: 'buy',
          meta: { portfolio_id: 'p-active' },
        }}
        brokerPreference="Robinhood"
        activeSubscribedPortfolioIds={new Set(['p-active'])}
        onClose={() => {}}
      />
    )
    const link = screen.getByRole('link', {
      name: /dopl NVDA on Robinhood/i,
    })
    expect(link).toHaveAttribute('href', 'https://robinhood.com/stocks/NVDA')
  })

  it('labels the ticker card "sold" when change_type is sell', () => {
    render(
      <NotificationPopup
        notification={{
          id: 'n2',
          title: 'TechGrowth',
          body: 'sold AAPL',
          created_at: new Date().toISOString(),
          actionable: true,
          ticker: 'AAPL',
          change_type: 'sell',
          meta: { portfolio_id: 'p-active' },
        }}
        brokerPreference="Robinhood"
        activeSubscribedPortfolioIds={new Set(['p-active'])}
        onClose={() => {}}
      />
    )
    expect(screen.getByText(/^sold$/i)).toBeInTheDocument()
  })

  it('shows "set your broker" CTA when dopler has no broker preference', () => {
    render(
      <NotificationPopup
        notification={{
          id: 'n3',
          title: 'TechGrowth',
          body: 'bought AAPL',
          created_at: new Date().toISOString(),
          actionable: true,
          ticker: 'AAPL',
          change_type: 'buy',
        }}
        brokerPreference={null}
        onClose={() => {}}
      />
    )
    expect(
      screen.getByText(/set your broker in settings/i)
    ).toBeInTheDocument()
  })

  it('hides broker CTA when preference is "Other"', () => {
    render(
      <NotificationPopup
        notification={{
          id: 'n4',
          title: 'TechGrowth',
          body: 'bought AAPL',
          created_at: new Date().toISOString(),
          actionable: true,
          ticker: 'AAPL',
          change_type: 'buy',
        }}
        brokerPreference="Other"
        onClose={() => {}}
      />
    )
    expect(screen.queryByText(/dopl AAPL on/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/set your broker/i)).not.toBeInTheDocument()
    expect(screen.getByText(/copy AAPL/i)).toBeInTheDocument()
  })

  it('falls back to broker homepage for unmatched broker with ticker', () => {
    render(
      <NotificationPopup
        notification={{
          id: 'n5',
          title: 'TechGrowth',
          body: 'bought AAPL',
          created_at: new Date().toISOString(),
          actionable: true,
          ticker: 'AAPL',
          change_type: 'buy',
          meta: { portfolio_id: 'p-active' },
        }}
        brokerPreference="Coinbase"
        activeSubscribedPortfolioIds={new Set(['p-active'])}
        onClose={() => {}}
      />
    )
    const link = screen.getByRole('link', {
      name: /dopl AAPL on Coinbase/i,
    })
    expect(link).toHaveAttribute('href', 'https://www.coinbase.com')
  })
})
