import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { fanOutPortfolioUpdate } from "@/lib/notification-fanout";

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

    // Seed allocation_pct from market_value if this is the very first
    // position in the portfolio. Once the fund manager starts setting
    // custom allocations, we stop auto-recalculating on assignment.
    const { count: existingCount } = await supabase
      .from("positions")
      .select("id", { count: "exact", head: true })
      .eq("portfolio_id", body.portfolio_id);
    if ((existingCount ?? 0) <= 1) {
      await recalculateAllocations(supabase, body.portfolio_id);
    }

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

  const { id } = await request.json();
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
  // Don't auto-recalc on delete — fund manager's custom allocations stay
  // intact; the "rebalance to 100%" button in the UI lets them fix sums.
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
    thesis_note: null,
  });

  return NextResponse.json({ ok: true });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function recalculateAllocations(supabase: any, portfolioId: string) {
  const { data: positions } = await supabase
    .from("positions")
    .select("id, market_value")
    .eq("portfolio_id", portfolioId);
  if (!positions?.length) return;
  const total = positions.reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (a: number, p: any) => a + (Number(p.market_value) || 0),
    0
  );
  if (total === 0) return;
  await Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    positions.map((p: any) =>
      supabase
        .from("positions")
        .update({
          allocation_pct: ((Number(p.market_value) || 0) / total) * 100,
        })
        .eq("id", p.id)
    )
  );
}
