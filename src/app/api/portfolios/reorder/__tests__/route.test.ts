import { describe, it, expect, beforeEach, vi } from 'vitest'

// Sprint 17: PATCH /api/portfolios/reorder. Tests cover the auth +
// ownership boundaries; the body of the work is N small UPDATEs so
// route-level coverage is enough.

let mockUser: { id: string } | null = { id: 'fm-uuid-1' }

// What admin.from('portfolios').select('id, fund_manager_id').in('id', ids)
// resolves to. Each test sets this to control the ownership branch.
let adminPortfoliosOwnership: { id: string; fund_manager_id: string }[] = []

// Spy on update calls so a happy path can assert N rows were touched
// without re-implementing supabase update semantics.
const updateSpy = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  createServerSupabase: async () => ({
    auth: {
      getUser: async () => ({ data: { user: mockUser }, error: null }),
    },
  }),
}))

vi.mock('@/lib/supabase-admin', () => ({
  createAdminClient: () => ({
    from: (tableName: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {
        select: () => chain,
        update: (vals: Record<string, unknown>) => {
          updateSpy(tableName, vals)
          return chain
        },
        eq: () => chain,
        in: () => chain,
        order: () => chain,
        // The endpoint awaits `.in('id', ids)` after `.select('id,
        // fund_manager_id')`. Returning the ownership array via `then`
        // makes that await resolve.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        then: (resolve: any) => resolve({ data: adminPortfoliosOwnership, error: null }),
      }
      return chain
    },
  }),
}))

async function importRoute() {
  return await import('../route')
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/portfolios/reorder', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mockUser = { id: 'fm-uuid-1' }
  adminPortfoliosOwnership = []
  updateSpy.mockClear()
})

describe('PATCH /api/portfolios/reorder', () => {
  it('401 when no auth user', async () => {
    mockUser = null
    const { PATCH } = await importRoute()
    const res = await PATCH(makeRequest({ order: [{ id: 'p1', display_order: 1 }] }))
    expect(res.status).toBe(401)
  })

  it('400 when order is missing or empty', async () => {
    const { PATCH } = await importRoute()
    const res1 = await PATCH(makeRequest({}))
    expect(res1.status).toBe(400)

    const res2 = await PATCH(makeRequest({ order: [] }))
    expect(res2.status).toBe(400)
  })

  it('403 when an id does not belong to the FM', async () => {
    adminPortfoliosOwnership = [
      { id: 'p1', fund_manager_id: 'fm-uuid-1' },
      // p2 owned by someone else — should kill the whole batch
      { id: 'p2', fund_manager_id: 'fm-uuid-2' },
    ]
    const { PATCH } = await importRoute()
    const res = await PATCH(
      makeRequest({
        order: [
          { id: 'p1', display_order: 1 },
          { id: 'p2', display_order: 2 },
        ],
      })
    )
    expect(res.status).toBe(403)
    // No update should have been issued for the rejected batch.
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('403 when the ownership lookup returns fewer rows than the input ids', async () => {
    // Defends against a missing-row attack: client sends an id that
    // doesn't exist (or was deleted) — the ownership SELECT returns
    // a smaller set, the route must reject rather than silently
    // skip the missing row.
    adminPortfoliosOwnership = [{ id: 'p1', fund_manager_id: 'fm-uuid-1' }]
    const { PATCH } = await importRoute()
    const res = await PATCH(
      makeRequest({
        order: [
          { id: 'p1', display_order: 1 },
          { id: 'p2', display_order: 2 },
        ],
      })
    )
    expect(res.status).toBe(403)
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('200 with one update per row when every id is owned by the FM', async () => {
    adminPortfoliosOwnership = [
      { id: 'p1', fund_manager_id: 'fm-uuid-1' },
      { id: 'p2', fund_manager_id: 'fm-uuid-1' },
      { id: 'p3', fund_manager_id: 'fm-uuid-1' },
    ]
    const { PATCH } = await importRoute()
    const res = await PATCH(
      makeRequest({
        order: [
          { id: 'p1', display_order: 1 },
          { id: 'p2', display_order: 2 },
          { id: 'p3', display_order: 3 },
        ],
      })
    )
    const body = (await res.json()) as { ok: boolean; updated: number }
    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true, updated: 3 })
    // Three updates, each with a display_order. Order spy was registered
    // for table='portfolios'.
    const updates = updateSpy.mock.calls.filter(
      ([table]) => table === 'portfolios'
    )
    expect(updates).toHaveLength(3)
    const orders = updates
      .map(([, vals]) => (vals as { display_order: number }).display_order)
      .sort()
    expect(orders).toEqual([1, 2, 3])
  })
})
