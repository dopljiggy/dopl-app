import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { fanOutPortfolioUpdate } from "@/lib/notification-fanout";
import { recalculateAllocations } from "@/lib/recalculate-allocations";

/**
 * Get-or-create a 'manual' broker_connections row for this FM. Sprint 15:
 * every manually-entered position gets stamped with this connection's id,
 * which gives the new positions/connect UIs a consistent way to badge and
 * group manual entries alongside SnapTrade/SaltEdge ones.
 */
async function getOrCreateManualConnection(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  userId: string
): Promise<string | null> {
  const { data: existing } = await admin
    .from("broker_connections")
    .select("id")
    .eq("fund_manager_id", userId)
    .eq("provider", "manual")
    .eq("is_active", true)
    .maybeSingle();
  if (existing?.id) return existing.id as string;
  const { data: created, error } = await admin
    .from("broker_connections")
    .insert({
      fund_manager_id: userId,
      provider: "manual",
      provider_auth_id: null,
      broker_name: "Manual Entry",
      is_active: true,
    })
    .select("id")
    .single();
  if (error) {
    console.warn("manual connection create failed:", error);
    return null;
  }
  return created.id as string;
}

/**
 * Manual position management.
 *
 * Two modes, discriminated on whether the POST body carries `portfolio_id`:
 *
 *   - Manual Holdings mode (no portfolio_id): legacy onboarding flow —
 *     positions land in a system "Manual Holdings" portfolio doplers
 *     can't subscribe to, and the POST flips `broker_connected=true` on
 *     the FM so the rest of the app treats manual entry as their broker.
 *     No subscriber fanout.
 *
 *   - Subscribable-portfolio mode (portfolio_id provided): positions go
 *     into a real subscribable portfolio the FM owns. New-position
 *     inserts fire `fanOutPortfolioUpdate` with a buy event so every
 *     active dopler on the portfolio is notified via the existing Sprint
 *     2 fanout path. Ownership is verified against the portfolios table
 *     as defense-in-depth alongside RLS.
 *
 * GET only reads Manual Holdings (the onboarding flow's surface).
 * DELETE looks up the target position's actual portfolio_id so deletes
 * from either mode work, and fires a sell fanout when the position
 * lived in a subscribable portfolio.
 */

async function revalidatePositionSurfaces(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  portfolioId: string,
  userId: string
): Promise<void> {
  const { data: fm } = await supabase
    .from("fund_managers")
    .select("handle")
    .eq("id", userId)
    .maybeSingle();
  const handle = (fm?.handle as string | null | undefined) ?? null;

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/portfolios");
  revalidatePath(`/feed/${portfolioId}`);
  if (handle) {
    revalidatePath(`/${handle}`);
  }
}

