"use client";

/**
 * Sprint 17: portfolio sort selector + sort helper. Reused on both
 * /dashboard/portfolios and /dashboard/trade so the FM's chosen sort
 * is consistent across the two surfaces.
 *
 * Sorting is client-side — N is small (typical FM has 2–20 portfolios)
 * and avoiding a server round-trip keeps the dropdown change feeling
 * instant.
 */

export type PortfolioSortKey =
  | "date"
  | "value"
  | "positions"
  | "subscribers"
  | "custom";

export const PORTFOLIO_SORT_OPTIONS: { value: PortfolioSortKey; label: string }[] = [
  { value: "date", label: "date created" },
  { value: "value", label: "market value" },
  { value: "positions", label: "position count" },
  { value: "subscribers", label: "subscribers" },
  { value: "custom", label: "custom order" },
];

interface SortablePortfolio {
  id: string;
  created_at: string;
  subscriber_count: number;
  display_order: number;
}

export function sortPortfolios<P extends SortablePortfolio>(
  portfolios: P[],
  sortKey: PortfolioSortKey,
  totalsByPortfolio?: Map<string, { value: number; count: number }>
): P[] {
  const sorted = [...portfolios];
  switch (sortKey) {
    case "date":
      // ASC = oldest first. Keeps the visual creation order stable as
      // new portfolios append to the end (matches Custom order's
      // "max + 1" stamping convention).
      sorted.sort((a, b) => a.created_at.localeCompare(b.created_at));
      break;
    case "value":
      sorted.sort(
        (a, b) =>
          (totalsByPortfolio?.get(b.id)?.value ?? 0) -
          (totalsByPortfolio?.get(a.id)?.value ?? 0)
      );
      break;
    case "positions":
      sorted.sort(
        (a, b) =>
          (totalsByPortfolio?.get(b.id)?.count ?? 0) -
          (totalsByPortfolio?.get(a.id)?.count ?? 0)
      );
      break;
    case "subscribers":
      sorted.sort((a, b) => b.subscriber_count - a.subscriber_count);
      break;
    case "custom":
      // display_order ASC with created_at ASC tiebreaker. Without the
      // tiebreaker, any portfolios still at default 0 (pre-migration
      // backfill) shuffle non-deterministically.
      sorted.sort((a, b) => {
        const orderDiff = a.display_order - b.display_order;
        if (orderDiff !== 0) return orderDiff;
        return a.created_at.localeCompare(b.created_at);
      });
      break;
  }
  return sorted;
}

export function PortfolioSortDropdown({
  value,
  onChange,
  className,
}: {
  value: PortfolioSortKey;
  onChange: (k: PortfolioSortKey) => void;
  className?: string;
}) {
  return (
    <label
      className={`inline-flex items-center gap-2 ${className ?? ""}`}
    >
      <span className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/40">
        sort
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as PortfolioSortKey)}
        className="bg-[color:var(--dopl-deep)] border border-[color:var(--dopl-sage)]/30 rounded-lg px-3 py-1.5 text-xs text-[color:var(--dopl-cream)] focus:outline-none focus:border-[color:var(--dopl-lime)]/50"
      >
        {PORTFOLIO_SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
