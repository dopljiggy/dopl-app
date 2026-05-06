"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Check,
  Download,
  Landmark,
  Loader2,
  PencilLine,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Undo2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { downloadCsv } from "@/lib/csv";
import { fireToast } from "@/components/ui/toast";

interface PortfolioStub {
  id: string;
  name: string;
  tier: string;
  price_cents: number;
}

interface ConnectionStub {
  id: string;
  provider: "snaptrade" | "saltedge" | "manual";
  broker_name: string;
  is_active: boolean;
}

interface PositionRow {
  id: string;
  ticker: string;
  name: string | null;
  shares: number | null;
  current_price: number | null;
  market_value: number | null;
  allocation_pct: number | null;
  gain_loss_pct: number | null;
  portfolio_id: string | null;
  broker_connection_id: string | null;
  last_synced: string | null;
}

const PROVIDER_ICON = {
  snaptrade: Building2,
  saltedge: Landmark,
  manual: PencilLine,
} as const;

// Compact money label used on the stats strip + every section header.
// Whole-dollar precision — penny-level noise is irrelevant for at-a-glance
// totals and forces wider columns on mobile.
const formatMoney = (n: number) =>
  `$${Math.round(n).toLocaleString("en-US")}`;

/**
 * Sprint 15 positions page.
 *
 * Left:  centralized pool — pool positions grouped by broker_connection.
 *        Checkbox per position, batch "Assign to Portfolio" when any selected.
 * Right: assigned positions grouped by portfolio, broker badge per row.
 *        Per-row unassign returns the position to the pool (not deleted).
 *
 * Sync All hits /api/broker/sync-all so the FM doesn't have to bounce
 * back to the connect page just to refresh.
 */
