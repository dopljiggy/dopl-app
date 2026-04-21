"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/glass-card";
import SlideToDopl from "@/components/ui/slide-to-dopl";
import UndoplButton from "@/components/ui/undopl-button";
import { SyncBadge } from "@/components/ui/sync-badge";
import { fireToast } from "@/components/ui/toast";
import { Lock, Users, TrendingUp, TrendingDown, Sparkles } from "lucide-react";
import type { Portfolio } from "@/types/database";

type TierPortfolio = Portfolio & {
  position_count: number;
  preview_tickers: string[];
  can_view: boolean;
  is_subscribed: boolean;
  is_owner: boolean;
  subscription_id: string | null;
  positions: {
    id: string;
    ticker: string;
    name: string | null;
    allocation_pct: number | null;
    current_price: number | null;
    gain_loss_pct: number | null;
  }[];
};

export default function ProfileTiers({
  tiers,
  handle,
  displayName,
  isAuthed,
  brokerProvider,
  fmStripeOnboarded = false,
}: {
  tiers: TierPortfolio[];
  handle: string;
  displayName: string;
  isAuthed: boolean;
  brokerProvider?: string | null;
  fmStripeOnboarded?: boolean;
}) {
  const router = useRouter();

  // Local optimistic state so the card flips to "dopling" immediately after
  // a successful free dopl (before router.refresh completes).
  const [locallyDopled, setLocallyDopled] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<string | null>(null);

  const gotoSignup = (portfolioId: string) => {
    const next = encodeURIComponent(
      `/${handle}?intent=dopl&portfolio=${portfolioId}`
    );
    router.push(`/signup?next=${next}&role=dopler`);
  };

  const doplFree = async (portfolioId: string, portfolioName: string) => {
    if (!isAuthed) {
      gotoSignup(portfolioId);
      return;
    }
    setPending(portfolioId);
    try {
      const res = await fetch("/api/subscriptions/free", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ portfolio_id: portfolioId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        fireToast({ title: "couldn't dopl", body: json.error ?? "" });
        return;
      }
      setLocallyDopled((prev) => new Set([...prev, portfolioId]));
      fireToast({
        title: `you're now dopling ${displayName}'s ${portfolioName}`,
      });
      router.push(`/feed/${portfolioId}?subscribed=true`);
    } finally {
      setPending(null);
    }
  };

  const doplPaid = async (portfolioId: string) => {
    if (!isAuthed) {
      gotoSignup(portfolioId);
      return;
    }
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portfolioId }),
    });
    const { url, error } = await res.json();
    if (url) {
      window.location.href = url;
      return;
    }
    fireToast({ title: "couldn't start checkout", body: error ?? "" });
  };

  return (
    <div
      className="flex md:grid md:grid-cols-2 lg:grid-cols-3 gap-5 overflow-x-auto md:overflow-visible -mx-6 md:mx-0 px-6 md:px-0 snap-x snap-mandatory md:snap-none pb-2 md:pb-0"
      style={{ scrollbarWidth: "none" }}
    >
      {tiers.map((p, i) => {
        const isFree = p.tier === "free" || p.price_cents === 0;
        const isSubscribed = p.is_subscribed || locallyDopled.has(p.id);
        const isOwner = p.is_owner;
        return (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.55,
              delay: i * 0.08,
              ease: [0.2, 0.7, 0.2, 1],
            }}
            className="snap-center flex-shrink-0 w-[85%] md:w-auto"
          >
            <GlassCard
              glow={isFree ? "gain" : null}
              className="p-6 flex flex-col h-full"
            >
              {/* Header: tier + doplers count */}
              <div className="flex items-center justify-between mb-4">
                <span
                  className={`text-[10px] font-mono font-semibold px-2 py-1 rounded tracking-wider uppercase inline-flex items-center gap-1 ${
                    isFree
                      ? "bg-[color:var(--dopl-lime)]/20 text-[color:var(--dopl-lime)]"
                      : p.tier === "vip"
                      ? "bg-[color:var(--dopl-lime)]/20 text-[color:var(--dopl-lime)]"
                      : "bg-[color:var(--dopl-sage)]/40 text-[color:var(--dopl-cream)]/80"
                  }`}
                >
                  {isFree && <Sparkles size={10} />}
                  {isFree ? "free" : p.tier}
                </span>
                <div className="flex items-center gap-1 text-xs text-[color:var(--dopl-cream)]/40">
                  <Users size={12} />
                  <span className="font-mono">{p.subscriber_count}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="font-display text-xl font-semibold">
                  {p.name}
                </h3>
                <SyncBadge provider={brokerProvider} />
              </div>
              {p.description && (
                <p className="text-xs text-[color:var(--dopl-cream)]/50 mb-4 line-clamp-2">
                  {p.description}
                </p>
              )}

              {/* Positions preview */}
              <div className="flex-1 mb-5">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/40 mb-2">
                  {p.position_count} position{p.position_count === 1 ? "" : "s"}
                </p>

                {p.position_count === 0 ? (
                  <div className="glass-card-light p-3 rounded-lg">
                    <p className="text-xs text-[color:var(--dopl-cream)]/30 italic">
                      empty
                    </p>
                  </div>
                ) : p.can_view ? (
                  // Visible positions — mini glass cards per position
                  <div className="grid grid-cols-2 gap-1.5">
                    {p.positions.slice(0, 6).map((pos) => {
                      const gain = (pos.gain_loss_pct ?? 0) >= 0;
                      return (
                        <div
                          key={pos.id}
                          className="glass-card-light rounded-lg px-2.5 py-2 flex items-center justify-between text-[11px]"
                        >
                          <span className="flex items-center gap-1 min-w-0">
                            {gain ? (
                              <TrendingUp
                                size={9}
                                className="text-[color:var(--dopl-lime)] flex-shrink-0"
                              />
                            ) : (
                              <TrendingDown
                                size={9}
                                className="text-red-400 flex-shrink-0"
                              />
                            )}
                            <span className="font-mono font-semibold truncate">
                              {pos.ticker}
                            </span>
                          </span>
                          <span
                            className={`font-mono tabular-nums ${
                              gain
                                ? "text-[color:var(--dopl-lime)]/80"
                                : "text-red-400/80"
                            }`}
                          >
                            {pos.allocation_pct != null
                              ? `${pos.allocation_pct.toFixed(0)}%`
                              : "—"}
                          </span>
                        </div>
                      );
                    })}
                    {p.positions.length > 6 && (
                      <div className="col-span-2 text-[10px] text-[color:var(--dopl-cream)]/30 px-2 pt-1">
                        + {p.positions.length - 6} more
                      </div>
                    )}
                  </div>
                ) : (
                  // Locked preview for paid + not subscribed
                  <div className="relative glass-card-light p-3 overflow-hidden rounded-lg">
                    <div className="locked-blur space-y-1.5">
                      {p.preview_tickers.slice(0, 3).map((t, idx) => (
                        <div
                          key={t + idx}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="flex items-center gap-2">
                            <TrendingUp
                              size={10}
                              className="text-[color:var(--dopl-lime)]"
                            />
                            <span className="font-mono font-semibold">
                              ••••
                            </span>
                          </span>
                          <span className="font-mono text-[color:var(--dopl-cream)]/40">
                            •••%
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full glass-card-light flex items-center justify-center">
                        <Lock
                          size={12}
                          className="text-[color:var(--dopl-lime)]"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer: price + CTA */}
              <div>
                <div className="flex items-end justify-between mb-4">
                  <div>
                    <p className="font-mono text-2xl font-bold text-[color:var(--dopl-lime)] leading-none">
                      {isFree ? "free" : `$${(p.price_cents / 100).toFixed(0)}`}
                    </p>
                    {!isFree && (
                      <p className="text-[10px] text-[color:var(--dopl-cream)]/40 font-mono mt-0.5">
                        /month
                      </p>
                    )}
                  </div>
                </div>

                {isOwner ? (
                  <div className="glass-card-light px-4 py-2.5 text-center text-xs text-[color:var(--dopl-cream)]/50 rounded-xl">
                    your portfolio
                  </div>
                ) : isSubscribed && p.subscription_id ? (
                  <UndoplButton
                    subscriptionId={p.subscription_id}
                    portfolioName={p.name}
                    fundManagerName={displayName}
                    variant="chip"
                  />
                ) : isFree ? (
                  <button
                    onClick={() => doplFree(p.id, p.name)}
                    disabled={pending === p.id}
                    className="btn-lime w-full text-sm py-2.5 disabled:opacity-60"
                  >
                    {pending === p.id ? "dopling..." : "dopl this portfolio"}
                  </button>
                ) : !fmStripeOnboarded ? (
                  <div className="glass-card-light p-6 text-center rounded-xl">
                    <p className="text-sm text-[color:var(--dopl-cream)]/60">
                      this fund manager is finalizing setup.
                    </p>
                    <p className="text-xs text-[color:var(--dopl-cream)]/40 mt-1">
                      check back soon.
                    </p>
                  </div>
                ) : (
                  <SlideToDopl
                    label={`slide to dopl · $${(p.price_cents / 100).toFixed(0)}/mo`}
                    completedLabel="redirecting..."
                    onComplete={() => doplPaid(p.id)}
                  />
                )}
              </div>
            </GlassCard>
          </motion.div>
        );
      })}
    </div>
  );
}
