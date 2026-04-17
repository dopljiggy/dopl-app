import { describe, it, expect, vi, beforeEach } from 'vitest'

// The SnapTrade client reads credentials from env at module init.
// Set stubs before the import so construction doesn't throw.
beforeEach(() => {
  vi.stubEnv('SNAPTRADE_CLIENT_ID', 'test-client-id')
  vi.stubEnv('SNAPTRADE_CONSUMER_KEY', 'test-consumer-key')
})

describe('snaptrade client', () => {
  it('module imports without throwing', async () => {
    const mod = await import('@/lib/snaptrade')
    expect(mod).toBeDefined()
  })

  it('exports a client object (or expected shape)', async () => {
    const mod = await import('@/lib/snaptrade')
    // The module should export something we can reference. We don't
    // pin the shape too tightly — this is a sanity check the module
    // loads cleanly under vitest with env stubs in place.
    expect(Object.keys(mod).length).toBeGreaterThan(0)
  })
})
