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
        tradingConnected
        tradingName="Fidelity"
        tradingWebsite="https://fidelity.com"
        activeSubscribedPortfolioIds={new Set(['p-new'])}
        onClose={() => {}}
      />
    )
    // Guard triggers — "view portfolio" is the ONLY action. The Sprint 7
    // deep-link CTA (`dopl AAPL on Fidelity`) must NOT render when the
    // subscription is stale.
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
        tradingConnected
        tradingName="Fidelity"
        tradingWebsite="https://fidelity.com"
        activeSubscribedPortfolioIds={new Set(['p-active'])}
        onClose={() => {}}
      />
    )
    // Primary: ticker-scoped broker deep-link copy. Secondary (Sprint 7):
    // always-present "view portfolio" link when notifPortfolioId resolves.
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
        tradingConnected
        tradingName="Fidelity"
        tradingWebsite="https://fidelity.com"
        activeSubscribedPortfolioIds={new Set()}
        onClose={() => {}}
      />
    )
    // No portfolio_id → permissive fallback: deep-link CTA still
    // renders (we can't tell the subscription is stale), and the
    // view-portfolio secondary is suppressed since we don't know where
    // to link to.
    expect(
      screen.getByText(/dopl AAPL on Fidelity/i)
    ).toBeInTheDocument()
    expect(screen.queryByText(/view portfolio/i)).not.toBeInTheDocument()
  })
})

describe('NotificationPopup — Sprint 7 deep-link CTA', () => {
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
        tradingConnected
        tradingName="Robinhood"
        tradingWebsite="https://robinhood.com"
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
        tradingConnected
        tradingName="Robinhood"
        tradingWebsite="https://robinhood.com"
        activeSubscribedPortfolioIds={new Set(['p-active'])}
        onClose={() => {}}
      />
    )
    expect(screen.getByText(/^sold$/i)).toBeInTheDocument()
  })

  it('shows "connect your broker" CTA when dopler has no trading connection', () => {
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
        tradingConnected={false}
        tradingName={null}
        tradingWebsite={null}
        onClose={() => {}}
      />
    )
    expect(
      screen.getByText(/connect your broker to dopl instantly/i)
    ).toBeInTheDocument()
  })
})
