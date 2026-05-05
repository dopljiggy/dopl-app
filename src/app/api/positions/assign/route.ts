import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { fanOutPortfolioUpdate } from "@/lib/notification-fanout";
import { recalculateAllocations } from "@/lib/recalculate-allocations";

/**
 * Assign / unassign positions between the centralized pool and portfolios.
 * Sprint 15.
 *
 * POST — two body shapes:
 *   1. { position_ids: string[], portfolio_id, thesis_note? }
 *      Move pool positions (or already-assigned ones from another portfolio)
 *      INTO the target portfolio. Recalc allocations + buy fanout per ticker.
 *   2. { ticker, portfolio_id, name?, shares?, current_price?, market_value?,
 *        asset_type?, thesis_note? }                                (legacy)
 *      Inline-add a position from the FM dashboard's AddPositionForm. Insert
 *      directly assigned (no pool step) — preserves the existing inline
 *      add-from-portfolio-card UX.
 *
 * DELETE — two body shapes:
 *   1. { position_ids: string[], thesis_note? }
 *      Unassign positions from their portfolios — back to the pool.
 *      portfolio_id is set to NULL; positions are NOT deleted.
 *   2. { id: string, thesis_note? }                                  (legacy)
 *      Treat as { position_ids: [id] } and unassign. Preserves the existing
 *      "remove from portfolio" button on expandable-portfolio-card.tsx.
 */

interface LegacyAssignBody {
  portfolio_id: string;
  ticker: string;
  name?: string | null;
  shares?: number | null;
  current_price?: number | null;
  market_value?: number | null;
  asset_type?: "stock" | "etf" | "crypto" | "option" | "other";
  thesis_note?: string | null;
}

interface BatchAssignBody {
  portfolio_id: string;
  position_ids: string[];
  thesis_note?: string | null;
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as Partial<
    LegacyAssignBody & BatchAssignBody
  >;

  if (!body.portfolio_id) {
    return NextResponse.json(
      { error: "portfolio_id required" },
      { status: 400 }
    );
  }

