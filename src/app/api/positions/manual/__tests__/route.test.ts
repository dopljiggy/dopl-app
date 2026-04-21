import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const ORIGINAL_ENV = { ...process.env }

const revalidatePath = vi.fn()
vi.mock('next/cache', () => ({ revalidatePath }))

const mockUser = { id: 'fm-uuid-1', email: 'alice@example.com' }

// Mutable per-test state that the supabase mock reads from. Each key
// maps a supabase table to the `.maybeSingle()` / `.single()` payload
// the route should see when it touches that table. Terminal chains
// without maybeSingle/single (e.g. `.update(..).eq(..)`) resolve as
// `{ data: null, error: null }` via the `then` fallback below.
let tableResponses: Record<
  string,
  { maybeSingle?: unknown; single?: unknown }
> = {}

vi.mock('@/lib/supabase-server', () => ({
  createServerSupabase: async () => ({
    auth: { getUser: async () => ({ data: { user: mockUser }, error: null }) },
    from: (tableName: string) => {
      const state = tableResponses[tableName] ?? {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {
        select: () => chain,
        insert: () => chain,
        update: () => chain,
        delete: () => chain,
        eq: () => chain,
        order: () => chain,
        maybeSingle: async () => ({
          data: state.maybeSingle ?? null,
          error: null,
        }),
        single: async () => ({ data: state.single ?? null, error: null }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        then: (resolve: any) => resolve({ data: null, error: null }),
      }
      return chain
    },
  }),
}))

async function importRoute() {
  return await import('../route')
}

function makePostRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/positions/manual', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeDeleteRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/positions/manual', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('/api/positions/manual revalidation', () => {
  beforeEach(() => {
    revalidatePath.mockClear()
    tableResponses = {}
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it('POST insert revalidates /dashboard, /dashboard/portfolios, /feed/[id], and /[handle]', async () => {
    tableResponses = {
      portfolios: { maybeSingle: { id: 'pf-id-1' } },
      positions: { maybeSingle: null, single: { id: 'pos-id-1' } },
      fund_managers: { maybeSingle: { handle: 'alice' } },
    }
    const { POST } = await importRoute()
    const res = await POST(makePostRequest({ ticker: 'AAPL', shares: 10 }))
    expect(res.status).toBe(200)
    const calls = revalidatePath.mock.calls.map((c) => c[0])
    expect(calls).toContain('/dashboard')
    expect(calls).toContain('/dashboard/portfolios')
    expect(calls).toContain('/feed/pf-id-1')
    expect(calls).toContain('/alice')
  })

  it('POST insert skips /[handle] when handle is unresolvable', async () => {
    tableResponses = {
      portfolios: { maybeSingle: { id: 'pf-id-1' } },
      positions: { maybeSingle: null, single: { id: 'pos-id-1' } },
      fund_managers: { maybeSingle: null },
    }
    const { POST } = await importRoute()
    const res = await POST(makePostRequest({ ticker: 'AAPL', shares: 10 }))
    expect(res.status).toBe(200)
    const calls = revalidatePath.mock.calls.map((c) => c[0])
    expect(calls).toContain('/dashboard')
    expect(calls).toContain('/dashboard/portfolios')
    expect(calls).toContain('/feed/pf-id-1')
    // No handle-based revalidation when the FM handle doesn't resolve.
    expect(calls.some((p) => p?.startsWith('/') && !p.startsWith('/dashboard') && !p.startsWith('/feed'))).toBe(false)
  })

  it('DELETE also revalidates the same surfaces', async () => {
    tableResponses = {
      portfolios: { maybeSingle: { id: 'pf-id-1' } },
      fund_managers: { maybeSingle: { handle: 'alice' } },
    }
    const { DELETE } = await importRoute()
    const res = await DELETE(makeDeleteRequest({ id: 'pos-id-1' }))
    expect(res.status).toBe(200)
    const calls = revalidatePath.mock.calls.map((c) => c[0])
    expect(calls).toContain('/dashboard')
    expect(calls).toContain('/dashboard/portfolios')
    expect(calls).toContain('/feed/pf-id-1')
    expect(calls).toContain('/alice')
  })
})
