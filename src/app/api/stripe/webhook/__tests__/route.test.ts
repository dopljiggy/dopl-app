import { describe, it, expect, afterEach, vi } from 'vitest'

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.resetModules()
})

describe('@/app/api/stripe/webhook/route', () => {
  it('importing the module does not throw when NEXT_PUBLIC_SUPABASE_URL is unset', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
    await expect(import('../route')).resolves.toBeDefined()
  })

  it('importing the module does not throw when SUPABASE_SERVICE_ROLE_KEY is unset', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
    await expect(import('../route')).resolves.toBeDefined()
  })

  it('importing the module does not throw when STRIPE_SECRET_KEY is unset', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
    delete process.env.STRIPE_SECRET_KEY
    await expect(import('../route')).resolves.toBeDefined()
  })
})
