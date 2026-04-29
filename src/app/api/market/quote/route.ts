import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getQuote } from "@/lib/finnhub";

type QuotePayload = {
  ticker: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  name?: string | null;
  currency?: string | null;
  error?: string;
};

/**
 * Yahoo Finance fallback. Unofficial endpoint, intermittently rate-limited
 * with 429s — only used when Finnhub fails. Returns null when Yahoo is also
 * unavailable so the caller can surface a manual-entry path.
 */
async function fetchYahooQuote(ticker: string): Promise<QuotePayload | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        ticker
      )}?interval=1d&range=1d`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; doplBot/1.0; +https://dopl.app)",
          Accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    const price =
      meta?.regularMarketPrice ?? meta?.chartPreviousClose ?? null;
    if (price == null) return null;
    const previousClose = meta?.chartPreviousClose ?? meta?.previousClose ?? null;
    const change = previousClose != null ? Number(price) - Number(previousClose) : null;
    const changePercent =
      previousClose != null && Number(previousClose) !== 0
        ? (change! / Number(previousClose)) * 100
        : null;
    return {
      ticker,
      price: Number(price),
      change,
      changePercent,
      name: meta?.longName ?? meta?.shortName ?? null,
      currency: meta?.currency ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * GET /api/market/quote?ticker=AAPL
 * Finnhub primary, Yahoo fallback. If both fail returns 200 with
 * `{ price: null, error: "price unavailable" }` so the FM can still add
 * the position with manually-entered shares + price.
 */
export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const ticker = (url.searchParams.get("ticker") ?? "").trim().toUpperCase();
  if (!ticker)
    return NextResponse.json({ error: "ticker required" }, { status: 400 });

  try {
    const quote = await getQuote(ticker);
    if (quote) {
      return NextResponse.json({
        ticker,
        price: quote.current,
        change: quote.change,
        changePercent: quote.changePercent,
      } satisfies QuotePayload);
    }
  } catch {
    /* fall through to Yahoo */
  }

  const yahoo = await fetchYahooQuote(ticker);
  if (yahoo) return NextResponse.json(yahoo);

  return NextResponse.json({
    ticker,
    price: null,
    change: null,
    changePercent: null,
    error: "price unavailable",
  } satisfies QuotePayload);
}