  // Ownership check on target portfolio.
  const { data: portfolio } = await supabase
    .from("portfolios")
    .select("id, fund_manager_id")
    .eq("id", body.portfolio_id)
    .maybeSingle();
  if (!portfolio || portfolio.fund_manager_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ----- Branch A: batch assign from pool/portfolio -----
  if (Array.isArray(body.position_ids) && body.position_ids.length > 0) {
    return await batchAssign(
      user.id,
      body.portfolio_id,
      body.position_ids,
      body.thesis_note ?? null
    );
  }

  // ----- Branch B: legacy single-ticker insert (AddPositionForm) -----
  if (!body.ticker) {
    return NextResponse.json(
      { error: "ticker or position_ids required" },
      { status: 400 }
    );
  }

  // Avoid duplicates: same ticker already assigned to this portfolio
  // updates in place; otherwise insert.
  const { data: existing } = await supabase
    .from("positions")
    .select("id")
    .eq("portfolio_id", body.portfolio_id)
    .eq("ticker", body.ticker)
    .maybeSingle();

  const row = {
    portfolio_id: body.portfolio_id,
    ticker: body.ticker,
    name: body.name ?? null,
    shares: body.shares ?? null,
    current_price: body.current_price ?? null,
    market_value: body.market_value ?? null,
    asset_type: body.asset_type ?? "stock",
    last_synced: new Date().toISOString(),
  };

  let positionId: string;
  if (existing) {
    await supabase.from("positions").update(row).eq("id", existing.id);
    positionId = existing.id;
  } else {
    const { data: inserted, error } = await supabase
      .from("positions")
      .insert(row)
      .select("id")
      .single();
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    positionId = inserted.id;

    await recalculateAllocations(supabase, body.portfolio_id);

    await fanOutPortfolioUpdate(createAdminClient(), {
      portfolio_id: body.portfolio_id,
      fund_manager_id: user.id,
      changes: [
        {
          type: "buy",
          ticker: body.ticker,
          shares: body.shares ?? 0,
        },
      ],
      description: `added ${body.ticker}`,
      thesis_note: body.thesis_note ?? null,
    });
  }

  return NextResponse.json({ ok: true, id: positionId });
}

async function batchAssign(
  fmId: string,
  portfolioId: string,
  positionIds: string[],
  thesisNote: string | null
) {
  const admin = createAdminClient();

  // Fetch positions + verify the FM owns each one (via either the source
  // portfolio OR the broker_connection). Without this guard, a malicious
  // request could move someone else's pool positions into our portfolio.
  const { data: positions } = await admin
    .from("positions")
    .select(
      "id, ticker, shares, current_price, portfolio_id, broker_connection_id, allocation_pct"
    )
    .in("id", positionIds);

  if (!positions || positions.length === 0) {
    return NextResponse.json({ error: "no positions found" }, { status: 404 });
  }

  // Verify ownership: every position must belong to this FM via either
  // its current portfolio or its broker_connection.
  const portfolioIds = Array.from(
    new Set(
      (positions as { portfolio_id: string | null }[])
        .map((p) => p.portfolio_id)
        .filter((x): x is string => x != null)
    )
  );
  const connIds = Array.from(
    new Set(
      (positions as { broker_connection_id: string | null }[])
        .map((p) => p.broker_connection_id)
        .filter((x): x is string => x != null)
    )
  );

  let portfolioOwnerOk = true;
  let connOwnerOk = true;
  if (portfolioIds.length > 0) {
    const { data: portfolios } = await admin
      .from("portfolios")
      .select("id, fund_manager_id")
      .in("id", portfolioIds);
    portfolioOwnerOk = (portfolios ?? []).every(
      (p) => p.fund_manager_id === fmId
    );
  }
  if (connIds.length > 0) {
    const { data: conns } = await admin
      .from("broker_connections")
      .select("id, fund_manager_id")
      .in("id", connIds);
    connOwnerOk = (conns ?? []).every((c) => c.fund_manager_id === fmId);
  }
  if (!portfolioOwnerOk || !connOwnerOk) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Source portfolios — needed so we recalc allocations on portfolios the
  // positions left (in addition to the destination). Same-portfolio moves
  // (assign within already-assigned) just refresh.
  const sourcePortfolioIds = portfolioIds.filter((id) => id !== portfolioId);

  // Move them.
  await admin
    .from("positions")
    .update({ portfolio_id: portfolioId })
    .in("id", positionIds);

  // Recalc on source + destination.
  for (const pid of sourcePortfolioIds) {
    await recalculateAllocations(admin, pid);
  }
  await recalculateAllocations(admin, portfolioId);

  // Compute fresh allocation_pct per assigned ticker for the fanout body.
  const { data: refreshed } = await admin
    .from("positions")
    .select("id, ticker, shares, current_price, allocation_pct")
    .in("id", positionIds);
  const refreshedMap = new Map(
    ((refreshed ?? []) as {
      id: string;
      ticker: string;
      shares: number | null;
      current_price: number | null;
      allocation_pct: number | null;
    }[]).map((r) => [r.id, r])
  );

  // Buy fanout — one per assigned ticker so doplers get per-ticker push
  // notifications. fanOutPortfolioUpdate already inserts a single
  // portfolio_updates row per call; batching this would lose ticker
  // granularity.
  for (const pid of positionIds) {
    const r = refreshedMap.get(pid);
    if (!r) continue;
    try {
      await fanOutPortfolioUpdate(admin, {
        portfolio_id: portfolioId,
        fund_manager_id: fmId,
        changes: [
          {
            type: "buy",
            ticker: r.ticker,
            shares: Number(r.shares) || 0,
            price: r.current_price != null ? Number(r.current_price) : undefined,
            allocation_pct:
              r.allocation_pct != null ? Number(r.allocation_pct) : undefined,
          },
        ],
        description: `added ${r.ticker}`,
        thesis_note: thesisNote,
      });
    } catch (err) {
      console.warn(`fanout failed for ${r.ticker}:`, err);
    }
  }

  return NextResponse.json({
    ok: true,
    assigned: positionIds.length,
  });
}

export async function DELETE(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    id?: string;
    position_ids?: string[];
    thesis_note?: string | null;
  };

