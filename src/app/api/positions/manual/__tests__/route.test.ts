import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const ORIGINAL_ENV = { ...process.env }

const revalidatePath = vi.fn()
vi.mock('next/cache', () => ({ revalidatePath }))

// Mock the fanout helper so the test can assert call shape + count without
// dragging the real supabase admin client into the test path.
const fanOutPortfolioUpdate = vi.fn(() =>
  Promise.resolve({ ok: true, notified: 0, update_id: '' })
)
vi.mock('@/lib/notification-fanout', () => ({
  fanOutPortfolioUpdate,
}))

// The route passes `createAdminClient()` to the fanout helper. Since the
// helper is mocked, the client argument is never touched — a stub is fine.
vi.mock('@/lib/supabase-admin', () => ({
  createAdminClient: () => ({}),
}))

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
    fanOutPortfolioUpdate.mockClear()
    tableResponses = {}
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
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
    // Manual Holdings path: no fanout.
    expect(fanOutPortfolioUpdate).not.toHaveBeenCalled()
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
    expect(
      calls.some(
        (p) => p?.startsWith('/') && !p.startsWith('/dashboard') && !p.startsWith('/feed')
      )
    ).toBe(false)
  })

  it('DELETE revalidates surfaces for a Manual Holdings position without firing fanout', async () => {
    tableResponses = {
      positions: {
        maybeSingle: {
          id: 'pos-id-1',
          ticker: 'AAPL',
          shares: 10,
          portfolio_id: 'pf-manual',
          portfolios: { fund_manager_id: 'fm-uuid-1', name: 'Manual Holdings' },
        },
      },
      fund_managers: { maybeSingle: { handle: 'alice' } },
    }
    const { DELETE } = await importRoute()
    const res = await DELETE(makeDeleteRequest({ id: 'pos-id-1' }))
    expect(res.status).toBe(200)
    const calls = revalidatePath.mock.calls.map((c) => c[0])
    expect(calls).toContain('/dashboard')
    expect(calls).toContain('/dashboard/portfolios')
    expect(calls).toContain('/feed/pf-manual')
    expect(calls).toContain('/alice')
    expect(fanOutPortfolioUpdate).not.toHaveBeenCalled()
  })
})

