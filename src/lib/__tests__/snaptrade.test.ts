import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveSnaptradeCredentials } from '@/lib/snaptrade'

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
    expect(Object.keys(mod).length).toBeGreaterThan(0)
  })
})

describe('resolveSnaptradeCredentials', () => {
  const prodEnv = {
    SNAPTRADE_CLIENT_ID: 'prod-client',
    SNAPTRADE_CONSUMER_KEY: 'prod-key',
  } as unknown as NodeJS.ProcessEnv

  it('returns production credentials when SNAPTRADE_SANDBOX is not set', () => {
    const resolved = resolveSnaptradeCredentials(prodEnv)
    expect(resolved.mode).toBe('production')
    expect(resolved.clientId).toBe('prod-client')
    expect(resolved.consumerKey).toBe('prod-key')
  })

  it('routes to sandbox credentials when toggle + both sandbox creds are set', () => {
    const resolved = resolveSnaptradeCredentials({
      ...prodEnv,
      SNAPTRADE_SANDBOX: 'true',
      SNAPTRADE_SANDBOX_CLIENT_ID: 'sandbox-client',
      SNAPTRADE_SANDBOX_CONSUMER_KEY: 'sandbox-key',
    } as unknown as NodeJS.ProcessEnv)
    expect(resolved.mode).toBe('sandbox')
    expect(resolved.clientId).toBe('sandbox-client')
    expect(resolved.consumerKey).toBe('sandbox-key')
  })

  it('falls back to production credentials when sandbox toggle is on but credentials are missing', () => {
    const resolved = resolveSnaptradeCredentials({
      ...prodEnv,
      SNAPTRADE_SANDBOX: 'true',
      // sandbox client/key intentionally missing
    } as unknown as NodeJS.ProcessEnv)
    expect(resolved.mode).toBe('production')
    expect(resolved.clientId).toBe('prod-client')
  })

  it('passes basePath through when SNAPTRADE_BASE_URL is set', () => {
    const resolved = resolveSnaptradeCredentials({
      ...prodEnv,
      SNAPTRADE_BASE_URL: 'https://sandbox.example.com/api/v1',
    } as unknown as NodeJS.ProcessEnv)
    expect(resolved.basePath).toBe('https://sandbox.example.com/api/v1')
  })

  it('leaves basePath undefined when SNAPTRADE_BASE_URL is empty or unset', () => {
    const resolved = resolveSnaptradeCredentials(prodEnv)
    expect(resolved.basePath).toBeUndefined()
  })
})
