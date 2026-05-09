"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RefreshCw, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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
  PortfolioReorderArrows,
  PortfolioSortDropdown,
  sortPortfolios,
  usePortfolioReorder,
  type PortfolioSortKey,
} from "@/components/portfolios/portfolio-sort";
import type { Portfolio } from "@/types/database";

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
  const [showMobilePool, setShowMobilePool] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sheetRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showMobilePool) return;
    const html = document.documentElement;
    html.style.overflow = "hidden";
    const onTouchMove = (e: TouchEvent) => {
      if (sheetRef.current?.contains(e.target as Node)) return;
      e.preventDefault();
    };
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      html.style.overflow = "";
      document.removeEventListener("touchmove", onTouchMove);
    };
  }, [showMobilePool]);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<PortfolioSortKey>("date");

  // Optimistic pool: positions just unassigned appear here instantly
  // before router.refresh() completes.
  const [optimisticPool, setOptimisticPool] = useState<PoolPosition[]>([]);
  const prevPoolRef = useRef(pool);
  useEffect(() => {
    if (prevPoolRef.current !== pool) {
      prevPoolRef.current = pool;
      if (optimisticPool.length > 0) setOptimisticPool([]);
    }
  }, [pool, optimisticPool.length]);
  const effectivePool = useMemo(
    () => [...pool, ...optimisticPool],
    [pool, optimisticPool]
  );

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

  const { effective: effectivePortfolios, move } = usePortfolioReorder(
    portfolios
  );
  const sortedPortfolios = useMemo(
    () => sortPortfolios(effectivePortfolios, sortKey, totalsByPortfolio),
    [effectivePortfolios, sortKey, totalsByPortfolio]
  );

  // Stats-strip totals — same shape as the positions page for visual
  // continuity.
  const poolTotal = useMemo(
    () => effectivePool.reduce((s, p) => s + (Number(p.market_value) || 0), 0),
    [effectivePool]
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
      <div className="mb-4">
        <h1 className="font-display text-3xl font-semibold mb-3">Trade</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {portfolios.length > 1 && (
            <PortfolioSortDropdown value={sortKey} onChange={setSortKey} />
          )}
          <button
            onClick={syncAll}
            disabled={
              syncing ||
              connections.filter((c) => c.provider !== "manual").length === 0
            }
            className="glass-card-light rounded-xl px-3 py-1.5 text-xs flex items-center gap-1.5 hover:bg-[color:var(--dopl-sage)]/40 transition-colors disabled:opacity-40"
          >
            {syncing ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RefreshCw size={12} />
            )}
            {syncing ? "syncing…" : "sync"}
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[7fr_3fr] gap-6 min-w-0">
        <div className="min-w-0">
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
            <button
              type="button"
              onClick={() => setShowMobilePool(true)}
              className="relative rounded-2xl px-3 py-3 sm:px-4 text-left lg:cursor-default lg:pointer-events-none border border-[color:var(--dopl-lime)]/30 bg-[color:var(--dopl-lime)]/[0.04] transition-colors"
            >
              {effectivePool.length > 0 && (
                <span className="absolute top-2.5 right-2.5 lg:hidden flex h-2.5 w-2.5">
                  <span className="absolute inset-0 rounded-full bg-blue-400 opacity-60 animate-ping" />
                  <span className="relative rounded-full h-2.5 w-2.5 bg-blue-400" />
                </span>
              )}
              <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/45 mb-1">
                unassigned
              </p>
              <p className="font-display text-xl sm:text-2xl font-semibold tabular-nums leading-none">
                {effectivePool.length}
              </p>
              <p className="text-[10px] sm:text-[11px] text-[color:var(--dopl-lime)]/85 font-mono mt-1 tabular-nums">
                {formatMoney(poolTotal)}
              </p>
            </button>
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

          <section>
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
                {sortedPortfolios.map((p, idx) => {
                  const showArrows =
                    sortKey === "custom" && sortedPortfolios.length > 1;
                  const card = (
                    <ExpandablePortfolioCard
                      portfolio={p}
                      positions={positionsByPortfolio.get(p.id) ?? []}
                      isExpanded={expandedId === p.id}
                      onToggle={() =>
                        setExpandedId(expandedId === p.id ? null : p.id)
                      }
                      onDelete={() => handleDelete(p.id)}
                      brokerProvider={brokerProvider}
                      onUnassigned={(pos) => {
                        setOptimisticPool((prev) => [
                          ...prev,
                          {
                            id: pos.id,
                            ticker: pos.ticker,
                            name: pos.name,
                            shares: pos.shares,
                            current_price: pos.current_price,
                            market_value: pos.market_value,
                            gain_loss_pct: pos.gain_loss_pct ?? null,
                            entry_price: null,
                            broker_connection_id: null,
                          },
                        ]);
                      }}
                    />
                  );
                  return (
                    <div key={p.id}>
                      {showArrows ? (
                        <div className="flex items-stretch gap-2">
                          <PortfolioReorderArrows
                            onUp={() => void move(sortedPortfolios, p.id, "up")}
                            onDown={() =>
                              void move(sortedPortfolios, p.id, "down")
                            }
                            canUp={idx > 0}
                            canDown={idx < sortedPortfolios.length - 1}
                            position={idx + 1}
                          />
                          <div className="flex-1 min-w-0">{card}</div>
                        </div>
                      ) : (
                        card
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Desktop: pool inline on the right, aligned with stat cards */}
        <section className="hidden lg:block">
          <PoolPane
            pool={effectivePool}
            connections={connections}
            portfolios={portfolioStubs}
            onChanged={() => router.refresh()}
          />
        </section>
      </div>

      {/* Mobile: bottom sheet triggered by unassigned stat card */}
      <div className="lg:hidden">
        <AnimatePresence>
          {showMobilePool && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 z-[70] bg-[color:var(--dopl-deep)]/50"
              onClick={() => setShowMobilePool(false)}
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showMobilePool && (
            <motion.div
              ref={sheetRef}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
              className="fixed bottom-0 left-0 right-0 z-[71] max-h-[55vh] rounded-t-2xl p-5 pb-8 border-t border-[color:var(--dopl-cream)]/10"
              style={{
                background: "rgba(13, 30, 24, 0.95)",
                overflowY: "scroll",
                WebkitOverflowScrolling: "touch",
                overscrollBehavior: "contain",
              }}
            >
              <div className="flex justify-center mb-3">
                <div className="w-10 h-1 rounded-full bg-[color:var(--dopl-cream)]/20" />
              </div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="font-display text-lg font-semibold">Unassigned</h2>
                  <span className="text-xs text-[color:var(--dopl-cream)]/40 font-mono">
                    {effectivePool.length} positions
                  </span>
                </div>
                <button
                  onClick={() => setShowMobilePool(false)}
                  className="p-1.5 rounded-lg text-[color:var(--dopl-cream)]/40 hover:text-[color:var(--dopl-cream)] hover:bg-[color:var(--dopl-sage)]/30 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              <PoolPane
                pool={effectivePool}
                connections={connections}
                portfolios={portfolioStubs}
                onChanged={() => {
                  router.refresh();
                  setShowMobilePool(false);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