async function getOrCreateManualPortfolio(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("portfolios")
    .select("id")
    .eq("fund_manager_id", userId)
    .eq("name", "Manual Holdings")
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created, error } = await supabase
    .from("portfolios")
    .insert({
      fund_manager_id: userId,
      name: "Manual Holdings",
      description: "manually-managed positions",
      tier: "free",
      price_cents: 0,
      is_active: true,
    })
    .select("id")
    .single();
  if (error) {
    console.error("manual portfolio create error:", error);
    return null;
  }
  return created.id;
}

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const portfolioId = await getOrCreateManualPortfolio(supabase, user.id);
  if (!portfolioId) {
    return NextResponse.json(
      { error: "could not create manual portfolio" },
      { status: 500 }
    );
  }

  const { data: positions } = await supabase
    .from("positions")
    .select(
      "id, ticker, name, shares, entry_price, current_price, market_value"
    )
    .eq("portfolio_id", portfolioId)
    .order("ticker");

  return NextResponse.json({ portfolio_id: portfolioId, positions: positions ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    id?: string;
    portfolio_id?: string;
    pool?: boolean;
    ticker: string;
    name?: string | null;
    shares?: number | null;
    entry_price?: number | null;
    current_price?: number | null;
    thesis_note?: string | null;
  };

  const ticker = (body.ticker ?? "").trim().toUpperCase();
  if (!ticker) {
    return NextResponse.json({ error: "ticker required" }, { status: 400 });
  }

  let portfolioId: string | null = null;
  let isExplicitPortfolio = false;

  if (body.pool) {
    // Pool mode: position goes into unassigned pool (portfolio_id = NULL)
    portfolioId = null;
  } else if (body.portfolio_id) {
    // Ownership check — defense-in-depth alongside RLS.
    const { data: portfolio } = await supabase
      .from("portfolios")
      .select("id, fund_manager_id")
      .eq("id", body.portfolio_id)
      .maybeSingle();
    if (!portfolio || portfolio.fund_manager_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    portfolioId = portfolio.id as string;
    isExplicitPortfolio = true;
  } else {
    const id = await getOrCreateManualPortfolio(supabase, user.id);
    if (!id) {
      return NextResponse.json(
        { error: "could not create manual portfolio" },
        { status: 500 }
      );
    }
    portfolioId = id;
  }

  const shares = body.shares != null ? Number(body.shares) : null;
  const price = body.current_price != null ? Number(body.current_price) : null;
  const entry = body.entry_price != null ? Number(body.entry_price) : null;
  const market_value =
    shares != null && price != null ? shares * price : null;

  // Sprint 15: stamp manual positions with the FM's manual broker
  // connection. Used by the new positions page to group + badge them.
  // Admin client because the row may need to be created in a path where
  // RLS would otherwise block the lookup.
  const manualConnectionId = await getOrCreateManualConnection(
    createAdminClient(),
    user.id
  );

  // Pool mode: skip the upsert-by-ticker-in-portfolio and go straight to insert
  if (body.pool) {
    const { data: inserted, error } = await supabase
      .from("positions")
      .insert({
        portfolio_id: null,
        broker_connection_id: manualConnectionId,
        ticker,
        name: body.name ?? null,
        shares,
        entry_price: entry,
        current_price: price,
        market_value,
        asset_type: "stock" as const,
        last_synced: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    revalidatePath("/dashboard/positions");
    return NextResponse.json({ ok: true, id: inserted.id });
  }

  // After this point portfolioId is guaranteed non-null (pool mode returned above)
  const resolvedPortfolioId = portfolioId as string;

  const row = {
    portfolio_id: resolvedPortfolioId,
    broker_connection_id: manualConnectionId,
    ticker,
    name: body.name ?? null,
    shares,
    entry_price: entry,
    current_price: price,
    market_value,
    asset_type: "stock" as const,
    last_synced: new Date().toISOString(),
  };

  if (body.id) {
    const { error } = await supabase
      .from("positions")
      .update(row)
      .eq("id", body.id)
      .eq("portfolio_id", resolvedPortfolioId);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    await revalidatePositionSurfaces(supabase, resolvedPortfolioId, user.id);
    return NextResponse.json({ ok: true, id: body.id });
  }

  // Upsert by ticker within this portfolio — ticker already exists means
  // the FM is editing shares/price on an existing holding. We fan out a
  // rebalance notification when the share count actually changed (the
  // no-op guard prevents notification spam on accidental re-submits or
  // price-only refreshes).
  const { data: existing } = await supabase
    .from("positions")
    .select("id, shares")
    .eq("portfolio_id", resolvedPortfolioId)
    .eq("ticker", ticker)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("positions")
      .update(row)
      .eq("id", existing.id);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    // Auto-rebalance after upsert (Sprint 14): the share count or price
    // may have changed, which shifts market_value and therefore the
    // allocation distribution.
    await recalculateAllocations(supabase, resolvedPortfolioId);
    await revalidatePositionSurfaces(supabase, resolvedPortfolioId, user.id);

    if (isExplicitPortfolio) {
      const prevShares = Number(existing.shares) || 0;
      const newShares = shares ?? 0;
      // No-op guard: re-submitting unchanged shares (or refreshing
      // current_price without changing shares) shouldn't notify doplers.
      // A future "price update" change_type could lift this if needed.
      if (prevShares !== newShares) {
        await fanOutPortfolioUpdate(createAdminClient(), {
          portfolio_id: resolvedPortfolioId,
          fund_manager_id: user.id,
          changes: [
            {
              type: "rebalance",
              ticker,
              prevShares,
              shares: newShares,
              price: price ?? undefined,
            },
          ],
          description: `rebalanced ${ticker}`,
          thesis_note: body.thesis_note ?? null,
        });
      }
    }

    return NextResponse.json({ ok: true, id: existing.id });
  }

  const { data: inserted, error } = await supabase
    .from("positions")
    .insert(row)
    .select("id")
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-rebalance after every insert (Sprint 14) — runs before the
  // fanout so the inline allocation_pct compute below sees fresh values.
  await recalculateAllocations(supabase, resolvedPortfolioId);

  if (isExplicitPortfolio) {
    // Subscribable portfolio — fan out a buy event to every active dopler
    // on the portfolio. Admin client bypasses RLS for the read-subscribers
    // traversal; ownership was already verified above.
    //
    // Compute allocation_pct fresh from the just-updated portfolio total
    // so the notification body can surface "X% allocation". Skipped when
    // the new position has no market_value (price unavailable on add).
    let allocationPct: number | undefined;
    if (market_value != null && market_value > 0) {
      const { data: allPositions } = await supabase
        .from("positions")
        .select("market_value")
        .eq("portfolio_id", resolvedPortfolioId);
      const total = ((allPositions ?? []) as { market_value: number | null }[])
        .reduce((a, p) => a + (Number(p.market_value) || 0), 0);
      if (total > 0) allocationPct = (market_value / total) * 100;
    }

    await fanOutPortfolioUpdate(createAdminClient(), {
      portfolio_id: resolvedPortfolioId,
      fund_manager_id: user.id,
      changes: [
        {
          type: "buy",
          ticker,
          shares: shares ?? 0,
          price: price ?? undefined,
          allocation_pct: allocationPct,
        },
      ],
      description: `added ${ticker}`,
      thesis_note: body.thesis_note ?? null,
    });
  } else {
    // Manual Holdings path — treat manual entry as the FM's broker so
    // the rest of the app stops nagging them to connect one. Only flips
    // on first insert; subsequent inserts leave the flag alone.
    await supabase
      .from("fund_managers")
      .update({
        broker_connected: true,
        broker_name: "Manual Entry",
        broker_provider: "manual",
      })
      .eq("id", user.id);
  }

  await revalidatePositionSurfaces(supabase, resolvedPortfolioId, user.id);

  return NextResponse.json({ ok: true, id: inserted.id });
}

export async function DELETE(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    id: string;
    thesis_note?: string | null;
  };
  const { id } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Look up the position + its portfolio in one shot: gives us the
  // actual portfolio_id (positions can live in Manual Holdings OR any
  // subscribable portfolio) AND ownership (via the inner join on
  // portfolios.fund_manager_id). Previous behavior hardcoded the
  // portfolio_id to Manual Holdings, which silently matched 0 rows for
  // positions in named portfolios.
  const { data: pos } = await supabase
    .from("positions")
    .select(
      "id, ticker, shares, portfolio_id, portfolios!inner(fund_manager_id, name)"
    )
    .eq("id", id)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const portfolios = (pos as any)?.portfolios as
    | { fund_manager_id?: string; name?: string }
    | undefined;
  if (!pos || portfolios?.fund_manager_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase.from("positions").delete().eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const portfolioId = (pos as any).portfolio_id as string;
  // Auto-rebalance after delete (Sprint 14) — remaining holdings
  // re-proportion so allocation_pct still sums to 100%.
  await recalculateAllocations(supabase, portfolioId);
  await revalidatePositionSurfaces(supabase, portfolioId, user.id);

  // Fan out a sell event only when the position lived in a subscribable
  // portfolio. Manual Holdings has no subscribers, so fanout would be a
  // no-op — the explicit guard keeps the intent readable.
  if (portfolios?.name !== "Manual Holdings") {
    await fanOutPortfolioUpdate(createAdminClient(), {
      portfolio_id: portfolioId,
      fund_manager_id: user.id,
      changes: [
        {
          type: "sell",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ticker: (pos as any).ticker as string,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          prevShares: Number((pos as any).shares) || 0,
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      description: `removed ${(pos as any).ticker}`,
      thesis_note: body.thesis_note ?? null,
    });
  }

  return NextResponse.json({ ok: true });
}
