import { NextResponse } from "next/server";

/**
 * Free Yahoo Finance chart endpoint — no key required.
 * Returns the latest regularMarketPrice for a ticker.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const ticker = (url.searchParams.get("ticker") ?? "").trim().toUpperCase();
  if (!ticker) {
    return NextResponse.json({ error: "ticker required" }, { status: 400 });
  }

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
      }
    );
    if (!res.ok) {
      return NextResponse.json(
        { error: `price lookup failed (${res.status})` },
        { status: 502 }
      );
    }
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    const price =
      meta?.regularMarketPrice ?? meta?.chartPreviousClose ?? null;
    const name = meta?.longName ?? meta?.shortName ?? null;
    if (price == null) {
      return NextResponse.json(
        { error: "no price data" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      ticker,
      price: Number(price),
      name,
      currency: meta?.currency ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "price lookup failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
