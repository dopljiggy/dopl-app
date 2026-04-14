"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { Lock, Users, TrendingUp } from "lucide-react";
import type { Portfolio } from "@/types/database";

type TierPortfolio = Portfolio & {
  position_count: number;
  preview_tickers: string[];
};

export default function ProfileTiers({
  portfolios,
}: {
  portfolios: TierPortfolio[];
  handle?: string;
}) {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
      {portfolios.map((p, i) => {
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
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <span
                  className={`text-[10px] font-mono font-semibold px-2 py-1 rounded tracking-wider uppercase ${
                    p.tier === "free"
                      ? "bg-[color:var(--dopl-sage)]/50 text-[color:var(--dopl-cream)]/70"
                      : p.tier === "vip"
                      ? "bg-[color:var(--dopl-lime)]/20 text-[color:var(--dopl-lime)]"
                      : "bg-[color:var(--dopl-sage)]/30 text-[color:var(--dopl-cream)]/80"
                  }`}
                >
                  {p.tier}
                </span>
                <div className="flex items-center gap-1 text-xs text-[color:var(--dopl-cream)]/40">
                  <Users size={12} />
                  <span className="font-mono">{p.subscriber_count}</span>
                </div>
              </div>

              <h3 className="font-display text-xl font-semibold mb-1">{p.name}</h3>
              {p.description && (
                <p className="text-xs text-[color:var(--dopl-cream)]/50 mb-4 line-clamp-2">
                  {p.description}
                </p>
              )}

              {/* Blurred preview of positions */}
              <div className="flex-1 mb-5">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/40 mb-2">
                  {p.position_count} position{p.position_count === 1 ? "" : "s"}
                </p>
                <div className="relative rounded-lg glass-card-light p-3 overflow-hidden">
                  {p.preview_tickers.length > 0 ? (
                    <div className={isFree ? "" : "locked-blur"}>
                      <div className="space-y-1.5">
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
                                {isFree ? t : "••••"}
                              </span>
                            </span>
                            <span className="font-mono text-[color:var(--dopl-cream)]/40">
                              {isFree ? "" : "•••%"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-[color:var(--dopl-cream)]/30 italic">
                      empty
                    </p>
                  )}
                  {!isFree && p.preview_tickers.length > 0 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full glass-card-light flex items-center justify-center">
                        <Lock size={12} className="text-[color:var(--dopl-lime)]" />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Price + CTA */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-2xl font-bold text-[color:var(--dopl-lime)] leading-none">
                    {p.price_cents === 0
                      ? "free"
                      : `$${(p.price_cents / 100).toFixed(0)}`}
                  </p>
                  {p.price_cents > 0 && (
                    <p className="text-[10px] text-[color:var(--dopl-cream)]/40 font-mono mt-0.5">
                      /month
                    </p>
                  )}
                </div>
                {isFree ? (
                  <Link
                    href={`/feed/${p.id}`}
                    className="glass-card-light px-5 py-2.5 text-sm font-medium hover:bg-[color:var(--dopl-sage)]/40 transition-colors rounded-xl"
                  >
                    view →
                  </Link>
                ) : (
                  <Link
                    href={`/feed/${p.id}`}
                    className="btn-lime text-sm px-5 py-2.5"
                  >
                    subscribe
                  </Link>
                )}
              </div>
            </GlassCard>
          </motion.div>
        );
      })}
    </div>
  );
}