  // Normalize: legacy { id } body becomes a one-element batch.
  const ids = body.position_ids?.length
    ? body.position_ids
    : body.id
    ? [body.id]
    : [];
  if (ids.length === 0) {
    return NextResponse.json(
      { error: "id or position_ids required" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Pull positions + their portfolio's FM id in one shot for ownership +
  // the per-portfolio recalc/fanout pass.
  const { data: positions } = await admin
    .from("positions")
    .select(
      "id, ticker, shares, portfolio_id, broker_connection_id, portfolios(fund_manager_id)"
    )
    .in("id", ids);

  if (!positions || positions.length === 0) {
    return NextResponse.json({ error: "no positions found" }, { status: 404 });
  }

  // Ownership check via portfolio OR broker_connection (pool-only positions
  // wouldn't be unassign-able since they're not assigned, but keep the
  // check tight regardless).
  for (const pos of positions as Array<{
    portfolio_id: string | null;
    broker_connection_id: string | null;
    portfolios?: { fund_manager_id?: string } | null;
  }>) {
    const viaPortfolio = pos.portfolios?.fund_manager_id === user.id;
    let viaConnection = false;
    if (!viaPortfolio && pos.broker_connection_id) {
      const { data: conn } = await admin
        .from("broker_connections")
        .select("fund_manager_id")
        .eq("id", pos.broker_connection_id)
        .maybeSingle();
      viaConnection = conn?.fund_manager_id === user.id;
    }
    if (!viaPortfolio && !viaConnection) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Group by source portfolio so we recalc each source exactly once.
  const sourcePortfolioIds = Array.from(
    new Set(
      (positions as { portfolio_id: string | null }[])
        .map((p) => p.portfolio_id)
        .filter((x): x is string => x != null)
    )
  );

  // Unassign — set portfolio_id = NULL. Positions return to pool.
  // CRITICAL: positions originating from a manual connection have a
  // broker_connection_id, so they go back to the manual pool. Positions
  // with NO broker_connection_id (legacy pre-migration data) end up
  // orphaned in pool with no connection — these will need manual cleanup
  // but keep the route's contract (unassign-not-delete) intact.
  await admin
    .from("positions")
    .update({ portfolio_id: null })
    .in("id", ids);

  // Per-source-portfolio recalc + sell fanout for each unassigned ticker.
  for (const sourceId of sourcePortfolioIds) {
    await recalculateAllocations(admin, sourceId);
  }

  // Sell fanout — emits sell change per ticker so subscribers get a
  // per-ticker push. The position is NOT deleted (lives in pool now)
  // but for subscribers it's "gone from this portfolio".
  for (const pos of positions as Array<{
    id: string;
    ticker: string;
    shares: number | null;
    portfolio_id: string | null;
  }>) {
    if (!pos.portfolio_id) continue; // pool→pool noop
    try {
      await fanOutPortfolioUpdate(admin, {
        portfolio_id: pos.portfolio_id,
        fund_manager_id: user.id,
        changes: [
          {
            type: "sell",
            ticker: pos.ticker,
            prevShares: Number(pos.shares) || 0,
          },
        ],
        description: `removed ${pos.ticker}`,
        thesis_note: body.thesis_note ?? null,
      });
    } catch (err) {
      console.warn(`sell fanout failed for ${pos.ticker}:`, err);
    }
  }

  return NextResponse.json({
    ok: true,
    unassigned: ids.length,
  });
}
