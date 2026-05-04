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
  await Promise.all(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    positions.map((p: any) =>
      supabase
        .from("positions")
        .update({
          allocation_pct: ((Number(p.market_value) || 0) / total) * 100,
        })
        .eq("id", p.id)
    )
  );
}
