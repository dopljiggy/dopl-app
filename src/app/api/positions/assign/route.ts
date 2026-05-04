import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { fanOutPortfolioUpdate } from "@/lib/notification-fanout";
import { recalculateAllocations } from "@/lib/recalculate-allocations";

interface AssignBody {
  portfolio_id: string;
  ticker: string;
  name?: string | null;
  shares?: number | null;
  current_price?: number | null;
  market_value?: number | null;
  asset_type?: "stock" | "etf" | "crypto" | "option" | "other";
  thesis_note?: string | null;
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as AssignBody;

  // Verify the portfolio belongs to this user.
  const { data: portfolio } = await supabase
    .from("portfolios")
    .select("id, fund_manager_id")
    .eq("id", body.portfolio_id)
    .maybeSingle();

  if (!portfolio || portfolio.fund_manager_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Avoid duplicates: same ticker in same portfolio updates, otherwise insert.
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

    // Auto-rebalance after every assignment (Sprint 14): allocation_pct
    // tracks market_value proportions automatically, so the FM never has
    // to hit a 'rebalance to 100%' button. Positions with null/zero
    // market_value receive 0% allocation; siblings absorb the slice.
    // The helper no-ops if every position has zero market_value.
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
  const { data: pos } = await supabase
    .from("positions")
    .select("id, ticker, shares, portfolio_id, portfolios!inner(fund_manager_id)")
    .eq("id", id)
    .maybeSingle();

  // @ts-expect-error nested join shape
  if (!pos || pos.portfolios?.fund_manager_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await supabase.from("positions").delete().eq("id", id);
  // Auto-rebalance after delete (Sprint 14): with the position gone, the
  // remaining holdings re-proportion so allocation_pct still sums to 100%
  // (or 0% if the portfolio is now empty). Reverses the prior 'don't
  // auto-recalc on delete — keep custom allocations' policy now that
  // the manual 'rebalance to 100%' button has been removed.
  await recalculateAllocations(supabase, pos.portfolio_id);
  await fanOutPortfolioUpdate(createAdminClient(), {
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

  return NextResponse.json({ ok: true });
}

