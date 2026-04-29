import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { fanOutPortfolioUpdate } from "@/lib/notification-fanout";

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

  let portfolioId: string;
  let isExplicitPortfolio = false;

  if (body.portfolio_id) {
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

  // Upsert by ticker within this portfolio — ticker already exists means
  // the FM is editing shares/price, not adding a new holding, so no fanout.
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

  if (isExplicitPortfolio) {
    // Subscribable portfolio — fan out a buy event to every active dopler
    // on the portfolio. Admin client bypasses RLS for the read-subscribers
    // traversal; ownership was already verified above.
    await fanOutPortfolioUpdate(createAdminClient(), {
      portfolio_id: portfolioId,
      fund_manager_id: user.id,
      changes: [
        {
          type: "buy",
          ticker,
          shares: shares ?? 0,
          price: price ?? undefined,
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
