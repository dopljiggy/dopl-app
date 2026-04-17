import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const ORIGINAL_ENV = { ...process.env }

const mockUser = { id: 'user-uuid-1', email: 'alice@example.com' }

// Mock the server supabase client. Returns a getUser() that yields our mockUser.
vi.mock('@/lib/supabase-server', () => ({
  createServerSupabase: async () => ({
    auth: { getUser: async () => ({ data: { user: mockUser } }) },
    from: vi.fn(),
  }),
}))

async function importRoute() {
  vi.resetModules()
  return await import('../route')
}

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/profile', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('/api/profile PATCH validation', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
    vi.restoreAllMocks()
  })

  it('400 when display_name is empty string', async () => {
    const { PATCH } = await importRoute()
    const res = await PATCH(makeRequest({ display_name: '', handle: 'alice' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/display.?name/i)
  })

  it('400 when display_name is whitespace only', async () => {
    const { PATCH } = await importRoute()
    const res = await PATCH(makeRequest({ display_name: '   ', handle: 'alice' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/display.?name/i)
  })

  it('400 when display_name is missing', async () => {
    const { PATCH } = await importRoute()
    const res = await PATCH(makeRequest({ handle: 'alice' }))
    expect(res.status).toBe(400)
  })

  it('400 when handle is missing', async () => {
    const { PATCH } = await importRoute()
    const res = await PATCH(makeRequest({ display_name: 'Alice Hedge' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/handle/i)
  })

  it('400 when handle has invalid characters', async () => {
    const { PATCH } = await importRoute()
    const res = await PATCH(
      makeRequest({ display_name: 'Alice Hedge', handle: 'alice space' })
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/handle/i)
  })

  it('400 when handle is too short (1 char)', async () => {
    const { PATCH } = await importRoute()
    const res = await PATCH(
      makeRequest({ display_name: 'Alice Hedge', handle: 'a' })
    )
    expect(res.status).toBe(400)
  })

  it('400 when handle has uppercase (should be normalized client-side, but server rejects to be safe)', async () => {
    const { PATCH } = await importRoute()
    const res = await PATCH(
      makeRequest({ display_name: 'Alice Hedge', handle: 'Alice' })
    )
    expect(res.status).toBe(400)
  })
})
