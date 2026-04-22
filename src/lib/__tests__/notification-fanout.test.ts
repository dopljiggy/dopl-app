import { describe, it, expect } from 'vitest'
import {
  fanOutFmEvent,
  fanOutPortfolioUpdate,
  type FanoutClient,
} from '@/lib/notification-fanout'

type Row = Record<string, unknown>

/**
 * Fake admin Supabase with in-memory tables. Supports the minimum surface
 * `fanOutPortfolioUpdate` uses:
 *
 *   from(t)
 *     .select(cols)
 *     .eq(col, val) | .in(col, vals)
 *     .maybeSingle() | .single() | [awaitable via .then()]
 *   from(t).insert(rows).select(cols).single()
 *
 * Any chain method NOT in this list (e.g. `.order()`, `.limit()`, `.range()`)
 * will throw at runtime as undefined. If you add a call to the helper that
 * uses a new builder method, extend this mock accordingly — otherwise the
 * test will fail with a clear "X is not a function" error rather than
 * silently no-op.
 */
function makeFakeSupabase(seed: {
  portfolio: { id: string; name: string; fund_manager_id: string };
  subscriptions: { user_id: string; portfolio_id: string; status: string }[];
  positions: { portfolio_id: string; ticker: string }[];
  existingFmNotifications?: {
    user_id: string;
    change_type: string;
    meta: Record<string, unknown>;
  }[];
}) {
  const inserted: { table: string; rows: Row[] }[] = [];
  type FilterOp = "eq" | "in" | "contains";
  type Query = {
    select: () => Query;
    eq: (k: string, v: unknown) => Query;
    in: (k: string, vs: unknown[]) => Query;
    contains: (k: string, v: Record<string, unknown>) => Query;
    limit: (n: number) => Query;
    maybeSingle: () => Promise<{ data: unknown; error: null }>;
    single: () => Promise<{ data: unknown; error: null }>;
    then: (cb: (v: { data: unknown }) => unknown) => unknown;
    insert: (
      rows: Row | Row[]
    ) => { select: () => Query };
  };

  let _state: {
    table: string;
    filters: { col: string; val: unknown; op: FilterOp }[];
  } = { table: "", filters: [] };

  function apply(
    data: Row[],
    filters: { col: string; val: unknown; op: FilterOp }[]
  ): Row[] {
    return data.filter((row) =>
      filters.every((f) => {
        if (f.op === "eq") return row[f.col] === f.val;
        if (f.op === "in")
          return (f.val as unknown[]).includes(row[f.col]);
        if (f.op === "contains") {
          const rowVal = row[f.col];
          if (!rowVal || typeof rowVal !== "object") return false;
          const asRecord = rowVal as Record<string, unknown>;
          return Object.entries(f.val as Record<string, unknown>).every(
            ([k, v]) => asRecord[k] === v
          );
        }
        return false;
      })
    );
  }

  function tableData(table: string): Row[] {
    if (table === "portfolios") return [seed.portfolio as Row];
    if (table === "subscriptions") return seed.subscriptions as Row[];
    if (table === "positions") return seed.positions as Row[];
    if (table === "notifications")
      return (seed.existingFmNotifications ?? []) as Row[];
    return [];
  }

  const q: Query = {
    select() {
      return q;
    },
    eq(col, val) {
      _state.filters.push({ col, val, op: "eq" });
      return q;
    },
    in(col, vs) {
      _state.filters.push({ col, val: vs, op: "in" });
      return q;
    },
    contains(col, val) {
      _state.filters.push({ col, val, op: "contains" });
      return q;
    },
    limit() {
      // No-op for the fake — maybeSingle/single already cap results.
      return q;
    },
    async maybeSingle() {
      const data = apply(tableData(_state.table), _state.filters);
      _state = { table: "", filters: [] };
      return { data: data[0] ?? null, error: null };
    },
    async single() {
      const data = apply(tableData(_state.table), _state.filters);
      _state = { table: "", filters: [] };
      return { data: data[0] ?? null, error: null };
    },
    then(cb) {
      const data = apply(tableData(_state.table), _state.filters);
      _state = { table: "", filters: [] };
      return cb({ data });
    },
    insert(rows) {
      const arr = Array.isArray(rows) ? rows : [rows];
      inserted.push({ table: _state.table, rows: arr });
      _state = { table: "", filters: [] };
      return {
        select: () => ({
          ...q,
          async single() {
            return {
              data: {
                id: `${inserted[inserted.length - 1].table}-${inserted.length}`,
              },
              error: null,
            };
          },
        }),
      };
    },
  };

  return {
    client: {
      from(table: string) {
        _state = { table, filters: [] };
        return q;
      },
    } as unknown as FanoutClient,
    inserted,
  };
}

