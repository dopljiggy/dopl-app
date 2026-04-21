import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase-server";

/**
 * Manual position management for fund managers whose broker isn't supported.
 *
 * GET  — list positions on the user's default manual portfolio
 * POST — add/update a position { ticker, shares?, entry_price?, current_price?, name? }
 * DELETE — remove a position by { id }
 *
 * A default "Manual Holdings" portfolio is created on first write if one
 * doesn't already exist.
 */

async function revalidatePositionSurfaces(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  portfolioId: string,
  userId: string
): Promise<void> {
  // Fetch the FM's public handle so we can revalidate /[handle] too.
  // Safe to skip if the handle isn't resolvable (shouldn't happen
  // post-onboarding, but defensive so a single stale row can't break
  // the other four revalidations).
  const { data: fm } = await supabase
    .from("fund_managers")
    .select("handle")
    .eq("id", userId)
    .maybeSingle();
  const handle = (fm?.handle as string | null | undefined) ?? null;

  // /dashboard is kept so Sprint 4 R1's FinishSetupChecklist
  // "positions assigned" flip still works on the next page load.
  // The other three cover the actual position-render surfaces that
  // were stale after a write: portfolio detail cards, dopler feed,
  // and the public FM profile.
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
    ticker: string;
    name?: string | null;
    shares?: number | null;
    entry_price?: number | null;
    current_price?: number | null;
  };

  const ticker = (body.ticker ?? "").trim().toUpperCase();
  if (!ticker) {
    return NextResponse.json({ error: "ticker required" }, { status: 400 });
  }

  const portfolioId = await getOrCreateManualPortfolio(supabase, user.id);
  if (!portfolioId) {
    return NextResponse.json(
      { error: "could not create manual portfolio" },
      { status: 500 }
    );
  }

  const shares = body.shares != null ? Number(body.shares) : null;
  const price = body.current_price != null ? Number(body.current_price) : null;
  const entry = body.entry_price != null ? Number(body.entry_price) : null;
  const market_value =
    shares != null && price != null ? shares * price : null;

  const row = {
    portfolio_id: portfolioId,
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
      .eq("portfolio_id", portfolioId);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    await revalidatePositionSurfaces(supabase, portfolioId, user.id);
    return NextResponse.json({ ok: true, id: body.id });
  }

  // Upsert by ticker within this portfolio.
  const { data: existing } = await supabase
    .from("positions")
    .select("id")
    .eq("portfolio_id", portfolioId)
    .eq("ticker", ticker)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("positions")
      .update(row)
      .eq("id", existing.id);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    await revalidatePositionSurfaces(supabase, portfolioId, user.id);
    return NextResponse.json({ ok: true, id: existing.id });
  }

  const { data: inserted, error } = await supabase
    .from("positions")
    .insert(row)
    .select("id")
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  // Mark broker_connected so the rest of the app treats them as onboarded.
  await supabase
    .from("fund_managers")
    .update({
      broker_connected: true,
      broker_name: "Manual Entry",
      broker_provider: "manual",
    })
    .eq("id", user.id);

  await revalidatePositionSurfaces(supabase, portfolioId, user.id);

  return NextResponse.json({ ok: true, id: inserted.id });
}

export async function DELETE(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = (await request.json()) as { id: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const portfolioId = await getOrCreateManualPortfolio(supabase, user.id);
  if (!portfolioId) {
    return NextResponse.json({ error: "no manual portfolio" }, { status: 500 });
  }

  const { error } = await supabase
    .from("positions")
    .delete()
    .eq("id", id)
    .eq("portfolio_id", portfolioId);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  await revalidatePositionSurfaces(supabase, portfolioId, user.id);
  return NextResponse.json({ ok: true });
}
