/**
 * Recompute every position's allocation_pct from its market_value share
 * of the portfolio total. Shared by /api/positions/assign and
 * /api/positions/manual (the trading-terminal flow). Both call this on
 * every insert AND every delete so the column stays in sync without the
 * FM hitting a manual 'rebalance to 100%' button.
 *
 * Edge cases:
 *   - Empty portfolio (no rows) → no-op
 *   - Total market_value is zero (e.g., every row missing a price) → no-op,
 *     leaves existing allocation_pct untouched. This is the "all positions
 *     priceless" case that's rare in practice.
 *   - A row with null/zero market_value → receives 0% allocation; its
 *     siblings absorb the proportional share via the existing total.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function recalculateAllocations(supabase: any, portfolioId: string) {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allocations = positions.map((p: any) => ({
    id: p.id,
    pct: Number((((Number(p.market_value) || 0) / total) * 100).toFixed(2)),
  }));

  // Correct rounding drift so the sum is exactly 100.
  const rawSum = allocations.reduce((a: number, x: { pct: number }) => a + x.pct, 0);
  const drift = Number((100 - rawSum).toFixed(2));
  if (drift !== 0 && allocations.length > 0) {
    const largest = allocations.reduce(
      (max: { pct: number }, x: { pct: number }) => (x.pct > max.pct ? x : max),
      allocations[0]
    );
    largest.pct = Number((largest.pct + drift).toFixed(2));
  }

  await Promise.all(
    allocations.map((a: { id: string; pct: number }) =>
      supabase
        .from("positions")
        .update({ allocation_pct: a.pct })
        .eq("id", a.id)
    )
  );
}