describe('fanOutPortfolioUpdate', () => {
  const portfolio = {
    id: 'p-techgrowth',
    name: 'TechGrowth',
    fund_manager_id: 'fm-alice',
  };

  it('emits one notification per active sub for a single buy', async () => {
    const { client, inserted } = makeFakeSupabase({
      portfolio,
      subscriptions: [
        { user_id: 'u1', portfolio_id: 'p-techgrowth', status: 'active' },
        { user_id: 'u2', portfolio_id: 'p-techgrowth', status: 'active' },
      ],
      positions: [],
    });
    const result = await fanOutPortfolioUpdate(client, {
      portfolio_id: 'p-techgrowth',
      fund_manager_id: 'fm-alice',
      changes: [{ type: 'buy', ticker: 'AAPL', shares: 10 }],
    });
    expect(result.notified).toBe(2);
    const notifInsert = inserted.find((i) => i.table === 'notifications');
    expect(notifInsert?.rows).toHaveLength(2);
    for (const row of notifInsert!.rows) {
      expect(row).toMatchObject({
        change_type: 'buy',
        ticker: 'AAPL',
        actionable: true,
      });
    }
  });

  it('sell on a ticker the dopler does NOT hold → actionable=false', async () => {
    const { client, inserted } = makeFakeSupabase({
      portfolio,
      subscriptions: [
        // u1 is subbed to TechGrowth (where the sell happened) only.
        { user_id: 'u1', portfolio_id: 'p-techgrowth', status: 'active' },
      ],
      positions: [
        // TechGrowth no longer holds AAPL (that's why we're selling it).
        // u1 has no other subs → doesn't hold AAPL anywhere.
      ],
    });
    const result = await fanOutPortfolioUpdate(client, {
      portfolio_id: 'p-techgrowth',
      fund_manager_id: 'fm-alice',
      changes: [{ type: 'sell', ticker: 'AAPL', prevShares: 5 }],
    });
    expect(result.notified).toBe(1);
    const row = inserted.find((i) => i.table === 'notifications')!.rows[0];
    expect(row).toMatchObject({
      user_id: 'u1',
      change_type: 'sell',
      ticker: 'AAPL',
      actionable: false,
    });
  });

  it('sell on a ticker the dopler DOES hold elsewhere → actionable=true', async () => {
    const { client, inserted } = makeFakeSupabase({
      portfolio,
      subscriptions: [
        { user_id: 'u1', portfolio_id: 'p-techgrowth', status: 'active' },
        // u1 also subs to p-other, which still holds AAPL.
        { user_id: 'u1', portfolio_id: 'p-other', status: 'active' },
      ],
      positions: [{ portfolio_id: 'p-other', ticker: 'AAPL' }],
    });
    const result = await fanOutPortfolioUpdate(client, {
      portfolio_id: 'p-techgrowth',
      fund_manager_id: 'fm-alice',
      changes: [{ type: 'sell', ticker: 'AAPL', prevShares: 5 }],
    });
    expect(result.notified).toBe(1);
    const row = inserted.find((i) => i.table === 'notifications')!.rows[0];
    expect(row).toMatchObject({
      user_id: 'u1',
      change_type: 'sell',
      ticker: 'AAPL',
      actionable: true,
    });
  });

  it('rebalance-only changes → exactly one summary notification per sub', async () => {
    const { client, inserted } = makeFakeSupabase({
      portfolio,
      subscriptions: [
        { user_id: 'u1', portfolio_id: 'p-techgrowth', status: 'active' },
        { user_id: 'u2', portfolio_id: 'p-techgrowth', status: 'active' },
      ],
      positions: [],
    });
    const result = await fanOutPortfolioUpdate(client, {
      portfolio_id: 'p-techgrowth',
      fund_manager_id: 'fm-alice',
      changes: [
        { type: 'rebalance', ticker: 'AAPL', prevShares: 10, shares: 12 },
        { type: 'rebalance', ticker: 'TSLA', prevShares: 5, shares: 4 },
        { type: 'rebalance', ticker: 'NVDA', prevShares: 3, shares: 7 },
      ],
    });
    expect(result.notified).toBe(2); // one per sub, not 3*2
    const rows = inserted.find((i) => i.table === 'notifications')!.rows;
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row).toMatchObject({ change_type: 'summary', ticker: null });
      expect(row.meta).toMatchObject({ rebalance_count: 3 });
    }
  });

  it('mixed changes: 1 buy + 2 rebalances → 1 buy row + 1 summary row per sub (= 2 per sub)', async () => {
    const { client, inserted } = makeFakeSupabase({
      portfolio,
      subscriptions: [
        { user_id: 'u1', portfolio_id: 'p-techgrowth', status: 'active' },
      ],
      positions: [],
    });
    const result = await fanOutPortfolioUpdate(client, {
      portfolio_id: 'p-techgrowth',
      fund_manager_id: 'fm-alice',
      changes: [
        { type: 'buy', ticker: 'AAPL', shares: 10 },
        { type: 'rebalance', ticker: 'TSLA', prevShares: 5, shares: 4 },
        { type: 'rebalance', ticker: 'NVDA', prevShares: 3, shares: 7 },
      ],
    });
    expect(result.notified).toBe(2);
    const rows = inserted.find((i) => i.table === 'notifications')!.rows;
    const types = rows.map((r) => r.change_type).sort();
    expect(types).toEqual(['buy', 'summary']);
  });

  it('meta_extend merges into every emitted notification row', async () => {
    const { client, inserted } = makeFakeSupabase({
      portfolio,
      subscriptions: [
        { user_id: 'u1', portfolio_id: 'p-techgrowth', status: 'active' },
      ],
      positions: [],
    });
    await fanOutPortfolioUpdate(client, {
      portfolio_id: 'p-techgrowth',
      fund_manager_id: 'fm-alice',
      changes: [{ type: 'buy', ticker: 'AAPL', shares: 10 }],
      meta_extend: { manual: true, source: 'test' },
    });
    const row = inserted.find((i) => i.table === 'notifications')!.rows[0] as {
      meta: Record<string, unknown>;
    };
    expect(row.meta.manual).toBe(true);
    expect(row.meta.source).toBe('test');
  });

  it('fallback: empty changes array → one "note" notification per sub', async () => {
    const { client, inserted } = makeFakeSupabase({
      portfolio,
      subscriptions: [
        { user_id: 'u1', portfolio_id: 'p-techgrowth', status: 'active' },
      ],
      positions: [],
    });
    const result = await fanOutPortfolioUpdate(client, {
      portfolio_id: 'p-techgrowth',
      fund_manager_id: 'fm-alice',
      changes: [],
      description: 'thesis update',
    });
    expect(result.notified).toBe(1);
    const row = inserted.find((i) => i.table === 'notifications')!.rows[0];
    expect(row).toMatchObject({
      change_type: 'note',
      body: 'thesis update',
    });
  });
});

