"use client";

import { useMemo, useState } from "react";
import { Briefcase, Loader2, RefreshCw, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { fireToast } from "@/components/ui/toast";
import {
  PoolPane,
  formatMoney,
  type PoolConnection,
  type PoolPortfolio,
  type PoolPosition,
} from "@/components/positions/pool-pane";
import ExpandablePortfolioCard, {
  type PositionRow as AssignedPositionRow,
} from "../portfolios/expandable-portfolio-card";
import {
  PortfolioSortDropdown,
  sortPortfolios,
  type PortfolioSortKey,
} from "@/components/portfolios/portfolio-sort";
import type { Portfolio } from "@/types/database";

type TabKey = "portfolios" | "pool";

/**
 * Sprint 17 Trade page client. Desktop renders both halves side by side;
 * mobile collapses into a "Portfolios | Pool" tab bar. Both halves are
 * composed from existing components — ExpandablePortfolioCard for the
 * portfolio list and PoolPane for the centralized pool — so behaviour
 * stays consistent with /dashboard/portfolios and /dashboard/positions.
 */
export default function TradeClient({
  portfolios,
  portfolioStubs,
  connections,
  pool,
  assigned,
  brokerProvider,
  stripeOnboarded,
}: {
  portfolios: Portfolio[];
  portfolioStubs: PoolPortfolio[];
  connections: PoolConnection[];
  pool: PoolPosition[];
  assigned: AssignedPositionRow[];
  brokerProvider: string | null;
  stripeOnboarded: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("portfolios");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<PortfolioSortKey>("date");

  // Suppress unused — kept on the props surface for future tier-gating
  // hooks (the portfolio cards already render a stripe-not-onboarded
  // amber CTA via brokerProvider; stripeOnboarded is reserved for the
  // same path on the trade page if/when we add it here).
  void stripeOnboarded;

  const positionsByPortfolio = useMemo(() => {
    const map = new Map<string, AssignedPositionRow[]>();
    for (const p of assigned) {
      const list = map.get(p.portfolio_id) ?? [];
      list.push(p);
      map.set(p.portfolio_id, list);
    }
    return map;
  }, [assigned]);

  const totalsByPortfolio = useMemo(() => {
    const map = new Map<string, { value: number; count: number }>();
    for (const [pid, list] of positionsByPortfolio) {
      const value = list.reduce(
        (s, p) => s + (Number(p.market_value) || 0),
        0
      );
      map.set(pid, { value, count: list.length });
    }
    return map;
  }, [positionsByPortfolio]);

  const sortedPortfolios = useMemo(
    () => sortPortfolios(portfolios, sortKey, totalsByPortfolio),
    [portfolios, sortKey, totalsByPortfolio]
  );

  // Stats-strip totals — same shape as the positions page for visual
  // continuity.
  const poolTotal = useMemo(
    () => pool.reduce((s, p) => s + (Number(p.market_value) || 0), 0),
    [pool]
  );
  const assignedTotal = useMemo(
    () => assigned.reduce((s, p) => s + (Number(p.market_value) || 0), 0),
    [assigned]
  );
  const activeConnectionCount = useMemo(
    () => connections.filter((c) => c.is_active).length,
    [connections]
  );

  const syncAll = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/broker/sync-all", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "sync failed");
      fireToast({
        title: "synced",
        body: `${data.count ?? 0} positions updated${
          data.sold ? ` · ${data.sold} removed` : ""
        }`,
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("delete this portfolio?")) return;
    await fetch(`/api/portfolios/${id}`, { method: "DELETE" });
    router.refresh();
  };

  if (connections.length === 0 && portfolios.length === 0) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold mb-2">Trade</h1>
        <div className="glass-card p-12 text-center max-w-lg">
          <p className="text-[color:var(--dopl-cream)]/60 mb-4">
            connect a broker and create a portfolio to start trading
          </p>
          <a href="/dashboard/connect" className="btn-lime text-sm px-6 py-2.5">
            connect broker
          </a>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <h1 className="font-display text-3xl font-semibold">Trade</h1>
        <div className="flex items-center gap-3 flex-wrap">
          {portfolios.length > 1 && (
            <PortfolioSortDropdown value={sortKey} onChange={setSortKey} />
          )}
          <button
            onClick={syncAll}
            disabled={
              syncing ||
              connections.filter((c) => c.provider !== "manual").length === 0
            }
            className="glass-card-light px-4 py-2 text-sm flex items-center gap-2 hover:bg-[color:var(--dopl-sage)]/40 transition-colors disabled:opacity-40"
          >
            {syncing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            {syncing ? "syncing…" : "sync all"}
          </button>
        </div>
      </div>
      <p className="text-[color:var(--dopl-cream)]/50 text-sm mb-4">
        portfolios on the left, broker pool on the right — assign in one
        place.
      </p>

      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
        <div className="glass-card-light rounded-2xl px-3 py-3 sm:px-4 border-l-2 border-[color:var(--dopl-lime)]/55">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/45 mb-1">
            pool
          </p>
          <p className="font-display text-xl sm:text-2xl font-semibold tabular-nums leading-none">
            {pool.length}
          </p>
          <p className="text-[10px] sm:text-[11px] text-[color:var(--dopl-lime)]/85 font-mono mt-1 tabular-nums">
            {formatMoney(poolTotal)}
          </p>
        </div>
        <div className="glass-card-light rounded-2xl px-3 py-3 sm:px-4 border-l-2 border-[color:var(--dopl-cream)]/40">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/45 mb-1">
            assigned
          </p>
          <p className="font-display text-xl sm:text-2xl font-semibold tabular-nums leading-none">
            {assigned.length}
          </p>
          <p className="text-[10px] sm:text-[11px] text-[color:var(--dopl-cream)]/75 font-mono mt-1 tabular-nums">
            {formatMoney(assignedTotal)}
          </p>
        </div>
        <div className="glass-card-light rounded-2xl px-3 py-3 sm:px-4 border-l-2 border-[color:var(--dopl-sage)]/70">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/45 mb-1">
            connections
          </p>
          <p className="font-display text-xl sm:text-2xl font-semibold tabular-nums leading-none">
            {activeConnectionCount}
          </p>
          <p className="text-[10px] sm:text-[11px] text-[color:var(--dopl-cream)]/45 font-mono mt-1">
            active
          </p>
        </div>
      </div>

      {error && (
        <div className="glass-card-light p-3 border border-red-500/30 text-sm text-red-300 mb-6 rounded-xl">
          {error}
        </div>
      )}

      {/* Mobile tab bar — picks one half at a time. Desktop hides this and
          renders both halves side by side below. */}
      <div className="lg:hidden mb-5">
        <div className="grid grid-cols-2 gap-1 glass-card-light rounded-xl p-1">
          <button
            onClick={() => setTab("portfolios")}
            className={`flex items-center justify-center gap-2 py-2 text-xs rounded-lg transition-colors ${
              tab === "portfolios"
                ? "bg-[color:var(--dopl-lime)]/15 text-[color:var(--dopl-lime)]"
                : "text-[color:var(--dopl-cream)]/55 hover:text-[color:var(--dopl-cream)]"
            }`}
          >
            <Briefcase size={13} />
            portfolios
          </button>
          <button
            onClick={() => setTab("pool")}
            className={`flex items-center justify-center gap-2 py-2 text-xs rounded-lg transition-colors ${
              tab === "pool"
                ? "bg-[color:var(--dopl-lime)]/15 text-[color:var(--dopl-lime)]"
                : "text-[color:var(--dopl-cream)]/55 hover:text-[color:var(--dopl-cream)]"
            }`}
          >
            <Wallet size={13} />
            pool
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <section
          className={tab === "portfolios" ? "block" : "hidden lg:block"}
        >
          <header className="hidden lg:flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold flex items-center gap-2">
              Portfolios
              <span className="text-xs text-[color:var(--dopl-cream)]/40 font-mono font-normal">
                {portfolios.length}
              </span>
            </h2>
          </header>

          {portfolios.length === 0 ? (
            <div className="glass-card p-8 text-center text-sm text-[color:var(--dopl-cream)]/40 rounded-2xl">
              <p className="mb-3">no portfolios yet</p>
              <a
                href="/dashboard/portfolios"
                className="btn-lime text-xs px-4 py-2 inline-flex items-center gap-2"
              >
                create a portfolio
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedPortfolios.map((p) => (
                <ExpandablePortfolioCard
                  key={p.id}
                  portfolio={p}
                  positions={positionsByPortfolio.get(p.id) ?? []}
                  isExpanded={expandedId === p.id}
                  onToggle={() =>
                    setExpandedId(expandedId === p.id ? null : p.id)
                  }
                  onDelete={() => handleDelete(p.id)}
                  brokerProvider={brokerProvider}
                />
              ))}
            </div>
          )}
        </section>

        <section className={tab === "pool" ? "block" : "hidden lg:block"}>
          <PoolPane
            pool={pool}
            connections={connections}
            portfolios={portfolioStubs}
            onChanged={() => router.refresh()}
          />
        </section>
      </div>
    </div>
  );
}