export default function PositionsClient({
  portfolios,
  connections,
  positions,
}: {
  portfolios: PortfolioStub[];
  connections: ConnectionStub[];
  positions: PositionRow[];
}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignTargetId, setAssignTargetId] = useState<string>("");
  const [assigning, setAssigning] = useState(false);
  const [unassigningId, setUnassigningId] = useState<string | null>(null);

  // Connection lookup for badges + section headers.
  const connById = useMemo(
    () => new Map(connections.map((c) => [c.id, c])),
    [connections]
  );

  // Split positions into pool / assigned based on portfolio_id.
  const pool = useMemo(
    () => positions.filter((p) => p.portfolio_id == null),
    [positions]
  );
  const assigned = useMemo(
    () => positions.filter((p) => p.portfolio_id != null),
    [positions]
  );

  // Group pool by connection. Insertion order preserved by iterating
  // connections in the order the server returned them (created_at asc).
  const poolByConnection = useMemo(() => {
    const map = new Map<string, PositionRow[]>();
    for (const c of connections) map.set(c.id, []);
    // Bucket for legacy/orphaned positions with no connection.
    map.set("__orphan__", []);
    for (const p of pool) {
      const key = p.broker_connection_id ?? "__orphan__";
      const list = map.get(key) ?? [];
      list.push(p);
      map.set(key, list);
    }
    return map;
  }, [pool, connections]);

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

  // Sprint 16: dollar totals power the stats strip + per-section header
  // value labels. market_value is normalised in the sync engine so these
  // sums are in account currency (USD for now). null/undefined coerces to
  // 0 — a position without a price yet contributes nothing.
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

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleConnection = (connectionId: string, checked: boolean) => {
    const ids = (poolByConnection.get(connectionId) ?? []).map((p) => p.id);
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

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

  const assignSelected = async () => {
    if (!assignTargetId || selected.size === 0) return;
    setAssigning(true);
    setError(null);
    try {
      const res = await fetch("/api/positions/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolio_id: assignTargetId,
          position_ids: Array.from(selected),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "assign failed");
      const portfolioName =
        portfolios.find((p) => p.id === assignTargetId)?.name ?? "portfolio";
      fireToast({
        title: `assigned ${selected.size} to ${portfolioName}`,
      });
      setSelected(new Set());
      setAssignTargetId("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "assign failed");
    } finally {
      setAssigning(false);
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

  // Empty state: no broker connections and no portfolios — render the
  // "connect a broker" CTA. Existing FMs with portfolios but zero
  // connections see the regular layout with empty pool sections.
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
          <button
            onClick={syncAll}
            disabled={syncing || connections.filter((c) => c.provider !== "manual").length === 0}
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
        positions land in the pool from each broker. select them and assign
        to a portfolio — doplers see the assignment instantly.
      </p>

      {/* Summary stats strip — gives the page focal points without
          duplicating the donut chart on the portfolios page. Three
          glass pills: pool size, assigned size, active broker count.
          Each pill carries a left-edge accent border so the eye picks
          up the difference between pool / assigned / connections. */}
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

      <div className="grid lg:grid-cols-2 gap-8">
        {/* ─── LEFT: pool ─── */}
        <section>
          <header className="flex items-center justify-between mb-4 gap-2">
            <h2 className="font-display text-lg font-semibold flex items-center gap-2">
              Centralized Pool
              <span className="text-xs text-[color:var(--dopl-cream)]/40 font-mono font-normal">
                {pool.length}
              </span>
            </h2>
            {selected.size > 0 && (
              <span className="text-xs text-[color:var(--dopl-lime)] font-mono">
                {selected.size} selected
              </span>
            )}
          </header>

          {/* Batch assign controls — only show when any selected. */}
          <AnimatePresence>
            {selected.size > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mb-4"
              >
                <div className="glass-card-light rounded-xl p-3 flex items-center gap-2 flex-wrap">
                  <select
                    value={assignTargetId}
                    onChange={(e) => setAssignTargetId(e.target.value)}
                    className="bg-[color:var(--dopl-deep)] border border-[color:var(--dopl-sage)]/30 rounded-lg px-3 py-2 text-xs text-[color:var(--dopl-cream)] focus:outline-none focus:border-[color:var(--dopl-lime)]/50"
                  >
                    <option value="" disabled>
                      assign to portfolio…
                    </option>
                    {portfolios.map((pf) => (
                      <option key={pf.id} value={pf.id}>
                        {pf.name} ({pf.tier})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={assignSelected}
                    disabled={!assignTargetId || assigning}
                    className="btn-lime text-xs px-4 py-2 disabled:opacity-50"
                  >
                    {assigning ? "assigning…" : `assign ${selected.size}`}
                  </button>
                  <button
                    onClick={() => setSelected(new Set())}
                    className="text-xs px-3 py-2 text-[color:var(--dopl-cream)]/50 hover:text-[color:var(--dopl-cream)]"
                  >
                    clear
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {pool.length === 0 ? (
            <div className="glass-card p-8 text-center text-sm text-[color:var(--dopl-cream)]/40 rounded-2xl">
              {connections.length === 0
                ? "connect a broker to sync positions"
                : "all positions assigned · sync to refresh"}
            </div>
          ) : (
            <div className="space-y-5">
              {/* Render a section per connection that has pool items, in
                  the connections-array order, then the orphan bucket
                  last (only if non-empty). */}
              {connections.map((c) => {
                const items = poolByConnection.get(c.id) ?? [];
                if (items.length === 0) return null;
                return (
                  <PoolSection
                    key={c.id}
                    label={c.broker_name}
                    sublabel={c.provider === "manual" ? "manual entry" : `via ${c.provider}`}
                    icon={PROVIDER_ICON[c.provider]}
                    items={items}
                    selected={selected}
                    onToggle={toggle}
                    onToggleAll={(v) => toggleConnection(c.id, v)}
                  />
                );
              })}
              {(poolByConnection.get("__orphan__") ?? []).length > 0 && (
                <PoolSection
                  label="Other"
                  sublabel="legacy positions"
                  icon={PencilLine}
                  items={poolByConnection.get("__orphan__") ?? []}
                  selected={selected}
                  onToggle={toggle}
                  onToggleAll={(v) => toggleConnection("__orphan__", v)}
                />
              )}
            </div>
          )}
        </section>

        {/* ─── RIGHT: assigned ─── */}
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
                        {/* Tier badge mirrors the expandable portfolio card
                            (free + vip in lime, others in sage). Anchors
                            the row visually so the eye groups by tier. */}
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
                                  {it.shares != null ? `${it.shares} sh` : ""}
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

// --------------------------------------------------------------------------

function PoolSection({
  label,
  sublabel,
  icon: Icon,
  items,
  selected,
  onToggle,
  onToggleAll,
}: {
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  items: PositionRow[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (v: boolean) => void;
}) {
  const allSelected = items.length > 0 && items.every((p) => selected.has(p.id));
  const someSelected = items.some((p) => selected.has(p.id));
  const sectionTotal = items.reduce(
    (s, p) => s + (Number(p.market_value) || 0),
    0
  );
  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <button
          type="button"
          onClick={() => onToggleAll(!allSelected)}
          aria-label={allSelected ? "deselect all" : "select all"}
          className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors flex-shrink-0 ${
            allSelected
              ? "bg-[color:var(--dopl-lime)] border-[color:var(--dopl-lime)]"
              : someSelected
              ? "bg-[color:var(--dopl-lime)]/30 border-[color:var(--dopl-lime)]/60"
              : "border-[color:var(--dopl-sage)]/40 hover:border-[color:var(--dopl-cream)]/40"
          }`}
        >
          {allSelected && (
            <Check size={12} className="text-[color:var(--dopl-deep)]" strokeWidth={3} />
          )}
        </button>
        <div className="w-9 h-9 rounded-xl bg-[color:var(--dopl-lime)]/12 border border-[color:var(--dopl-lime)]/25 flex items-center justify-center text-[color:var(--dopl-lime)] flex-shrink-0">
          <Icon size={15} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display text-sm font-semibold truncate">{label}</p>
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[color:var(--dopl-cream)]/40">
            {sublabel}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-mono text-sm text-[color:var(--dopl-lime)] tabular-nums leading-none">
            {formatMoney(sectionTotal)}
          </p>
          <p className="text-[10px] text-[color:var(--dopl-cream)]/40 font-mono mt-1">
            {items.length} pos
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        {items.map((p) => {
          const checked = selected.has(p.id);
          return (
            <label
              key={p.id}
              className={`glass-card-light rounded-xl p-3 flex items-center gap-3 text-sm cursor-pointer transition-colors ${
                checked
                  ? "border border-[color:var(--dopl-lime)]/40 bg-[color:var(--dopl-lime)]/[0.04]"
                  : "border border-transparent hover:border-[color:var(--dopl-sage)]/30"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(p.id)}
                className="sr-only"
              />
              <div
                className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors flex-shrink-0 ${
                  checked
                    ? "bg-[color:var(--dopl-lime)] border-[color:var(--dopl-lime)]"
                    : "border-[color:var(--dopl-sage)]/40"
                }`}
              >
                {checked && (
                  <Check
                    size={12}
                    className="text-[color:var(--dopl-deep)]"
                    strokeWidth={3}
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-mono font-semibold text-sm text-[color:var(--dopl-cream)]">
                  {p.ticker}
                </p>
                {p.name && (
                  <p className="text-[11px] text-[color:var(--dopl-cream)]/45 truncate">
                    {p.name}
                  </p>
                )}
              </div>
              <div className="text-right text-[11px] font-mono tabular-nums">
                {p.current_price != null && (
                  <p>${Number(p.current_price).toFixed(2)}</p>
                )}
                {p.shares != null && (
                  <p className="text-[color:var(--dopl-cream)]/45">
                    {p.shares} sh
                  </p>
                )}
              </div>
              <div className="text-right text-[11px] font-mono tabular-nums w-16">
                {p.market_value != null && (
                  <p
                    className={
                      p.gain_loss_pct == null
                        ? "text-[color:var(--dopl-cream)]/85"
                        : p.gain_loss_pct >= 0
                        ? "text-[color:var(--dopl-lime)]/85"
                        : "text-red-400/75"
                    }
                  >
                    ${Number(p.market_value).toFixed(0)}
                  </p>
                )}
              </div>
            </label>
          );
        })}
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