describe('fanOutFmEvent', () => {
  const portfolio = {
    id: 'p1',
    name: 'TechGrowth',
    fund_manager_id: 'fm-alice',
  };

  it('inserts one notification row on the FM, not on subscribers, with price + dedup meta', async () => {
    const { client, inserted } = makeFakeSupabase({
      portfolio,
      subscriptions: [
        { user_id: 'u1', portfolio_id: 'p1', status: 'active' },
        { user_id: 'u2', portfolio_id: 'p1', status: 'active' },
      ],
      positions: [],
    });
    const result = await fanOutFmEvent(client, {
      fund_manager_id: 'fm-alice',
      portfolio_id: 'p1',
      portfolio_name: 'TechGrowth',
      dopler_user_id: 'u1',
      dopler_handle: 'alice',
      tier: 'core',
      price_cents: 1500,
      subscription_id: 'sub_abc',
      event: 'subscription_added',
    });
    expect(result.notified).toBe(1);
    const notifInsert = inserted.find((i) => i.table === 'notifications')!;
    expect(notifInsert.rows).toHaveLength(1);
    expect(notifInsert.rows[0]).toMatchObject({
      user_id: 'fm-alice',
      change_type: 'subscription_added',
      actionable: false,
      title: expect.stringMatching(/new dopler|TechGrowth/i),
    });
    expect(notifInsert.rows[0].meta).toMatchObject({
      dopler_user_id: 'u1',
      dopler_handle: 'alice',
      portfolio_id: 'p1',
      tier: 'core',
      price_cents: 1500,
      dedup_key: 'subscription_added:sub_abc',
    });
  });

  it('is idempotent — duplicate dedup_key does not insert a second row', async () => {
    const { client, inserted } = makeFakeSupabase({
      portfolio,
      subscriptions: [],
      positions: [],
      existingFmNotifications: [
        {
          user_id: 'fm-alice',
          change_type: 'subscription_added',
          meta: { dedup_key: 'subscription_added:sub_abc' },
        },
      ],
    });
    const result = await fanOutFmEvent(client, {
      fund_manager_id: 'fm-alice',
      portfolio_id: 'p1',
      portfolio_name: 'TechGrowth',
      dopler_user_id: 'u1',
      dopler_handle: 'alice',
      tier: 'core',
      price_cents: 1500,
      subscription_id: 'sub_abc',
      event: 'subscription_added',
    });
    expect(result.notified).toBe(0);
    const notifInsert = inserted.find((i) => i.table === 'notifications');
    expect(notifInsert).toBeUndefined();
  });

  it('subscription_cancelled uses past-tense body copy + null price ok', async () => {
    const { client, inserted } = makeFakeSupabase({
      portfolio,
      subscriptions: [],
      positions: [],
    });
    await fanOutFmEvent(client, {
      fund_manager_id: 'fm-alice',
      portfolio_id: 'p1',
      portfolio_name: 'TechGrowth',
      dopler_user_id: 'u1',
      dopler_handle: 'alice',
      tier: 'free',
      price_cents: null,
      subscription_id: 'sub_xyz',
      event: 'subscription_cancelled',
    });
    const row = inserted.find((i) => i.table === 'notifications')!.rows[0];
    expect(row.body as string).toMatch(/cancel|left/i);
    expect(row.change_type).toBe('subscription_cancelled');
    expect(row.meta).toMatchObject({
      tier: 'free',
      price_cents: null,
      dedup_key: 'subscription_cancelled:sub_xyz',
    });
  });
});
