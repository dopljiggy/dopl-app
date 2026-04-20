import { describe, it, expect } from 'vitest'
import { determineAuthedHomeTarget } from '@/app/page'

type Profile = { role?: 'fund_manager' | 'subscriber' | null; trading_connected?: boolean | null }

describe('determineAuthedHomeTarget', () => {
  it('returns null for unauthed users (show marketing)', () => {
    expect(determineAuthedHomeTarget(null, null)).toBeNull()
  })

  it('returns /dashboard for fund managers', () => {
    const profile: Profile = { role: 'fund_manager', trading_connected: false }
    expect(determineAuthedHomeTarget({ id: 'u1' }, profile)).toBe('/dashboard')
  })

  it('returns /feed for connected subscribers', () => {
    const profile: Profile = { role: 'subscriber', trading_connected: true }
    expect(determineAuthedHomeTarget({ id: 'u2' }, profile)).toBe('/feed')
  })

  it('returns /welcome for subscribers without trading connection', () => {
    const profile: Profile = { role: 'subscriber', trading_connected: false }
    expect(determineAuthedHomeTarget({ id: 'u3' }, profile)).toBe('/welcome')
  })

  it('returns null when profile row is missing (defensive — show marketing, don\'t hard-fail)', () => {
    expect(determineAuthedHomeTarget({ id: 'u4' }, null)).toBeNull()
  })
})
