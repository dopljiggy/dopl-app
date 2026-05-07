"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

/**
 * Sprint 17: portfolio sort selector + sort helper + reorder hook +
 * arrow-button reorder controls. Reused on both /dashboard/portfolios
 * and /dashboard/trade so the FM's chosen sort + custom order is
 * consistent across the two surfaces.
 *
 * Sorting is client-side — N is small (typical FM has 2–20 portfolios)
 * and avoiding a server round-trip keeps the dropdown change feeling
 * instant.
 *
 * Reorder uses up/down arrow buttons (per Sprint 17 plan §Task 8 scope
 * guard — `@hello-pangea/dnd` flagged for React 19 friction). Arrows
 * work on touch + desktop equally; cross-list drag (8b) is deferred.
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

/**
 * Custom-order reorder hook. Maintains an in-memory display_order
 * override Map so swaps render instantly without waiting on the API
 * or router.refresh, and persists each swap to /api/portfolios/reorder.
 *
 * Stale override entries (e.g. for portfolios deleted in another tab)
 * are harmless — they apply to nothing and dropping them costs more
 * than carrying them.
 */
export function usePortfolioReorder<P extends SortablePortfolio>(
  portfolios: P[]
): {
  effective: P[];
  move: (sorted: P[], id: string, direction: "up" | "down") => Promise<void>;
} {
  const [overrides, setOverrides] = useState<Map<string, number>>(new Map());

  const effective = useMemo(() => {
    if (overrides.size === 0) return portfolios;
    return portfolios.map((p) =>
      overrides.has(p.id)
        ? { ...p, display_order: overrides.get(p.id) ?? p.display_order }
        : p
    );
  }, [portfolios, overrides]);

  const move = useCallback(
    async (sorted: P[], id: string, direction: "up" | "down") => {
      const idx = sorted.findIndex((p) => p.id === id);
      if (idx < 0) return;
      const target = direction === "up" ? idx - 1 : idx + 1;
      if (target < 0 || target >= sorted.length) return;

      const next = [...sorted];
      [next[idx], next[target]] = [next[target], next[idx]];

      // Re-stamp the entire moved set so display_order stays dense
      // (1, 2, 3, …) and prevents drift over many reorders.
      const newOverrides = new Map(overrides);
      next.forEach((p, i) => newOverrides.set(p.id, i + 1));
      setOverrides(newOverrides);

      try {
        await fetch("/api/portfolios/reorder", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            order: next.map((p, i) => ({ id: p.id, display_order: i + 1 })),
          }),
        });
      } catch (err) {
        console.warn("portfolio reorder failed:", err);
      }
    },
    [overrides]
  );

  return { effective, move };
}

/** Up/down arrow pair shown beside a portfolio card in custom-order mode. */
export function PortfolioReorderArrows({
  onUp,
  onDown,
  canUp,
  canDown,
}: {
  onUp: () => void;
  onDown: () => void;
  canUp: boolean;
  canDown: boolean;
}) {
  const baseBtn =
    "w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed";
  return (
    <div className="flex flex-col gap-1 self-start mt-2 flex-shrink-0">
      <button
        type="button"
        onClick={onUp}
        disabled={!canUp}
        aria-label="move up"
        className={`${baseBtn} glass-card-light hover:bg-[color:var(--dopl-sage)]/40`}
      >
        <ChevronUp size={14} />
      </button>
      <button
        type="button"
        onClick={onDown}
        disabled={!canDown}
        aria-label="move down"
        className={`${baseBtn} glass-card-light hover:bg-[color:var(--dopl-sage)]/40`}
      >
        <ChevronDown size={14} />
      </button>
    </div>
  );
}
