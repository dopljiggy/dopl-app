import { describe, it, expect } from 'vitest'
import { fmNeedsOnboarding } from '@/lib/onboarding-gates'

describe('fmNeedsOnboarding', () => {
  it('true when fm row is missing', () => {
    expect(fmNeedsOnboarding(null, 0)).toBe(true)
  })

  it('true when fm has no bio and no portfolios', () => {
    expect(fmNeedsOnboarding({ bio: null, broker_connected: false }, 0)).toBe(true)
  })

  it('false when fm has at least one portfolio (implies onboarding touched)', () => {
    expect(fmNeedsOnboarding({ bio: null, broker_connected: false }, 1)).toBe(false)
  })

  it('false when fm has a bio (they edited their profile)', () => {
    expect(fmNeedsOnboarding({ bio: 'alpha manager', broker_connected: false }, 0)).toBe(false)
  })

  it('false when broker is connected', () => {
    expect(fmNeedsOnboarding({ bio: null, broker_connected: true }, 0)).toBe(false)
  })
})
