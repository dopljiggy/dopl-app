"use client";

import { Lock, TrendingUp, TrendingDown } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";

export type PositionLike = {
  id: string;
  ticker: string;
  name?: string | null;
  allocation_pct?: number | null;
  current_price?: number | null;
  gain_loss_pct?: number | null;
  shares?: number | null;
  market_value?: number | null;
};

export function PositionCard({
  position: p,
  locked = false,
  floatIndex = 0,
  pulsing = false,
}: {
  position: PositionLike;
  locked?: boolean;
  floatIndex?: number;
  pulsing?: boolean;
}) {
  const gain = (p.gain_loss_pct ?? 0) >= 0;
  const glow = locked ? null : gain ? "gain" : "loss";

  return (
    <div>
      <GlassCard
        glow={glow}
        className={`p-5 ${pulsing ? "position-pulse" : ""}`}
      >
        {locked && (
          <div className="absolute inset-0 locked-sheen rounded-[18px] flex items-center justify-center pointer-events-none z-10">
            <div className="w-10 h-10 rounded-full glass-card-light flex items-center justify-center">
              <Lock size={16} className="text-[color:var(--dopl-lime)]" />
            </div>
          </div>
        )}
        <div className={locked ? "locked-blur" : ""}>
          <div className="flex items-start justify-between mb-3">
            <div className="min-w-0">
              <p className="font-mono text-xl font-bold tracking-tight">{p.ticker}</p>
              {p.name && (
                <p className="text-xs text-[color:var(--dopl-cream)]/50 truncate mt-0.5">
                  {p.name}
                </p>
              )}
            </div>
            <div
              className={`flex items-center gap-1 text-sm font-mono font-semibold ${
                gain ? "text-[color:var(--dopl-lime)]" : "text-red-400"
              }`}
            >
              {gain ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              <span>
                {p.gain_loss_pct != null
                  ? `${gain ? "+" : ""}${p.gain_loss_pct.toFixed(1)}%`
                  : "—"}
              </span>
            </div>
          </div>

          <div className="flex items-end justify-between mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[color:var(--dopl-cream)]/40 mb-1">
                allocation
              </p>
              <p className="font-mono text-lg tabular-nums">
                {p.allocation_pct != null
                  ? `${p.allocation_pct.toFixed(1)}%`
                  : "—"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-[color:var(--dopl-cream)]/40 mb-1">
                price
              </p>
              <p className="font-mono text-lg tabular-nums">
                {p.current_price != null
                  ? `$${Number(p.current_price).toFixed(2)}`
                  : "—"}
              </p>
            </div>
          </div>

          {/* Allocation bar */}
          <div className="relative h-1 rounded-full bg-[color:var(--dopl-sage)]/30 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out"
              style={{
                width: `${Math.min(100, p.allocation_pct ?? 0)}%`,
                background: gain
                  ? "linear-gradient(90deg, var(--dopl-sage), var(--dopl-lime))"
                  : "linear-gradient(90deg, rgba(239,68,68,0.4), rgba(239,68,68,0.8))",
              }}
            />
          </div>

          {/* Hover extra */}
          <div className="mt-3 flex items-center justify-between text-xs text-[color:var(--dopl-cream)]/40 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="font-mono">
              {p.shares != null ? p.shares : ""}
            </span>
            <span className="font-mono">
              {p.market_value != null
                ? `$${p.market_value.toFixed(0)}`
                : ""}
            </span>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
