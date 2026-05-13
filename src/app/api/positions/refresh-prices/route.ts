import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { getQuote } from "@/lib/finnhub";

export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const { data: manualConn } = await admin
    .from("broker_connections")
    .select("id")
    .eq("fund_manager_id", user.id)
    .eq("provider", "manual")
    .eq("is_active", true)
    .maybeSingle();
  if (!manualConn?.id) {
    return NextResponse.json({ updated: 0 });
  }

  const { data: positions } = await admin
    .from("positions")
    .select("id, ticker, shares, entry_price")
    .eq("broker_connection_id", manualConn.id);
  if (!positions || positions.length === 0) {
    return NextResponse.json({ updated: 0 });
  }

  const tickers = Array.from(
    new Set(
      (positions as { ticker: string }[]).map((p) => p.ticker.trim().toUpperCase())
    )
  );

  const quotes = new Map<string, number>();
  for (const ticker of tickers) {
    try {
      const q = await getQuote(ticker);
      if (q?.current) quotes.set(ticker, q.current);
    } catch {
      // skip — price stays unchanged
    }
  }

  let updated = 0;
  for (const pos of positions as {
    id: string;
    ticker: string;
    shares: number | null;
    entry_price: number | null;
  }[]) {
    const price = quotes.get(pos.ticker.trim().toUpperCase());
    if (price == null) continue;
    const shares = Number(pos.shares) || 0;
    const entry = pos.entry_price != null ? Number(pos.entry_price) : null;
    await admin
      .from("positions")
      .update({
        current_price: price,
        market_value: shares * price,
        gain_loss_pct:
          entry && price
            ? ((price - entry) / entry) * 100
            : null,
        last_synced: new Date().toISOString(),
      })
      .eq("id", pos.id);
    updated++;
  }

  revalidatePath("/dashboard/positions");
  revalidatePath("/dashboard/portfolios");

  return NextResponse.json({ updated });
}
