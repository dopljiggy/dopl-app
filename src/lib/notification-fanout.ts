import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Narrow the client surface to just `from`. Lets the hand-rolled test mock
 * satisfy the helper's argument type without a per-call cast — and makes
 * mock rot a compile-time error (a future `.rpc()` call would force widening
 * here, which in turn flags the mock).
 */
export type FanoutClient = Pick<SupabaseClient, "from">;

export type FanoutChange =
  | { type: "buy"; ticker: string; shares: number }
  | { type: "sell"; ticker: string; prevShares: number }
  | { type: "rebalance"; ticker: string; prevShares: number; shares: number };

export interface FanoutInput {
  portfolio_id: string;
  fund_manager_id: string;
  changes: FanoutChange[];
  description?: string;
  thesis_note?: string | null;
}

export interface FanoutResult {
  ok: true;
  notified: number;
  update_id: string;
}

/**
 * Insert one portfolio_updates row and fan out holder-aware notification
 * rows to every active subscriber of the portfolio. Shared by
 * /api/portfolios/notify (manual FM trigger) and /api/positions/assign
 * (inline on assign/remove). Caller is responsible for ownership checks —
 * this helper assumes the user owns the portfolio.
 */
export async function fanOutPortfolioUpdate(
  admin: FanoutClient,
  input: FanoutInput
): Promise<FanoutResult> {
  const { data: portfolio } = await admin
    .from("portfolios")
    .select("id, name, fund_manager_id")
    .eq("id", input.portfolio_id)
    .maybeSingle();

  if (!portfolio) {
    throw new Error("portfolio not found");
  }

  const updateType = classifyUpdateType(input.changes);
  const description =
    input.description ?? describeChanges(portfolio.name, input.changes);

  const { data: inserted } = await admin
    .from("portfolio_updates")
    .insert({
      portfolio_id: input.portfolio_id,
      fund_manager_id: input.fund_manager_id,
      update_type: updateType,
      description,
      thesis_note: input.thesis_note ?? null,
    })
    .select("id")
    .single();

  if (!inserted) {
    throw new Error("could not log portfolio update");
  }
  const updateId = inserted.id as string;

  const { data: subs } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("portfolio_id", input.portfolio_id)
    .eq("status", "active");

  const userIds = ((subs ?? []) as { user_id: string }[]).map((s) => s.user_id);

  // Holder-aware lookup for sells: collect tickers each user holds via any
  // of their active subscriptions' portfolios.
  const holderMap = new Map<string, Set<string>>();
  const sells = input.changes.filter((c) => c.type === "sell");
  if (userIds.length > 0 && sells.length > 0) {
    const { data: allSubs } = await admin
      .from("subscriptions")
      .select("user_id, portfolio_id")
      .in("user_id", userIds)
      .eq("status", "active");
    const allSubRows = (allSubs ?? []) as {
      user_id: string;
      portfolio_id: string;
    }[];
    const portfolioIds = Array.from(
      new Set(allSubRows.map((s) => s.portfolio_id))
    );
    const { data: pos } = await admin
      .from("positions")
      .select("portfolio_id, ticker")
      .in("portfolio_id", portfolioIds);
    const posRows = (pos ?? []) as { portfolio_id: string; ticker: string }[];
    const portfolioTickers = new Map<string, Set<string>>();
    for (const row of posRows) {
      const set = portfolioTickers.get(row.portfolio_id) ?? new Set();
      set.add(row.ticker.toUpperCase());
      portfolioTickers.set(row.portfolio_id, set);
    }
    for (const s of allSubRows) {
      const existing = holderMap.get(s.user_id) ?? new Set();
      const tickers = portfolioTickers.get(s.portfolio_id);
      if (tickers) for (const t of tickers) existing.add(t);
      holderMap.set(s.user_id, existing);
    }
  }

  const individuals = input.changes.filter(
    (c): c is Extract<FanoutChange, { type: "buy" | "sell" }> =>
      c.type === "buy" || c.type === "sell"
  );
  const rebalances = input.changes.filter((c) => c.type === "rebalance");

  const notifRows: Record<string, unknown>[] = [];
  for (const userId of userIds) {
    for (const change of individuals) {
      const held =
        change.type === "sell"
          ? holderMap.get(userId)?.has(change.ticker.toUpperCase()) ?? false
          : false;
      const actionable = change.type === "buy" ? true : held;
      notifRows.push({
        user_id: userId,
        portfolio_update_id: updateId,
        title: (portfolio as { name: string }).name,
        body: describeOneChange(change),
        actionable,
        change_type: change.type,
        ticker: change.ticker,
        meta: {
          shares: "shares" in change ? change.shares : undefined,
          prev_shares: "prevShares" in change ? change.prevShares : undefined,
        },
      });
    }
    if (rebalances.length > 0) {
      notifRows.push({
        user_id: userId,
        portfolio_update_id: updateId,
        title: (portfolio as { name: string }).name,
        body: `rebalanced — ${rebalances.length} position${rebalances.length > 1 ? "s" : ""}`,
        actionable: true,
        change_type: "summary",
        ticker: null,
        meta: { rebalance_count: rebalances.length },
      });
    }
    if (individuals.length === 0 && rebalances.length === 0) {
      notifRows.push({
        user_id: userId,
        portfolio_update_id: updateId,
        title: (portfolio as { name: string }).name,
        body: description,
        actionable: true,
        change_type: "note",
        ticker: null,
        meta: {},
      });
    }
  }

  if (notifRows.length > 0) {
    await admin.from("notifications").insert(notifRows);
  }

  return { ok: true, notified: notifRows.length, update_id: updateId };
}

// classifyUpdateType: mixed changes (buy+rebalance, sell+rebalance, etc.)
// all classify as "rebalanced" because that's the broadest update_type bucket.
function classifyUpdateType(
  changes: FanoutChange[]
): "position_added" | "position_removed" | "rebalanced" | "note" {
  if (changes.length === 0) return "note";
  const hasAdd = changes.some((c) => c.type === "buy");
  const hasRemove = changes.some((c) => c.type === "sell");
  const hasRebalance = changes.some((c) => c.type === "rebalance");
  if (hasAdd && !hasRemove && !hasRebalance) return "position_added";
  if (hasRemove && !hasAdd && !hasRebalance) return "position_removed";
  return "rebalanced";
}

function describeChanges(
  portfolioName: string,
  changes: FanoutChange[]
): string {
  if (changes.length === 0) return `${portfolioName} updated`;
  const buys = changes.filter((c) => c.type === "buy").length;
  const sells = changes.filter((c) => c.type === "sell").length;
  const rebalances = changes.filter((c) => c.type === "rebalance").length;
  const parts: string[] = [];
  if (buys) parts.push(`${buys} added`);
  if (sells) parts.push(`${sells} removed`);
  if (rebalances) parts.push(`${rebalances} rebalanced`);
  return parts.join(", ");
}

function describeOneChange(
  change: FanoutChange & { type: "buy" | "sell" }
): string {
  return change.type === "buy"
    ? `bought ${change.ticker}`
    : `sold ${change.ticker}`;
}
