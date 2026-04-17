import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.resetModules()
})

describe('@/lib/stripe', () => {
  it('importing the module does not throw when STRIPE_SECRET_KEY is unset', async () => {
    delete process.env.STRIPE_SECRET_KEY
    await expect(import('../stripe')).resolves.toBeDefined()
  })

  it('DOPL_FEE_PERCENT is exported as 10 regardless of env', async () => {
    delete process.env.STRIPE_SECRET_KEY
    const mod = await import('../stripe')
    expect(mod.DOPL_FEE_PERCENT).toBe(10)
  })

  it('getStripe() throws a clear error when STRIPE_SECRET_KEY is unset', async () => {
    delete process.env.STRIPE_SECRET_KEY
    const mod = await import('../stripe')
    expect(() => mod.getStripe()).toThrow(/STRIPE_SECRET_KEY/)
  })

  it('getStripe() returns a Stripe instance when env is set, and memoizes', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
    const mod = await import('../stripe')
    const first = mod.getStripe()
    const second = mod.getStripe()
    expect(first).toBe(second)
    expect(typeof first.checkout).toBe('object')
  })
})
