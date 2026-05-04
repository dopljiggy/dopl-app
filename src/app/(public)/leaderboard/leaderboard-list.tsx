"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Briefcase, Users } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import CountUp from "@/components/ui/count-up";
import type { FundManager } from "@/types/database";

/**
 * Discover grid (Sprint 14): replaces the ranked leaderboard. No
 * positions/podium colors, no rank numbers — just FM cards in a
 * 2-up (md+) grid sorted by recently joined.
 */
export default function LeaderboardList({
  managers,
}: {
  managers: FundManager[];
}) {
  if (!managers.length) {
    return (
      <GlassCard className="p-12 text-center">
        <p className="text-[color:var(--dopl-cream)]/50 mb-4">
          no fund managers yet
        </p>
        <Link
          href="/signup"
          className="btn-lime text-sm px-6 py-2.5 inline-block"
        >
          be the first
        </Link>
      </GlassCard>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {managers.map((fm, index) => (
        <motion.div
          key={fm.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.4,
            delay: Math.min(index * 0.03, 0.6),
            ease: [0.2, 0.7, 0.2, 1],
          }}
        >
          <Link
            href={`/${fm.handle}`}
            className="block focus:outline-none"
            aria-label={`View ${fm.display_name}'s profile`}
          >
            <GlassCard className="p-5 h-full flex flex-col gap-3 group hover:border-[color:var(--dopl-lime)]/35 transition-colors">
              <div className="flex items-center gap-3">
                <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-[color:var(--dopl-sage)] flex-shrink-0">
                  {fm.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={fm.avatar_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-display text-lg text-[color:var(--dopl-lime)]">
                      {fm.display_name[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate group-hover:text-[color:var(--dopl-lime)] transition-colors">
                    {fm.display_name}
                  </p>
                  <p className="text-xs text-[color:var(--dopl-cream)]/45 font-mono truncate">
                    @{fm.handle}
                  </p>
                </div>
              </div>

              {fm.bio && (
                <p className="text-xs text-[color:var(--dopl-cream)]/65 leading-relaxed line-clamp-2">
                  {fm.bio}
                </p>
              )}

              <div className="mt-auto pt-2 flex items-center gap-4 text-xs text-[color:var(--dopl-cream)]/60">
                <span className="inline-flex items-center gap-1.5">
                  <Users size={12} className="text-[color:var(--dopl-cream)]/40" />
                  <CountUp value={fm.subscriber_count} duration={0.8} />
                  <span className="text-[color:var(--dopl-cream)]/40">
                    {fm.subscriber_count === 1 ? "dopler" : "doplers"}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Briefcase
                    size={12}
                    className="text-[color:var(--dopl-cream)]/40"
                  />
                  <span className="text-[color:var(--dopl-cream)]/55">
                    portfolios
                  </span>
                </span>
              </div>
            </GlassCard>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
