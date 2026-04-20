"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  Trash2,
  Users,
  Briefcase,
  TrendingUp,
  Settings,
  AlertTriangle,
  Check,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
} from "recharts";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/glass-card";
import { fireToast } from "@/components/ui/toast";
import { SyncBadge } from "@/components/ui/sync-badge";
import { SendManualUpdateModal } from "@/components/ui/send-manual-update-modal";
import type { Portfolio } from "@/types/database";

export type PositionRow = {
  id: string;
  portfolio_id: string;
  ticker: string;
  name: string | null;
  allocation_pct: number | null;
  current_price: number | null;
  gain_loss_pct: number | null;
  shares: number | null;
  market_value: number | null;
};

const PIE_COLORS = [
  "#C5D634", // lime
  "#a8b82c",
  "#8cc9a4",
  "#6fa686",
  "#4f7862",
  "#2D4A3E", // sage
  "#344a41",
];

export default function ExpandablePortfolioCard({
  portfolio,
  positions,
  isExpanded,
  onToggle,
  onDelete,
  brokerProvider,
}: {
  portfolio: Portfolio;
  positions: PositionRow[];
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  brokerProvider?: string | null;
}) {
  const router = useRouter();

  // Local editable copy of allocation percents.
  const brokerPcts = useMemo(() => {
    const total = positions.reduce(
      (a, p) => a + (Number(p.market_value) || 0),
      0
    );
    return new Map(
      positions.map((p) => [
        p.id,
        total > 0 ? ((Number(p.market_value) || 0) / total) * 100 : 0,
      ])
    );
  }, [positions]);

  const [draft, setDraft] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      positions.map((p) => [
        p.id,
        p.allocation_pct != null
          ? Number(p.allocation_pct)
          : brokerPcts.get(p.id) ?? 0,
      ])
    )
  );
  const [saving, setSaving] = useState(false);
  const [showManualUpdate, setShowManualUpdate] = useState(false);

  const sum = Object.values(draft).reduce((a, b) => a + (Number(b) || 0), 0);
  const isBalanced = Math.abs(sum - 100) < 0.1;
  const isDirty = positions.some((p) => {
    const current = p.allocation_pct ?? brokerPcts.get(p.id) ?? 0;
    return Math.abs((draft[p.id] ?? 0) - current) > 0.05;
  });

  const rebalance = () => {
    if (sum <= 0) return;
    const scale = 100 / sum;
    const next: Record<string, number> = {};
    for (const [id, pct] of Object.entries(draft)) {
      next[id] = Number((pct * scale).toFixed(2));
    }
    setDraft(next);
  };

  const save = async () => {
    if (!isBalanced) {
      fireToast({
        title: "allocations must sum to 100%",
        body: `currently ${sum.toFixed(1)}% — hit rebalance or adjust manually`,
      });
      return;
    }
    setSaving(true);
    const res = await fetch("/api/positions/allocations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        portfolio_id: portfolio.id,
        allocations: positions.map((p) => ({
          id: p.id,
          allocation_pct: draft[p.id] ?? 0,
        })),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      fireToast({ title: "save failed", body: j.error ?? "" });
      return;
    }
    fireToast({
      title: "allocations saved",
      body: `${positions.length} positions updated`,
    });
    router.refresh();
  };

  const donutData = positions
    .map((p) => ({
      name: p.ticker,
      value: Number(draft[p.id]) || 0,
    }))
    .filter((d) => d.value > 0);

  // Placeholder performance series — real historical snapshots would plug in here.
  const perfData = useMemo(() => {
    const seed = positions.length || 1;
    const out = [];
    let v = 100;
    for (let i = 0; i < 30; i++) {
      v += Math.sin(i * 0.6 + seed) * 1.4 + (i / 30) * 1.5;
      out.push({ day: i, value: Number(v.toFixed(2)) });
    }
    return out;
  }, [positions.length]);

  const isFree = portfolio.tier === "free" || portfolio.price_cents === 0;

  return (
    <GlassCard className="overflow-hidden p-0" hover={false} tilt={false}>
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full text-left p-5 md:p-6 flex items-center gap-4 hover:bg-[color:var(--dopl-sage)]/10 transition-colors"
      >
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.25, ease: [0.2, 0.7, 0.2, 1] }}
          className="text-[color:var(--dopl-cream)]/50 flex-shrink-0"
        >
          <ChevronDown size={18} />
        </motion.div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded uppercase tracking-wider ${
                isFree
                  ? "bg-[color:var(--dopl-lime)]/15 text-[color:var(--dopl-lime)]"
                  : portfolio.tier === "vip"
                  ? "bg-[color:var(--dopl-lime)]/20 text-[color:var(--dopl-lime)]"
                  : "bg-[color:var(--dopl-sage)]/40 text-[color:var(--dopl-cream)]/80"
              }`}
            >
              {portfolio.tier}
            </span>
            <h3 className="font-display text-lg md:text-xl font-semibold truncate">
              {portfolio.name}
            </h3>
            <SyncBadge provider={brokerProvider} />
          </div>
          {portfolio.description && (
            <p className="text-xs text-[color:var(--dopl-cream)]/40 truncate">
              {portfolio.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-5 flex-shrink-0">
          <Stat icon={<Briefcase size={12} />} value={positions.length} label="positions" />
          <Stat
            icon={<Users size={12} />}
            value={portfolio.subscriber_count}
            label="doplers"
          />
          <div className="text-right">
            <p className="font-mono text-base md:text-lg font-bold text-[color:var(--dopl-lime)] leading-none">
              {isFree ? "free" : `$${(portfolio.price_cents / 100).toFixed(0)}`}
            </p>
            {!isFree && (
              <p className="text-[10px] text-[color:var(--dopl-cream)]/40 font-mono mt-0.5">
                /mo
              </p>
            )}
          </div>
        </div>
      </button>

      {/* Expanded body */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
            className="overflow-hidden border-t border-[color:var(--glass-border)]"
          >
            <div className="p-5 md:p-6 space-y-6">
              {/* Charts row */}
              <div className="grid lg:grid-cols-5 gap-5">
                {/* Donut */}
                <div className="lg:col-span-2 glass-card-light p-5 rounded-2xl">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/50 mb-3">
                    allocation
                  </p>
                  {donutData.length === 0 ? (
                    <div className="h-[180px] flex items-center justify-center text-xs text-[color:var(--dopl-cream)]/30">
                      no positions yet
                    </div>
                  ) : (
                    <div className="h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={donutData}
                            innerRadius={45}
                            outerRadius={80}
                            paddingAngle={2}
                            dataKey="value"
                            stroke="none"
                          >
                            {donutData.map((_, i) => (
                              <Cell
                                key={i}
                                fill={PIE_COLORS[i % PIE_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              background: "rgba(13, 38, 31, 0.9)",
                              border: "1px solid rgba(197, 214, 52, 0.22)",
                              borderRadius: 10,
                              fontSize: 12,
                              color: "#F3EFE8",
                            }}
                            formatter={(v) => `${Number(v).toFixed(1)}%`}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Line chart (placeholder trend) */}
                <div className="lg:col-span-3 glass-card-light p-5 rounded-2xl">
                  <div className="flex items-baseline justify-between mb-3">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/50">
                      30-day performance
                    </p>
                    <p className="text-[10px] font-mono text-[color:var(--dopl-cream)]/30">
                      illustrative
                    </p>
                  </div>
                  <div className="h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={perfData}>
                        <defs>
                          <linearGradient id="perfLine" x1="0" x2="1" y1="0" y2="0">
                            <stop offset="0%" stopColor="#2D4A3E" />
                            <stop offset="100%" stopColor="#C5D634" />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="day" hide />
                        <YAxis hide domain={["dataMin - 2", "dataMax + 2"]} />
                        <Tooltip
                          contentStyle={{
                            background: "rgba(13, 38, 31, 0.9)",
                            border: "1px solid rgba(197, 214, 52, 0.22)",
                            borderRadius: 10,
                            fontSize: 12,
                            color: "#F3EFE8",
                          }}
                          formatter={(v) => Number(v).toFixed(2)}
                          labelFormatter={(d) => `day ${d}`}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="url(#perfLine)"
                          strokeWidth={2.2}
                          dot={false}
                          isAnimationActive
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Positions table with allocation editor */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/50">
                      positions
                    </p>
                    <AllocationSumBadge sum={sum} balanced={isBalanced} />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={rebalance}
                      disabled={isBalanced}
                      className="glass-card-light px-3 py-1.5 text-xs rounded-lg hover:bg-[color:var(--dopl-sage)]/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      rebalance to 100%
                    </button>
                    <button
                      onClick={save}
                      disabled={!isDirty || saving}
                      className="btn-lime text-xs px-3 py-1.5 disabled:opacity-40"
                    >
                      {saving ? "saving..." : "save"}
                    </button>
                  </div>
                </div>

                {positions.length === 0 ? (
                  <div className="glass-card-light p-8 text-center rounded-2xl">
                    <TrendingUp
                      size={24}
                      className="text-[color:var(--dopl-cream)]/20 mx-auto mb-2"
                    />
                    <p className="text-xs text-[color:var(--dopl-cream)]/40 mb-4">
                      no positions assigned yet
                    </p>
                    <a
                      href="/dashboard/positions"
                      className="btn-lime text-xs px-4 py-2 inline-flex items-center gap-2"
                    >
                      assign from broker
                    </a>
                  </div>
                ) : (
                  <div className="glass-card-light rounded-2xl overflow-hidden">
                    <div className="grid grid-cols-12 gap-2 px-4 py-2.5 text-[10px] uppercase tracking-wider text-[color:var(--dopl-cream)]/40 border-b border-[color:var(--glass-border)]">
                      <div className="col-span-3">ticker</div>
                      <div className="col-span-3 text-right">price</div>
                      <div className="col-span-2 text-right">P/L</div>
                      <div className="col-span-2 text-right">broker %</div>
                      <div className="col-span-2 text-right">your %</div>
                    </div>
                    {positions.map((pos) => {
                      const gain = (pos.gain_loss_pct ?? 0) >= 0;
                      const broker = brokerPcts.get(pos.id) ?? 0;
                      return (
                        <div
                          key={pos.id}
                          className="grid grid-cols-12 gap-2 px-4 py-3 items-center border-b border-[color:var(--glass-border)] last:border-0 hover:bg-[color:var(--dopl-sage)]/10 transition-colors"
                        >
                          <div className="col-span-3 min-w-0">
                            <p className="font-mono font-semibold text-sm truncate">
                              {pos.ticker}
                            </p>
                            {pos.name && (
                              <p className="text-[10px] text-[color:var(--dopl-cream)]/40 truncate">
                                {pos.name}
                              </p>
                            )}
                          </div>
                          <div className="col-span-3 text-right font-mono text-sm tabular-nums">
                            {pos.current_price != null
                              ? `$${Number(pos.current_price).toFixed(2)}`
                              : "—"}
                            {pos.shares != null && (
                              <p className="text-[10px] text-[color:var(--dopl-cream)]/40">
                                {pos.shares} sh
                              </p>
                            )}
                          </div>
                          <div
                            className={`col-span-2 text-right font-mono text-sm tabular-nums ${
                              gain
                                ? "text-[color:var(--dopl-lime)]"
                                : "text-red-400"
                            }`}
                          >
                            {pos.gain_loss_pct != null
                              ? `${gain ? "+" : ""}${pos.gain_loss_pct.toFixed(1)}%`
                              : "—"}
                          </div>
                          <div className="col-span-2 text-right font-mono text-xs text-[color:var(--dopl-cream)]/40 tabular-nums">
                            {broker.toFixed(1)}%
                          </div>
                          <div className="col-span-2 text-right">
                            <div className="relative inline-flex items-center">
                              <input
                                type="number"
                                value={draft[pos.id] ?? 0}
                                onChange={(e) =>
                                  setDraft({
                                    ...draft,
                                    [pos.id]: Math.max(
                                      0,
                                      Math.min(100, Number(e.target.value) || 0)
                                    ),
                                  })
                                }
                                step="0.1"
                                className="w-20 bg-[color:var(--dopl-deep)] border border-[color:var(--dopl-sage)]/40 rounded-md px-2 py-1 text-xs font-mono text-right tabular-nums"
                              />
                              <span className="text-[10px] text-[color:var(--dopl-cream)]/40 ml-1">
                                %
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer actions */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <a
                  href="/dashboard/positions"
                  className="glass-card-light px-4 py-2 text-xs rounded-xl hover:bg-[color:var(--dopl-sage)]/40 transition-colors inline-flex items-center gap-2"
                >
                  <Settings size={13} />
                  edit positions
                </a>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowManualUpdate(true);
                  }}
                  className="glass-card-light px-4 py-2 text-xs rounded-xl hover:bg-[color:var(--dopl-sage)]/40 transition-colors inline-flex items-center gap-2"
                >
                  send manual update →
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="glass-card-light px-4 py-2 text-xs rounded-xl hover:bg-red-500/10 hover:text-red-300 transition-colors inline-flex items-center gap-2 ml-auto"
                >
                  <Trash2 size={13} />
                  delete portfolio
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <SendManualUpdateModal
        open={showManualUpdate}
        portfolioId={portfolio.id}
        portfolioName={portfolio.name}
        onClose={() => setShowManualUpdate(false)}
      />
    </GlassCard>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="text-right hidden sm:block">
      <p className="flex items-center gap-1 justify-end text-xs text-[color:var(--dopl-cream)]/40">
        {icon}
        <span className="font-mono text-sm text-[color:var(--dopl-cream)]/80">
          {value}
        </span>
      </p>
      <p className="text-[10px] text-[color:var(--dopl-cream)]/30 uppercase tracking-wider">
        {label}
      </p>
    </div>
  );
}

function AllocationSumBadge({
  sum,
  balanced,
}: {
  sum: number;
  balanced: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono ${
        balanced
          ? "bg-[color:var(--dopl-lime)]/12 text-[color:var(--dopl-lime)]"
          : "bg-red-500/10 text-red-300"
      }`}
    >
      {balanced ? <Check size={10} /> : <AlertTriangle size={10} />}
      Σ {sum.toFixed(1)}%
    </span>
  );
}
