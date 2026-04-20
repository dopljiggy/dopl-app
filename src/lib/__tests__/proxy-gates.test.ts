import { describe, it, expect } from 'vitest'
import { doplerNeedsOnboarding } from '@/lib/proxy-gates'

describe('doplerNeedsOnboarding', () => {
  it('returns true when subscriber is not connected and hits /feed', () => {
    expect(
      doplerNeedsOnboarding({ role: 'subscriber', tradingConnected: false, path: '/feed' })
    ).toBe(true)
  })

  it('returns true for nested feed paths', () => {
    expect(
      doplerNeedsOnboarding({ role: 'subscriber', tradingConnected: false, path: '/feed/portfolio-uuid' })
    ).toBe(true)
  })

  it('returns false when the subscriber has connected a broker', () => {
    expect(
      doplerNeedsOnboarding({ role: 'subscriber', tradingConnected: true, path: '/feed' })
    ).toBe(false)
  })

  it('returns false for fund managers even if they somehow hit /feed', () => {
    expect(
      doplerNeedsOnboarding({ role: 'fund_manager', tradingConnected: false, path: '/feed' })
    ).toBe(false)
  })

  it('returns false for non-feed paths', () => {
    expect(
      doplerNeedsOnboarding({ role: 'subscriber', tradingConnected: false, path: '/leaderboard' })
    ).toBe(false)
  })
})
