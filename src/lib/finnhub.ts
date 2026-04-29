/**
 * Finnhub REST wrapper with in-memory TTL caching.
 *
 * Free tier: 60 calls/min globally (not per-user). The cache windows below
 * are tuned to stay well inside that limit even with multiple FMs typing
 * in autocomplete simultaneously.
 *
 * Cache lives at module scope, so it persists across requests within a
 * warm Vercel serverless instance. Cold starts re-hydrate from Finnhub.
 */

const FINNHUB_BASE = "https://finnhub.io/api/v1";

type CacheEntry<T> = { value: T; expiresAt: number };

const cache = new Map<string, CacheEntry<unknown>>();

function cacheGet<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

async function finnhubFetch(
  path: string,
  params: Record<string, string>
): Promise<unknown> {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) throw new Error("FINNHUB_API_KEY not set");
  const qs = new URLSearchParams({ ...params, token }).toString();
  const res = await fetch(`${FINNHUB_BASE}${path}?${qs}`, {
    signal: AbortSignal.timeout(5000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`finnhub ${path} ${res.status}`);
  return res.json();
}

export type TickerSearchResult = {
  symbol: string;
  description: string;
  type: string;
};

export async function searchTickers(
  query: string
): Promise<TickerSearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const key = `search:${q.toLowerCase()}`;
  const hit = cacheGet<TickerSearchResult[]>(key);
  if (hit) return hit;

  const json = (await finnhubFetch("/search", {
    q,
    exchange: "US",
  })) as {
    count?: number;
    result?: { description: string; symbol: string; type: string }[];
  };
  const all = json.result ?? [];
  // Filter to Common Stock — Finnhub also returns ETFs/funds/options under
  // the same endpoint and the FM-flow only allows individual equities.
  const filtered = all
    .filter((r) => r.type === "Common Stock")
    .map((r) => ({
      symbol: r.symbol,
      description: r.description,
      type: r.type,
    }));
  cacheSet(key, filtered, 5 * 60 * 1000);
  return filtered;
}

export type Quote = {
  current: number;
  change: number;
  changePercent: number;
  previousClose: number;
  high: number;
  low: number;
  open: number;
};

export async function getQuote(ticker: string): Promise<Quote | null> {
  const symbol = ticker.trim().toUpperCase();
  if (!symbol) return null;
  const key = `quote:${symbol}`;
  const hit = cacheGet<Quote>(key);
  if (hit) return hit;

  const json = (await finnhubFetch("/quote", { symbol })) as {
    c?: number;
    d?: number;
    dp?: number;
    h?: number;
    l?: number;
    o?: number;
    pc?: number;
  };
  // Finnhub returns all zeros for unknown tickers — treat as no data.
  if (!json.c || json.c === 0) return null;
  const quote: Quote = {
    current: json.c,
    change: json.d ?? 0,
    changePercent: json.dp ?? 0,
    previousClose: json.pc ?? 0,
    high: json.h ?? 0,
    low: json.l ?? 0,
    open: json.o ?? 0,
  };
  cacheSet(key, quote, 30 * 1000);
  return quote;
}

export type MarketStatus = {
  isOpen: boolean;
  exchange: string;
};

export async function getMarketStatus(): Promise<MarketStatus> {
  const key = "market-status:US";
  const hit = cacheGet<MarketStatus>(key);
  if (hit) return hit;

  const json = (await finnhubFetch("/stock/market-status", {
    exchange: "US",
  })) as { exchange?: string; isOpen?: boolean };
  const status: MarketStatus = {
    isOpen: json.isOpen ?? false,
    exchange: json.exchange ?? "US",
  };
  cacheSet(key, status, 60 * 1000);
  return status;
}
