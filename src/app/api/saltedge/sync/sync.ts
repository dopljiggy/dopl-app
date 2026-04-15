import { saltedge, type SaltEdgeAccount } from "@/lib/saltedge";

export type ExtractedPosition = {
  ticker: string;
  name: string;
  shares: number | null;
  current_price: number | null;
  market_value: number | null;
  asset_type: "stock" | "etf" | "crypto" | "option" | "other";
};

/**
 * Salt Edge primarily returns bank account data. Investment accounts may expose
 * holdings in `account.extra.holdings`. We extract those when present; otherwise
 * we return an empty list and let the fund manager enter positions manually.
 */
export function extractPositions(accounts: SaltEdgeAccount[]): ExtractedPosition[] {
  const out: ExtractedPosition[] = [];
  for (const acc of accounts) {
    const nature = (acc.nature ?? "").toLowerCase();
    const isInvestment =
      nature === "investment" || nature === "brokerage" || nature === "securities";
    const holdings = acc.extra?.holdings;
    if (!isInvestment || !Array.isArray(holdings)) continue;
    for (const h of holdings) {
      const ticker = (h.ticker ?? h.symbol ?? "").toString().toUpperCase();
      if (!ticker) continue;
      const shares = (h.quantity ?? h.units ?? null) as number | null;
      const price = (h.price ?? null) as number | null;
      const market = (h.market_value ?? h.value ?? null) as number | null;
      out.push({
        ticker,
        name: (h.name ?? "").toString(),
        shares: shares != null ? Number(shares) : null,
        current_price: price != null ? Number(price) : null,
        market_value:
          market != null
            ? Number(market)
            : shares != null && price != null
            ? Number(shares) * Number(price)
            : null,
        asset_type: "stock",
      });
    }
  }
  return out;
}

/**
 * Returns number of positions found. Positions aren't auto-assigned to a
 * portfolio — the fund manager assigns from /dashboard/positions, matching
 * the SnapTrade flow.
 */
export async function syncSaltedgePositions(
  _userId: string,
  connectionId: string
): Promise<number> {
  const accounts = await saltedge.listAccounts(connectionId);
  const positions = extractPositions(accounts);
  return positions.length;
}
