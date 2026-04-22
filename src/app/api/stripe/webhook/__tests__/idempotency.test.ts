import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const ORIGINAL_ENV = { ...process.env }

// Tracks the in-memory state the fake supabase admin client operates on.
// Reset in beforeEach. Keyed by table name so the route's `.from(name)` calls
// exercise the specific table state this test seeds.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const state: Record<string, any[]> = {}
const rpcCalls: string[] = []

const constructEvent = vi.fn()
const stripeSubCancel = vi.fn()

vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({
    webhooks: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      constructEvent: (...args: any[]) => constructEvent(...args),
    },
    subscriptions: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cancel: (...args: any[]) => stripeSubCancel(...args),
    },
  }),
  DOPL_FEE_PERCENT: 10,
}))

vi.mock('@/lib/supabase-admin', () => ({
  createAdminClient: () => ({
    from: (tableName: string) => makeChain(tableName),
    rpc: async (name: string) => {
      rpcCalls.push(name)
      return { data: null, error: null }
    },
  }),
}))

function makeChain(tableName: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filters: { col: string; val: any; op: 'eq' | 'contains' }[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pendingUpdate: Record<string, any> | null = null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matches = (row: any) =>
    filters.every((f) => {
      if (f.op === 'eq') return row[f.col] === f.val
      if (f.op === 'contains') {
        const rv = row[f.col]
        if (!rv || typeof rv !== 'object') return false
        return Object.entries(
          f.val as Record<string, unknown>
        ).every(([k, v]) => (rv as Record<string, unknown>)[k] === v)
      }
      return false
    })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    select() {
      return chain
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    eq(col: string, val: any) {
      filters.push({ col, val, op: 'eq' })
      return chain
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contains(col: string, val: any) {
      filters.push({ col, val, op: 'contains' })
      return chain
    },
    limit() {
      return chain
    },
    order() {
      return chain
    },
    async maybeSingle() {
      const rows = (state[tableName] ?? []).filter(matches)
      return { data: rows[0] ?? null, error: null }
    },
    async single() {
      const rows = (state[tableName] ?? []).filter(matches)
      return { data: rows[0] ?? null, error: null }
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    insert(row: any) {
      const id =
        row.id ??
        `${tableName}-${(state[tableName] ?? []).length + 1}`
      const actualRow = { ...row, id }
      state[tableName] = [...(state[tableName] ?? []), actualRow]
      return {
        select: () => ({
          async single() {
            return { data: actualRow, error: null }
          },
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        then: (cb: any) => cb({ data: null, error: null }),
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update(patch: Record<string, any>) {
      pendingUpdate = patch
      return chain
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    then: (cb: any) => {
      if (pendingUpdate) {
        state[tableName] = (state[tableName] ?? []).map((row) =>
          matches(row) ? { ...row, ...pendingUpdate } : row
        )
        pendingUpdate = null
      }
      cb({ data: null, error: null })
    },
  }
  return chain
}

async function importRoute() {
  return await import('../route')
}

function makeReq(): Request {
  return new Request('http://localhost/api/stripe/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': 'sig' },
    body: '{}',
  })
}

describe('POST /api/stripe/webhook — idempotency', () => {
  beforeEach(() => {
    constructEvent.mockReset()
    stripeSubCancel.mockReset()
    rpcCalls.length = 0
    for (const key of Object.keys(state)) delete state[key]

    // Seed the tables the webhook reads from during fanout.
    state.portfolios = [
      {
        id: 'p1',
        name: 'TechGrowth',
        tier: 'premium',
        price_cents: 1500,
        fund_manager_id: 'fm-alice',
        subscriber_count: 5,
      },
    ]
    state.profiles = [
      { id: 'u1', full_name: 'Alice', email: 'alice@example.com' },
    ]
    state.fund_managers = [
      {
        id: 'fm-alice',
        subscriber_count: 5,
        stripe_account_id: 'acct_123',
      },
    ]
    state.subscriptions = []
    state.notifications = []

    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key'
    process.env.STRIPE_SECRET_KEY = 'sk_test'
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it('a duplicate checkout.session.completed produces exactly 1 subscription + 1 fm notification', async () => {
    const event = {
      type: 'checkout.session.completed',
      data: {
        object: {
          subscription: 'sub_stripe_123',
          amount_total: 1500,
          subscription_data: {
            metadata: {
              portfolio_id: 'p1',
              user_id: 'u1',
              fund_manager_id: 'fm-alice',
            },
          },
        },
      },
    }
    constructEvent.mockReturnValue(event)
    const { POST } = await importRoute()

    const res1 = await POST(makeReq())
    expect(res1.status).toBe(200)

    const res2 = await POST(makeReq())
    expect(res2.status).toBe(200)

    // Subscriptions table: exactly one row for this stripe_subscription_id.
    const subs = (state.subscriptions ?? []).filter(
      (s) => s.stripe_subscription_id === 'sub_stripe_123'
    )
    expect(subs).toHaveLength(1)

    // RPC called exactly once — second delivery short-circuited.
    expect(
      rpcCalls.filter((r) => r === 'increment_subscriber_count')
    ).toHaveLength(1)

    // Notifications table: exactly one subscription_added row with the
    // dedup_key for this subscription_id.
    const dedupKey = `subscription_added:${subs[0].id}`
    const notifs = (state.notifications ?? []).filter(
      (n) =>
        n.change_type === 'subscription_added' &&
        (n.meta as Record<string, unknown>)?.dedup_key === dedupKey
    )
    expect(notifs).toHaveLength(1)
  })

  it('a duplicate customer.subscription.deleted fires exactly 1 fm notification', async () => {
    // Seed an active subscription the webhook will cancel.
    state.subscriptions = [
      {
        id: 'sub-seed-1',
        stripe_subscription_id: 'sub_stripe_456',
        user_id: 'u1',
        portfolio_id: 'p1',
        fund_manager_id: 'fm-alice',
        status: 'active',
      },
    ]

    const event = {
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_stripe_456' } },
    }
    constructEvent.mockReturnValue(event)
    const { POST } = await importRoute()

    const res1 = await POST(makeReq())
    expect(res1.status).toBe(200)

    const res2 = await POST(makeReq())
    expect(res2.status).toBe(200)

    // Notifications: exactly one subscription_cancelled row with the
    // dedup_key for this subscription_id.
    const dedupKey = 'subscription_cancelled:sub-seed-1'
    const notifs = (state.notifications ?? []).filter(
      (n) =>
        n.change_type === 'subscription_cancelled' &&
        (n.meta as Record<string, unknown>)?.dedup_key === dedupKey
    )
    expect(notifs).toHaveLength(1)

    // Webhook must NOT call Stripe.subscriptions.cancel — Stripe itself
    // initiated this event.
    expect(stripeSubCancel).not.toHaveBeenCalled()
  })
})
