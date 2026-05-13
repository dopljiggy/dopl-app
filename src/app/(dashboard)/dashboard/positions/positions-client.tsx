"use client";

import { useMemo, useState } from "react";
import {
  Download,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Undo2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { downloadCsv } from "@/lib/csv";
import { fireToast } from "@/components/ui/toast";
import {
  PoolPane,
  formatMoney,
  type PoolPosition,
  type PoolConnection,
  type PoolPortfolio,
} from "@/components/positions/pool-pane";

interface PositionRow extends PoolPosition {
  allocation_pct: number | null;
  portfolio_id: string | null;
  last_synced: string | null;
}

/**
 * Sprint 17 positions page.
 *
 * Pool rendering moved to <PoolPane> (`src/components/positions/pool-pane
 * .tsx`) so /dashboard/positions and /dashboard/trade share the same
 * component. This page keeps the page-level chrome — stats strip,
 * sync-all + export CSV controls, and the assigned half on the right.
 */
export default function PositionsClient({
  portfolios,
  connections,
  positions,
}: {
  portfolios: PoolPortfolio[];
  connections: PoolConnection[];
  positions: PositionRow[];
}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unassigningId, setUnassigningId] = useState<string | null>(null);

  const connById = useMemo(
    () => new Map(connections.map((c) => [c.id, c])),
    [connections]
  );

  const pool = useMemo(
    () => positions.filter((p) => p.portfolio_id == null),
    [positions]
  );
  const assigned = useMemo(
    () => positions.filter((p) => p.portfolio_id != null),
    [positions]
  );

  const assignedByPortfolio = useMemo(() => {
    const map = new Map<string, PositionRow[]>();
    for (const p of portfolios) map.set(p.id, []);
    for (const a of assigned) {
      if (!a.portfolio_id) continue;
      const list = map.get(a.portfolio_id) ?? [];
      list.push(a);
      map.set(a.portfolio_id, list);
    }
    return map;
  }, [assigned, portfolios]);

  // Stats-strip totals. market_value is normalised in the sync engine,
  // so a missing value contributes 0 rather than NaN.
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
  const portfolioTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const [pid, items] of assignedByPortfolio) {
      map.set(
        pid,
        items.reduce((s, p) => s + (Number(p.market_value) || 0), 0)
      );
    }
    return map;
  }, [assignedByPortfolio]);

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

  const hasManualConnections = useMemo(
    () => connections.some((c) => c.provider === "manual"),
    [connections]
  );

  const refreshPrices = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/positions/refresh-prices", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "refresh failed");
      fireToast({
        title: "prices refreshed",
        body: `${data.updated ?? 0} positions updated`,
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  const unassign = async (positionId: string) => {
    setUnassigningId(positionId);
    setError(null);
    try {
      const res = await fetch("/api/positions/assign", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position_ids: [positionId] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "unassign failed");
      fireToast({ title: "moved back to pool" });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "unassign failed");
    } finally {
      setUnassigningId(null);
    }
  };

  const exportCsv = () => {
    const portfolioById = new Map(portfolios.map((p) => [p.id, p.name]));
    const rows = assigned.map((p) => [
      p.ticker,
      p.name ?? "",
      p.portfolio_id ? portfolioById.get(p.portfolio_id) ?? "" : "",
      connById.get(p.broker_connection_id ?? "")?.broker_name ?? "",
      p.shares,
      p.current_price,
      p.market_value,
      p.allocation_pct,
      p.gain_loss_pct,
    ]);
    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(
      `dopl-positions-${today}.csv`,
      [
        "ticker",
        "name",
        "portfolio",
        "broker",
        "shares",
        "price",
        "market_value",
        "allocation_pct",
        "gain_loss_pct",
      ],
      rows
    );
  };

  if (connections.length === 0 && portfolios.length === 0) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold mb-2">Positions</h1>
        <div className="glass-card p-12 text-center max-w-lg">
          <p className="text-[color:var(--dopl-cream)]/60 mb-4">
            connect a broker to sync your positions
          </p>
          <a
            href="/dashboard/connect"
            className="btn-lime text-sm px-6 py-2.5"
          >
            connect broker
          </a>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <h1 className="font-display text-3xl font-semibold">Positions</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            disabled={assigned.length === 0}
            className="glass-card-light px-4 py-2 text-sm flex items-center gap-2 hover:bg-[color:var(--dopl-sage)]/40 transition-colors disabled:opacity-40"
          >
            <Download size={14} />
            export CSV
          </button>
          {hasManualConnections && (
            <button
              onClick={refreshPrices}
              disabled={refreshing}
              className="glass-card-light px-4 py-2 text-sm flex items-center gap-2 hover:bg-[color:var(--dopl-sage)]/40 transition-colors disabled:opacity-40"
            >
              {refreshing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              {refreshing ? "refreshing…" : "refresh prices"}
            </button>
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
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
        <div className="glass-card-light rounded-2xl px-3 py-3 sm:px-4 border-l-2 border-[color:var(--dopl-lime)]/55">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/45 mb-1">
            unassigned
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

      <div className="grid lg:grid-cols-2 gap-8">
        <PoolPane
          pool={pool}
          connections={connections}
          portfolios={portfolios}
          onChanged={() => router.refresh()}
        />

        <section>
          <header className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold flex items-center gap-2">
              In Portfolios
              <span className="text-xs text-[color:var(--dopl-cream)]/40 font-mono font-normal">
                {assigned.length}
              </span>
            </h2>
          </header>

          {portfolios.length === 0 ? (
            <div className="glass-card p-8 text-center text-sm text-[color:var(--dopl-cream)]/40 rounded-2xl">
              create a portfolio to start assigning
            </div>
          ) : (
            <div className="space-y-5">
              {portfolios.map((pf) => {
                const items = assignedByPortfolio.get(pf.id) ?? [];
                const isFreeTier = pf.tier === "free" || pf.price_cents === 0;
                const total = portfolioTotals.get(pf.id) ?? 0;
                return (
                  <div
                    key={pf.id}
                    className="glass-card rounded-2xl p-4"
                  >
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span
                          className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded uppercase tracking-wider flex-shrink-0 ${
                            isFreeTier
                              ? "bg-[color:var(--dopl-lime)]/15 text-[color:var(--dopl-lime)]"
                              : pf.tier === "vip"
                              ? "bg-[color:var(--dopl-lime)]/20 text-[color:var(--dopl-lime)]"
                              : "bg-[color:var(--dopl-sage)]/40 text-[color:var(--dopl-cream)]/80"
                          }`}
                        >
                          {isFreeTier
                            ? "free"
                            : `$${(pf.price_cents / 100).toFixed(0)}`}
                        </span>
                        <h3 className="font-display text-base font-semibold truncate">
                          {pf.name}
                        </h3>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-mono text-sm text-[color:var(--dopl-lime)] tabular-nums leading-none">
                          {formatMoney(total)}
                        </p>
                        <p className="text-[10px] text-[color:var(--dopl-cream)]/40 font-mono mt-1">
                          {items.length} position{items.length === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>
                    {items.length === 0 ? (
                      <p className="text-xs text-[color:var(--dopl-cream)]/30">
                        no positions assigned yet
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {items.map((it) => {
                          const conn = it.broker_connection_id
                            ? connById.get(it.broker_connection_id)
                            : null;
                          const gain = (it.gain_loss_pct ?? 0) >= 0;
                          const isUnassigning = unassigningId === it.id;
                          return (
                            <div
                              key={it.id}
                              className="glass-card-light rounded-xl p-3 flex items-center gap-3 text-sm"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-2 flex-wrap">
                                  <span className="font-mono text-base font-bold text-[color:var(--dopl-cream)]">
                                    {it.ticker}
                                  </span>
                                  {it.allocation_pct != null && (
                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[color:var(--dopl-lime)]/15 text-[color:var(--dopl-lime)] tabular-nums">
                                      {it.allocation_pct.toFixed(1)}%
                                    </span>
                                  )}
                                  {conn && <BrokerBadge name={conn.broker_name} />}
                                </div>
                                {it.name && (
                                  <p className="text-[11px] text-[color:var(--dopl-cream)]/55 truncate">
                                    {it.name}
                                  </p>
                                )}
                              </div>
                              <div className="text-right text-[11px] font-mono tabular-nums">
                                <p className="text-[color:var(--dopl-cream)]/85">
                                  {it.current_price != null
                                    ? `$${Number(it.current_price).toFixed(2)}`
                                    : "—"}
                                </p>
                                <p className="text-[color:var(--dopl-cream)]/45">
                                  {it.shares != null ? it.shares : ""}
                                </p>
                              </div>
                              <div className="text-right text-[11px] font-mono tabular-nums w-20">
                                <p className="text-[color:var(--dopl-cream)]/85">
                                  {it.market_value != null
                                    ? `$${Number(it.market_value).toFixed(0)}`
                                    : "—"}
                                </p>
                                <p
                                  className={
                                    gain
                                      ? "text-[color:var(--dopl-lime)] inline-flex items-center gap-0.5 justify-end w-full"
                                      : "text-red-400 inline-flex items-center gap-0.5 justify-end w-full"
                                  }
                                >
                                  {it.gain_loss_pct != null ? (
                                    <>
                                      {gain ? (
                                        <TrendingUp size={9} />
                                      ) : (
                                        <TrendingDown size={9} />
                                      )}
                                      {gain ? "+" : ""}
                                      {it.gain_loss_pct.toFixed(1)}%
                                    </>
                                  ) : null}
                                </p>
                              </div>
                              <button
                                onClick={() => unassign(it.id)}
                                disabled={isUnassigning}
                                className="text-[color:var(--dopl-cream)]/40 hover:text-amber-300 transition-colors p-1.5 rounded-md hover:bg-amber-400/10"
                                aria-label={`unassign ${it.ticker}`}
                                title="unassign — return to pool"
                              >
                                {isUnassigning ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <Undo2 size={12} />
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function BrokerBadge({ name }: { name: string }) {
  return (
    <span className="text-[9px] font-mono uppercase tracking-[0.15em] px-1.5 py-0.5 rounded bg-[color:var(--dopl-sage)]/40 text-[color:var(--dopl-cream)]/70">
      {name}
    </span>
  );
}
