"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/glass-card";
import SlideToDopl from "@/components/ui/slide-to-dopl";
import { fireToast } from "@/components/ui/toast";
import { Lock, Users, TrendingUp, TrendingDown } from "lucide-react";
import type { Portfolio } from "@/types/database";

type TierPortfolio = Portfolio & {
  position_count: number;
  preview_tickers: string[];
  can_view: boolean;
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
}: {
  tiers: TierPortfolio[];
  handle: string;
  displayName: string;
  isAuthed: boolean;
}) {
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _ = displayName;

  const [loadingPortfolioId, setLoadingPortfolioId] = useState<string | null>(
    null
  );

  const handleSubscribe = async (portfolioId: string) => {
    if (!isAuthed) {
      const next = encodeURIComponent(
        `/${handle}?intent=dopl&portfolio=${portfolioId}`
      );
      router.push(`/signup?next=${next}&role=dopler`);
      return;
    }
    setLoadingPortfolioId(portfolioId);
    try {
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
    } finally {
      setLoadingPortfolioId(null);
    }
  };

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
      {tiers.map((p, i) => {
        const isFree = p.tier === "free" || p.price_cents === 0;
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
          >
            <GlassCard className="p-6 flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                <span
                  className={`text-[10px] font-mono font-semibold px-2 py-1 rounded tracking-wider uppercase ${
                    isFree
                      ? "bg-[color:var(--dopl-lime)]/15 text-[color:var(--dopl-lime)]"
                      : p.tier === "vip"
                      ? "bg-[color:var(--dopl-lime)]/20 text-[color:var(--dopl-lime)]"
                      : "bg-[color:var(--dopl-sage)]/40 text-[color:var(--dopl-cream)]/80"
                  }`}
                >
                  {p.tier}
                </span>
                <div className="flex items-center gap-1 text-xs text-[color:var(--dopl-cream)]/40">
                  <Users size={12} />
                  <span className="font-mono">{p.subscriber_count}</span>
                </div>
              </div>

              <h3 className="font-display text-xl font-semibold mb-1">
                {p.name}
              </h3>
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
                  <div className="glass-card-light p-3">
                    <p className="text-xs text-[color:var(--dopl-cream)]/30 italic">
                      empty
                    </p>
                  </div>
                ) : p.can_view ? (
                  // Full visible preview for free/subscribed/owner
                  <div className="glass-card-light p-3">
                    <div className="space-y-1.5">
                      {p.positions.slice(0, 4).map((pos) => {
                        const gain = (pos.gain_loss_pct ?? 0) >= 0;
                        return (
                          <div
                            key={pos.id}
                            className="flex items-center justify-between text-xs"
                          >
                            <span className="flex items-center gap-2">
                              {gain ? (
                                <TrendingUp
                                  size={10}
                                  className="text-[color:var(--dopl-lime)]"
                                />
                              ) : (
                                <TrendingDown
                                  size={10}
                                  className="text-red-400"
                                />
                              )}
                              <span className="font-mono font-semibold">
                                {pos.ticker}
                              </span>
                            </span>
                            <span
                              className={`font-mono ${
                                gain
                                  ? "text-[color:var(--dopl-lime)]/80"
                                  : "text-red-400/80"
                              }`}
                            >
                              {pos.allocation_pct != null
                                ? `${pos.allocation_pct.toFixed(1)}%`
                                : ""}
                            </span>
                          </div>
                        );
                      })}
                      {p.positions.length > 4 && (
                        <p className="text-[10px] text-[color:var(--dopl-cream)]/30 pt-1">
                          + {p.positions.length - 4} more
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  // Locked preview for paid + not subscribed
                  <div className="relative glass-card-light p-3 overflow-hidden">
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

                {isFree || p.can_view ? (
                  <Link
                    href={`/feed/${p.id}`}
                    className="block text-center glass-card-light py-2.5 text-sm font-medium hover:bg-[color:var(--dopl-sage)]/40 transition-colors rounded-xl"
                  >
                    {p.can_view && !isFree ? "view portfolio" : "view positions"}
                  </Link>
                ) : (
                  <SlideToDopl
                    label={`slide to dopl · $${(p.price_cents / 100).toFixed(0)}/mo`}
                    completedLabel={
                      loadingPortfolioId === p.id
                        ? "redirecting..."
                        : "dopl'd"
                    }
                    onComplete={() => handleSubscribe(p.id)}
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