describe('/api/positions/manual Sprint 6 portfolio_id + fanout', () => {
  beforeEach(() => {
    revalidatePath.mockClear()
    fanOutPortfolioUpdate.mockClear()
    tableResponses = {}
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it('POST with portfolio_id writes to that portfolio and fires a buy fanout', async () => {
    tableResponses = {
      portfolios: {
        maybeSingle: { id: 'pf-named-1', fund_manager_id: 'fm-uuid-1' },
      },
      positions: { maybeSingle: null, single: { id: 'pos-id-7' } },
      fund_managers: { maybeSingle: { handle: 'alice' } },
    }
    const { POST } = await importRoute()
    const res = await POST(
      makePostRequest({
        portfolio_id: 'pf-named-1',
        ticker: 'AAPL',
        shares: 5,
        current_price: 180,
      })
    )
    expect(res.status).toBe(200)
    expect(fanOutPortfolioUpdate).toHaveBeenCalledTimes(1)
    const [, input] = fanOutPortfolioUpdate.mock.calls[0]
    expect(input).toMatchObject({
      portfolio_id: 'pf-named-1',
      fund_manager_id: 'fm-uuid-1',
      changes: [{ type: 'buy', ticker: 'AAPL', shares: 5 }],
    })
  })

  it('POST with a portfolio_id owned by another user returns 403', async () => {
    tableResponses = {
      portfolios: {
        maybeSingle: { id: 'pf-theirs', fund_manager_id: 'other-fm' },
      },
    }
    const { POST } = await importRoute()
    const res = await POST(
      makePostRequest({ portfolio_id: 'pf-theirs', ticker: 'AAPL' })
    )
    expect(res.status).toBe(403)
    expect(fanOutPortfolioUpdate).not.toHaveBeenCalled()
  })

  it('POST upsert (existing ticker, shares changed) fires a rebalance fanout', async () => {
    tableResponses = {
      portfolios: {
        maybeSingle: { id: 'pf-named-1', fund_manager_id: 'fm-uuid-1' },
      },
      // Hotfix R1 H4: upsert path now fires a rebalance fanout when
      // shares actually changed (no-op guard prevents spam).
      positions: { maybeSingle: { id: 'pos-existing', shares: 10 } },
      fund_managers: { maybeSingle: { handle: 'alice' } },
    }
    const { POST } = await importRoute()
    const res = await POST(
      makePostRequest({
        portfolio_id: 'pf-named-1',
        ticker: 'AAPL',
        shares: 25,
        current_price: 189.5,
        thesis_note: 'doubling down',
      })
    )
    expect(res.status).toBe(200)
    expect(fanOutPortfolioUpdate).toHaveBeenCalledTimes(1)
    const [, input] = fanOutPortfolioUpdate.mock.calls[0]
    expect(input).toMatchObject({
      portfolio_id: 'pf-named-1',
      fund_manager_id: 'fm-uuid-1',
      changes: [
        {
          type: 'rebalance',
          ticker: 'AAPL',
          prevShares: 10,
          shares: 25,
          price: 189.5,
        },
      ],
      thesis_note: 'doubling down',
    })
  })

  it('POST upsert (existing ticker, shares unchanged) does NOT fire fanout', async () => {
    tableResponses = {
      portfolios: {
        maybeSingle: { id: 'pf-named-1', fund_manager_id: 'fm-uuid-1' },
      },
      // No-op guard: re-submitting the same share count (or refreshing
      // current_price without changing shares) shouldn't notify doplers.
      positions: { maybeSingle: { id: 'pos-existing', shares: 10 } },
      fund_managers: { maybeSingle: { handle: 'alice' } },
    }
    const { POST } = await importRoute()
    const res = await POST(
      makePostRequest({
        portfolio_id: 'pf-named-1',
        ticker: 'AAPL',
        shares: 10,
        current_price: 200,
      })
    )
    expect(res.status).toBe(200)
    expect(fanOutPortfolioUpdate).not.toHaveBeenCalled()
  })

  it('DELETE from a named portfolio fires a sell fanout with prevShares', async () => {
    tableResponses = {
      positions: {
        maybeSingle: {
          id: 'pos-id-1',
          ticker: 'AAPL',
          shares: 10,
          portfolio_id: 'pf-named-1',
          portfolios: { fund_manager_id: 'fm-uuid-1', name: 'TechGrowth' },
        },
      },
      fund_managers: { maybeSingle: { handle: 'alice' } },
    }
    const { DELETE } = await importRoute()
    const res = await DELETE(makeDeleteRequest({ id: 'pos-id-1' }))
    expect(res.status).toBe(200)
    expect(fanOutPortfolioUpdate).toHaveBeenCalledTimes(1)
    const [, input] = fanOutPortfolioUpdate.mock.calls[0]
    expect(input).toMatchObject({
      portfolio_id: 'pf-named-1',
      fund_manager_id: 'fm-uuid-1',
      changes: [{ type: 'sell', ticker: 'AAPL', prevShares: 10 }],
    })
  })

  it('DELETE of a position the FM does not own returns 403', async () => {
    tableResponses = {
      positions: {
        maybeSingle: {
          id: 'pos-id-1',
          ticker: 'AAPL',
          shares: 10,
          portfolio_id: 'pf-x',
          portfolios: { fund_manager_id: 'different-fm', name: 'Theirs' },
        },
      },
    }
    const { DELETE } = await importRoute()
    const res = await DELETE(makeDeleteRequest({ id: 'pos-id-1' }))
    expect(res.status).toBe(403)
    expect(fanOutPortfolioUpdate).not.toHaveBeenCalled()
  })
})
