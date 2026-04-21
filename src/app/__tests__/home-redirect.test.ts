/**
 * Home page no longer redirects authed users. Sprint 4 replaced the
 * `determineAuthedHomeTarget` redirect with a UserChip rendered by
 * MarketingLanding. Both authed and unauthed users see `/`.
 *
 * The helper was removed; this test file is kept as a minimal guard
 * against accidental re-introduction of the redirect path.
 */
import { describe, it, expect } from 'vitest'

describe('home page (no-redirect behavior)', () => {
  it('does not re-export determineAuthedHomeTarget (sanity)', async () => {
    const mod = await import('@/app/page')
    expect((mod as Record<string, unknown>).determineAuthedHomeTarget).toBeUndefined()
  })
})
