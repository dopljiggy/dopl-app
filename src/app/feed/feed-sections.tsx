"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

import { ChevronDown, ChevronRight } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { type PositionLike } from "@/components/ui/position-card";
import { StockLogo } from "@/components/ui/stock-logo";
import UndoplButton from "@/components/ui/undopl-button";
import { SyncBadge } from "@/components/ui/sync-badge";

type Section = {
  sub_id: string;
  portfolio_id: string;
  portfolio_name: string;
  portfolio_description: string | null;
  portfolio_tier: string;
  fm_handle: string | null;
  fm_display_name: string;
  fm_avatar_url: string | null;
  fm_broker_provider?: string | null;
  positions: PositionLike[];
};

export default function FeedSections({ initial }: { initial: Section[] }) {
  const [sections, setSections] = useState(initial);

  return (
    <AnimatePresence mode="popLayout">
      {sections.map((s) => (
        <motion.section
          key={s.sub_id}
          layout
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.98 }}
          transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
        >
          <PortfolioCard
            section={s}
            onUndopl={() =>
              setSections((prev) => prev.filter((x) => x.sub_id !== s.sub_id))
            }
          />
        </motion.section>
      ))}
    </AnimatePresence>
  );
}

function PortfolioCard({
  section: s,
  onUndopl,
}: {
  section: Section;
  onUndopl: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const toggle = () => setExpanded((v) => !v);

  return (
    <GlassCard className="overflow-hidden p-0">
      {/* Header — click toggles, but inner buttons/links stop propagation.
          role=button (not <button>) because the header contains a <Link>
          and an UndoplButton — nesting interactive elements inside a real
          <button> is invalid HTML5 and trips React's validateDOMNesting. */}
      <div
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(e) => {
          // Only fire on the header itself — keydown bubbles from the
          // inner <Link> and UndoplButton, and we don't want pressing
          // Enter on the FM-profile link to toggle the portfolio
          // instead of navigating.
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
        aria-expanded={expanded}
        aria-controls={`positions-${s.portfolio_id}`}
        className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-[color:var(--dopl-sage)]/10 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--dopl-lime)]/40"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-3 min-w-0"
        >
          <Link
            href={s.fm_handle ? `/${s.fm_handle}` : "#"}
            className="flex items-center gap-3 group min-w-0"
          >
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-[color:var(--dopl-sage)] flex items-center justify-center flex-shrink-0">
              {s.fm_avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={s.fm_avatar_url}
                  alt=""
                  decoding="async"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="font-display text-base text-[color:var(--dopl-lime)]">
                  {s.fm_display_name[0]?.toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate group-hover:text-[color:var(--dopl-lime)] transition-colors">
                {s.fm_display_name}
              </p>
              {s.fm_handle && (
                <p className="text-[11px] font-mono text-[color:var(--dopl-cream)]/40">
                  @{s.fm_handle}
                </p>
              )}
            </div>
          </Link>
        </div>

        <div className="flex-1 min-w-0 px-3 hidden sm:block">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-base font-semibold truncate">
              {s.portfolio_name}
            </h3>
            <SyncBadge provider={s.fm_broker_provider} />
          </div>
        </div>

        <div
          onClick={(e) => e.stopPropagation()}
          className="ml-auto flex items-center gap-2"
        >
          <span
            className={`text-[10px] font-mono font-semibold px-2 py-1 rounded uppercase tracking-wider ${
              s.portfolio_tier === "free"
                ? "bg-[color:var(--dopl-lime)]/15 text-[color:var(--dopl-lime)]"
                : s.portfolio_tier === "vip"
                ? "bg-[color:var(--dopl-lime)]/20 text-[color:var(--dopl-lime)]"
                : "bg-[color:var(--dopl-sage)]/40 text-[color:var(--dopl-cream)]/80"
            }`}
          >
            {s.portfolio_tier}
          </span>
          <UndoplButton
            subscriptionId={s.sub_id}
            portfolioName={s.portfolio_name}
            fundManagerName={s.fm_display_name}
            onSuccess={onUndopl}
          />
        </div>

        <span
          className="text-[color:var(--dopl-cream)]/40 ml-1"
          aria-hidden
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
      </div>

      {/* Mobile-only portfolio name row — sm+ shows it inline in the header */}
      <div className="sm:hidden px-5 pb-3 -mt-1">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-sm font-semibold truncate">
            {s.portfolio_name}
          </h3>
          <SyncBadge provider={s.fm_broker_provider} />
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id={`positions-${s.portfolio_id}`}
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.2, 0.7, 0.2, 1] }}
            style={{ overflow: "hidden" }}
          >
            {s.positions.length === 0 ? (
              <div className="px-5 pb-5 text-sm text-[color:var(--dopl-cream)]/40">
                no positions yet
              </div>
            ) : (
              <div className="border-t border-[color:var(--glass-border)]">
                <PositionTable positions={s.positions} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {expanded && s.positions.length > 0 && (
        <div className="px-5 py-3 border-t border-[color:var(--glass-border)] flex justify-end">
          <a
            href={`/feed/${s.portfolio_id}`}
            className="text-xs text-[color:var(--dopl-lime)] hover:underline inline-flex items-center gap-1"
          >
            view full portfolio →
          </a>
        </div>
      )}
    </GlassCard>
  );
}

function PositionTable({ positions }: { positions: PositionLike[] }) {
  const totalMv = positions.reduce((a, p) => a + (Number(p.market_value) || 0), 0);

  return (
    <div className="space-y-0.5">
      {positions.map((p) => {
        const pl = p.gain_loss_pct;
        const plPositive = pl != null && pl >= 0;
        const price = p.current_price != null ? Number(p.current_price) : null;
        const alloc =
          p.allocation_pct ??
          (p.market_value != null && totalMv > 0
            ? (Number(p.market_value) / totalMv) * 100
            : null);
        return (
          <div
            key={p.id}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-[color:var(--dopl-sage)]/10 transition-colors"
          >
            <StockLogo ticker={p.ticker} size={32} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-mono font-bold text-sm">{p.ticker}</span>
                  {alloc != null && (
                    <span className="text-[10px] font-mono tabular-nums text-[color:var(--dopl-cream)]/30 truncate">
                      · {alloc.toFixed(1)}%
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-mono text-sm tabular-nums">
                    {price != null
                      ? `$${price >= 10000 ? `${(price / 1000).toFixed(1)}k` : price.toFixed(2)}`
                      : "—"}
                  </span>
                  <span
                    className={`font-mono text-xs tabular-nums px-1.5 py-0.5 rounded-md ${
                      pl == null
                        ? "text-[color:var(--dopl-cream)]/40"
                        : plPositive
                          ? "text-[color:var(--dopl-lime)] bg-[color:var(--dopl-lime)]/10"
                          : "text-red-400 bg-red-400/10"
                    }`}
                  >
                    {pl != null
                      ? `${plPositive ? "+" : ""}${pl.toFixed(1)}%`
                      : "—"}
                  </span>
                </div>
              </div>
              {p.name && (
                <p className="text-[10px] text-[color:var(--dopl-cream)]/40 truncate max-w-[150px]">
                  {p.name}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
