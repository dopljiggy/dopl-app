export interface PrevPosition {
  id: string;
  ticker: string;
  shares: number;
}

export interface NextPosition {
  ticker: string;
  shares: number;
}

export type PositionChange =
  | {
      type: "sell";
      ticker: string;
      positionId: string;
      prevShares: number;
    }
  | {
      type: "rebalance";
      ticker: string;
      positionId: string;
      prevShares: number;
      shares: number;
    };

const SHARES_EPSILON = 1e-4;

function norm(t: string): string {
  return t.trim().toUpperCase();
}

/**
 * Diffs a portfolio's already-assigned positions against the current live
 * broker holdings. Emits sell/rebalance only. Buys are NEVER emitted here —
 * new broker tickers remain in the "unassigned" pool until the FM explicitly
 * assigns them via /api/positions/assign.
 *
 * The caller is responsible for calling this once per portfolio, passing
 * only that portfolio's `prev` positions.
 */
export function computeChanges(
  prev: PrevPosition[],
  next: NextPosition[]
): PositionChange[] {
  const nextMap = new Map(next.map((n) => [norm(n.ticker), n]));
  const changes: PositionChange[] = [];

  for (const p of prev) {
    const key = norm(p.ticker);
    const liveMatch = nextMap.get(key);
    if (!liveMatch) {
      changes.push({
        type: "sell",
        ticker: p.ticker,
        positionId: p.id,
        prevShares: p.shares,
      });
      continue;
    }
    if (Math.abs(p.shares - liveMatch.shares) > SHARES_EPSILON) {
      changes.push({
        type: "rebalance",
        ticker: p.ticker,
        positionId: p.id,
        prevShares: p.shares,
        shares: liveMatch.shares,
      });
    }
  }

  return changes;
}
