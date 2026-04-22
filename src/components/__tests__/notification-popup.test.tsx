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
    // Guard triggers — CTA is "view portfolio", NOT the broker-action "open Fidelity".
    expect(screen.getByText(/view portfolio/i)).toBeInTheDocument()
    expect(screen.queryByText(/open Fidelity/i)).not.toBeInTheDocument()
  })

  it('renders broker-action CTA when portfolio_id IS in the active-subs set', () => {
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
    expect(screen.getByText(/open Fidelity/i)).toBeInTheDocument()
    expect(screen.queryByText(/^view portfolio$/i)).not.toBeInTheDocument()
  })

  it('falls back to broker-action CTA when meta.portfolio_id is missing (legacy row)', () => {
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
    // No portfolio_id → permissive fallback: broker CTA renders.
    expect(screen.getByText(/open Fidelity/i)).toBeInTheDocument()
  })
})
