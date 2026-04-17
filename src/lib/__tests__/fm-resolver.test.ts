import { describe, it, expect } from 'vitest'
import { resolveFm, norm } from '@/lib/fm-resolver'

describe('norm', () => {
  it('returns null for non-strings', () => {
    expect(norm(null)).toBeNull()
    expect(norm(undefined)).toBeNull()
    expect(norm(42)).toBeNull()
  })

  it('returns null for empty or whitespace-only strings', () => {
    expect(norm('')).toBeNull()
    expect(norm('   ')).toBeNull()
  })

  it('trims and returns non-empty strings', () => {
    expect(norm('  alice  ')).toBe('alice')
    expect(norm('alice')).toBe('alice')
  })
})

describe('resolveFm', () => {
  it('fm has display_name → returns display_name', () => {
    const result = resolveFm(
      { display_name: 'Alice Hedge', handle: 'alice', avatar_url: '/a.png' },
      { full_name: 'Alice Smith', email: 'alice@example.com' }
    )
    expect(result.display_name).toBe('Alice Hedge')
    expect(result.handle).toBe('alice')
    expect(result.avatar_url).toBe('/a.png')
  })

  it('fm has no display_name but profile has full_name → returns full_name', () => {
    const result = resolveFm(
      { display_name: null, handle: 'alice', avatar_url: null },
      { full_name: 'Alice Smith', email: 'alice@example.com' }
    )
    expect(result.display_name).toBe('Alice Smith')
    expect(result.handle).toBe('alice')
  })

  it('fm has handle, no names anywhere → returns handle', () => {
    const result = resolveFm(
      { display_name: '   ', handle: 'alice', avatar_url: null },
      { full_name: null, email: null }
    )
    expect(result.display_name).toBe('alice')
    expect(result.handle).toBe('alice')
  })

  it('nothing resolves → returns "fund manager" (pinning current fallback)', () => {
    const result = resolveFm(
      { display_name: null, handle: null, avatar_url: null },
      { full_name: null, email: null }
    )
    expect(result.display_name).toBe('fund manager')
    expect(result.handle).toBeNull()
    expect(result.avatar_url).toBeNull()
  })

  it('fm missing, profile has email → handle derived from email local part', () => {
    const result = resolveFm(undefined, { full_name: null, email: 'yazan@gmail.com' })
    expect(result.handle).toBe('yazan')
    expect(result.display_name).toBe('yazan')
  })

  it('broker_provider passes through from fm row', () => {
    const result = resolveFm(
      { display_name: 'Alice', handle: 'alice', broker_provider: 'snaptrade' },
      undefined
    )
    expect(result.broker_provider).toBe('snaptrade')
  })
})
