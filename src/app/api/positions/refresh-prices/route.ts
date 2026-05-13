import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { getQuote } from "@/lib/finnhub";

async function fetchCoinGeckoPrice(ticker: string): Promise<number | null> {
  try {
    const searchRes = await fetch(
      `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(ticker)}`,
      { signal: AbortSignal.timeout(5000), cache: "no-store" }
    );
    if (!searchRes.ok) return null;
    const searchJson = (await searchRes.json()) as {
      coins?: { id: string; symbol: string }[];
    };
    const coin = (searchJson.coins ?? []).find(
      (c) => c.symbol.toUpperCase() === ticker.toUpperCase()
    );
    if (!coin) return null;
    const priceRes = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coin.id)}&vs_currencies=usd`,
      { signal: AbortSignal.timeout(5000), cache: "no-store" }
    );
    if (!priceRes.ok) return null;
    const priceJson = (await priceRes.json()) as Record<string, { usd?: number }>;
    return priceJson[coin.id]?.usd ?? null;
  } catch {
    return null;
  }
}

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
      if (q?.current) {
        quotes.set(ticker, q.current);
        continue;
      }
    } catch {
      // fall through to CoinGecko
    }
    try {
      const cgPrice = await fetchCoinGeckoPrice(ticker);
      if (cgPrice) quotes.set(ticker, cgPrice);
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
