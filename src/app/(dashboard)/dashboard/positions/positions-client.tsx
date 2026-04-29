"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, RefreshCw, Trash2, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  NotifyDoplersModal,
  type PortfolioChangeset,
} from "@/components/ui/notify-doplers-modal";

interface SyncedPosition {
  ticker: string;
  name: string;
  shares: number | null;
  market_value: number | null;
  current_price: number | null;
  asset_type: string;
  last_synced: string;
}

interface AssignedPosition {
  id: string;
  ticker: string;
  name: string | null;
  shares: number | null;
  current_price: number | null;
  market_value: number | null;
  allocation_pct: number | null;
  portfolio_id: string;
}

interface PortfolioStub {
  id: string;
  name: string;
  tier: string;
  price_cents: number;
}

export default function PositionsClient({
  portfolios,
  assignedPositions,
  brokerConnected,
}: {
  portfolios: PortfolioStub[];
  assignedPositions: AssignedPosition[];
  brokerConnected: boolean;
}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState<SyncedPosition[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingTicker, setPendingTicker] = useState<string | null>(null);
  const [pendingChangesets, setPendingChangesets] = useState<
    { portfolio_id: string; portfolio_name: string; changes: unknown[] }[]
  >([]);
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<
    { id: string; ticker: string } | null
  >(null);
  const [removeThesis, setRemoveThesis] = useState("");

  // Tickers already assigned to ANY portfolio.
  const assignedTickers = new Set(assignedPositions.map((p) => p.ticker));
  const unassigned = synced.filter((p) => !assignedTickers.has(p.ticker));

  useEffect(() => {
    // Auto-sync on mount — userInitiated=false suppresses the
    // NotifyDoplersModal. Previously the modal fired on any mount-time
    // sync, which showed a phantom "portfolio updated" popup when
    // navigating to /dashboard/positions right after a manual
    // position edit elsewhere (e.g. the portfolio card's inline form).
    if (brokerConnected) void runSync(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSync = async (userInitiated = false) => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/snaptrade/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "sync failed");
      setSynced(data.positions ?? []);
      if (Array.isArray(data.perPortfolio)) {
        setPendingChangesets(data.perPortfolio);
        if (userInitiated) {
          const hasAny = data.perPortfolio.some(
            (p: { changes: unknown[] }) => p.changes.length > 0
          );
          setShowNotifyModal(hasAny);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const assign = async (pos: SyncedPosition, portfolioId: string) => {
    setPendingTicker(pos.ticker);
    await fetch("/api/positions/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        portfolio_id: portfolioId,
        ticker: pos.ticker,
        name: pos.name,
        shares: pos.shares,
        current_price: pos.current_price,
        market_value: pos.market_value,
        asset_type: pos.asset_type,
      }),
    });
    setPendingTicker(null);
    router.refresh();
  };

  const remove = async (id: string, thesisNote: string) => {
    await fetch("/api/positions/assign", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, thesis_note: thesisNote.trim() || null }),
    });
    setPendingRemove(null);
    setRemoveThesis("");
    router.refresh();
  };

  const handleNotify = async (portfolioId: string) => {
    const cs = pendingChangesets.find((c) => c.portfolio_id === portfolioId);
    if (!cs) return;
    await fetch("/api/portfolios/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        portfolio_id: portfolioId,
        changes: cs.changes,
      }),
    });
  };

  if (!brokerConnected) {
    return (
      <div>
        <h1 className="font-display text-3xl font-semibold mb-2">positions</h1>
        <div className="glass-card p-12 text-center max-w-lg">
          <p className="text-dopl-cream/60 mb-4">
            connect a broker to sync your positions
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
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-display text-3xl font-semibold">positions</h1>
        <button
          onClick={() => runSync(true)}
          disabled={syncing}
          className="glass-card-light px-4 py-2 text-sm flex items-center gap-2 hover:bg-dopl-sage/40 transition-colors"
        >
          {syncing ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <RefreshCw size={14} />
          )}
          {syncing ? "syncing..." : "resync"}
        </button>
      </div>
      <p className="text-dopl-cream/50 text-sm mb-8">
        assign positions from your broker to portfolios. doplers see them
        instantly.
      </p>

      {error && (
        <div className="glass-card-light p-3 border border-red-500/30 text-sm text-red-300 mb-6">
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Unassigned */}
        <section>
          <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
            unassigned
            <span className="text-xs text-dopl-cream/40 font-mono font-normal">
              {syncing ? "..." : unassigned.length}
            </span>
          </h2>
          {syncing && synced.length === 0 ? (
            <div className="glass-card p-8 text-center text-sm text-dopl-cream/40">
              <Loader2 size={20} className="animate-spin mx-auto mb-2" />
              fetching from your broker...
            </div>
          ) : unassigned.length === 0 ? (
            <div className="glass-card p-8 text-center text-sm text-dopl-cream/40">
              all positions assigned
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {unassigned.map((p) => (
                  <motion.div
                    key={p.ticker}
                    layout
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    className="glass-card p-4 flex items-center gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-mono font-semibold text-sm text-dopl-cream">
                        {p.ticker}
                      </p>
                      <p className="text-xs text-dopl-cream/40 truncate">
                        {p.name || p.ticker}
                      </p>
                    </div>
                    <div className="text-right text-xs text-dopl-cream/50 font-mono">
                      {p.market_value != null && (
                        <p>${p.market_value.toFixed(0)}</p>
                      )}
                      {p.shares != null && <p>{p.shares} sh</p>}
                    </div>
                    {portfolios.length === 0 ? (
                      <a
                        href="/dashboard/portfolios"
                        className="text-xs text-dopl-lime hover:underline"
                      >
                        create portfolio first
                      </a>
                    ) : (
                      <select
                        defaultValue=""
                        disabled={pendingTicker === p.ticker}
                        onChange={(e) => {
                          if (e.target.value) assign(p, e.target.value);
                        }}
                        className="bg-dopl-deep border border-dopl-sage/30 rounded-lg px-3 py-2 text-xs text-dopl-cream focus:outline-none focus:border-dopl-lime/50"
                      >
                        <option value="" disabled>
                          assign to...
                        </option>
                        {portfolios.map((pf) => (
                          <option key={pf.id} value={pf.id}>
                            {pf.name} ({pf.tier})
                          </option>
                        ))}
                      </select>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>

        {/* Assigned by portfolio */}
        <section>
          <h2 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
            assigned
            <span className="text-xs text-dopl-cream/40 font-mono font-normal">
              {assignedPositions.length}
            </span>
          </h2>
          {portfolios.length === 0 ? (
            <div className="glass-card p-8 text-center text-sm text-dopl-cream/40">
              create a portfolio to start assigning
            </div>
          ) : (
            <div className="space-y-6">
              {portfolios.map((pf) => {
                const items = assignedPositions.filter(
                  (p) => p.portfolio_id === pf.id
                );
                return (
                  <div key={pf.id} className="glass-card p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-display text-base font-semibold">
                        {pf.name}
                      </h3>
                      <span className="text-xs text-dopl-cream/40 font-mono">
                        {items.length} positions
                      </span>
                    </div>
                    {items.length === 0 ? (
                      <p className="text-xs text-dopl-cream/30">
                        no positions assigned yet
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {items.map((it) => (
                          <div key={it.id}>
                            <div className="flex items-center gap-3 text-sm">
                              <TrendingUp
                                size={12}
                                className="text-dopl-lime flex-shrink-0"
                              />
                              <span className="font-mono font-semibold">
                                {it.ticker}
                              </span>
                              <span className="text-xs text-dopl-cream/40 flex-1 truncate">
                                {it.name}
                              </span>
                              {it.allocation_pct != null && (
                                <span className="font-mono text-xs text-dopl-cream/60">
                                  {it.allocation_pct.toFixed(1)}%
                                </span>
                              )}
                              <button
                                onClick={() => {
                                  setPendingRemove({
                                    id: it.id,
                                    ticker: it.ticker,
                                  });
                                  setRemoveThesis("");
                                }}
                                className="text-dopl-cream/30 hover:text-red-400 transition-colors"
                                aria-label="remove"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                            {pendingRemove?.id === it.id && (
                              <div className="mt-2 p-3 rounded-lg bg-dopl-deep border border-amber-500/30 space-y-2">
                                <p className="text-xs text-dopl-cream/80">
                                  remove{" "}
                                  <span className="font-mono font-semibold text-amber-300">
                                    {it.ticker}
                                  </span>
                                  ? doplers will be notified.
                                </p>
                                <input
                                  type="text"
                                  value={removeThesis}
                                  onChange={(e) =>
                                    setRemoveThesis(
                                      e.target.value.slice(0, 280)
                                    )
                                  }
                                  placeholder="why are you selling? (optional)"
                                  className="w-full bg-dopl-deep-2 border border-dopl-sage/30 rounded-lg px-3 py-2 text-xs text-dopl-cream placeholder:text-dopl-cream/30 focus:outline-none focus:border-dopl-lime/50"
                                  autoFocus
                                />
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => {
                                      setPendingRemove(null);
                                      setRemoveThesis("");
                                    }}
                                    className="text-xs px-3 py-1.5 text-dopl-cream/50 hover:text-dopl-cream"
                                  >
                                    cancel
                                  </button>
                                  <button
                                    onClick={() =>
                                      remove(it.id, removeThesis)
                                    }
                                    className="text-xs px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-200 hover:bg-red-500/30"
                                  >
                                    remove
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <NotifyDoplersModal
        open={showNotifyModal}
        changesets={pendingChangesets as PortfolioChangeset[]}
        onClose={() => {
          setShowNotifyModal(false);
          setPendingChangesets([]);
        }}
        onNotify={handleNotify}
      />
    </div>
  );
}
