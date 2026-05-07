"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Check,
  Landmark,
  PencilLine,
} from "lucide-react";
import { fireToast } from "@/components/ui/toast";

/**
 * Sprint 17: extracted from positions-client.tsx so /dashboard/positions
 * and /dashboard/trade share one pool implementation. No logic changes
 * vs the Sprint 16 in-place version — this is a pure extraction.
 *
 * PoolPane = the left-side pool view: a per-broker section list with
 * checkboxes, a batch-assign control bar that fades in when any item
 * is selected, and a fallback "Other" bucket for legacy positions
 * with NULL broker_connection_id.
 *
 * Callers own page-level stats (pool/assigned/connections pills) and
 * wrap PoolPane with whatever structure their layout needs. The pane
 * emits onChanged after a successful assign so the caller can refresh.
 */

export interface PoolPosition {
  id: string;
  ticker: string;
  name: string | null;
  shares: number | null;
  current_price: number | null;
  market_value: number | null;
  gain_loss_pct: number | null;
  entry_price: number | null;
  broker_connection_id: string | null;
}

export interface PoolConnection {
  id: string;
  provider: "snaptrade" | "saltedge" | "manual";
  broker_name: string;
  is_active: boolean;
}

export interface PoolPortfolio {
  id: string;
  name: string;
  tier: string;
  price_cents: number;
}

const PROVIDER_ICON = {
  snaptrade: Building2,
  saltedge: Landmark,
  manual: PencilLine,
} as const;

// Compact money label. Whole-dollar precision keeps section headers
// tight on mobile.
export const formatMoney = (n: number) =>
  `$${Math.round(n).toLocaleString("en-US")}`;

export function PoolPane({
  pool,
  connections,
  portfolios,
  onChanged,
}: {
  pool: PoolPosition[];
  connections: PoolConnection[];
  portfolios: PoolPortfolio[];
  onChanged: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignTargetId, setAssignTargetId] = useState<string>("");
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const prevPoolRef = useRef(pool);

  // Clear optimistic hidden state when server-refreshed pool arrives.
  useEffect(() => {
    if (prevPoolRef.current !== pool) {
      prevPoolRef.current = pool;
      if (hiddenIds.size > 0) setHiddenIds(new Set());
    }
  }, [pool, hiddenIds.size]);

  const visiblePool = useMemo(
    () => (hiddenIds.size === 0 ? pool : pool.filter((p) => !hiddenIds.has(p.id))),
    [pool, hiddenIds]
  );

  // Group pool by connection. Insertion order preserved by iterating
  // connections in the order the server returned them.
  const poolByConnection = useMemo(() => {
    const map = new Map<string, PoolPosition[]>();
    for (const c of connections) map.set(c.id, []);
    map.set("__orphan__", []);
    for (const p of visiblePool) {
      const key = p.broker_connection_id ?? "__orphan__";
      const list = map.get(key) ?? [];
      list.push(p);
      map.set(key, list);
    }
    return map;
  }, [visiblePool, connections]);

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
      fireToast({ title: `assigned ${selected.size} to ${portfolioName}` });
      setHiddenIds(new Set([...hiddenIds, ...selected]));
      setSelected(new Set());
      setAssignTargetId("");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "assign failed");
    } finally {
      setAssigning(false);
    }
  };

  return (
    <section>
      <header className="flex items-center justify-between mb-4 gap-2">
        <h2 className="font-display text-lg font-semibold flex items-center gap-2">
          Centralized Pool
          <span className="text-xs text-[color:var(--dopl-cream)]/40 font-mono font-normal">
            {visiblePool.length}
          </span>
        </h2>
        {selected.size > 0 && (
          <span className="text-xs text-[color:var(--dopl-lime)] font-mono">
            {selected.size} selected
          </span>
        )}
      </header>

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

      {error && (
        <div className="glass-card-light p-3 border border-red-500/30 text-sm text-red-300 mb-4 rounded-xl">
          {error}
        </div>
      )}

      {visiblePool.length === 0 ? (
        <div className="glass-card p-8 text-center text-sm text-[color:var(--dopl-cream)]/40 rounded-2xl">
          {connections.length === 0
            ? "connect a broker to sync positions"
            : "all positions assigned · sync to refresh"}
        </div>
      ) : (
        <div className="space-y-5">
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
  );
}

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
  items: PoolPosition[];
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
                  : "border border-[color:var(--dopl-sage)]/20 hover:border-[color:var(--dopl-sage)]/40"
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
                    {p.entry_price != null
                      ? ` @ $${Number(p.entry_price).toFixed(2)}`
                      : ""}
                  </p>
                )}
              </div>
              <div className="text-right text-[11px] font-mono tabular-nums w-20">
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
                {p.gain_loss_pct != null && (
                  <p
                    className={
                      p.gain_loss_pct >= 0
                        ? "text-[color:var(--dopl-lime)]/65"
                        : "text-red-400/55"
                    }
                  >
                    {p.gain_loss_pct >= 0 ? "+" : ""}
                    {p.gain_loss_pct.toFixed(1)}%
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
