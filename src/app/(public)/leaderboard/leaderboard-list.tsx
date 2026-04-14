"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/glass-card";
import CountUp from "@/components/ui/count-up";
import type { FundManager } from "@/types/database";

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
    <div className="space-y-3">
      {managers.map((fm, index) => {
        const glow =
          index === 0
            ? "gold"
            : index === 1
            ? "silver"
            : index === 2
            ? "bronze"
            : null;
        return (
          <motion.div
            key={fm.id}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.5,
              delay: index * 0.04,
              ease: [0.2, 0.7, 0.2, 1],
            }}
          >
            <Link
              href={`/${fm.handle}`}
              className="block focus:outline-none"
              aria-label={`View ${fm.display_name}'s profile`}
            >
              <GlassCard
                glow={glow}
                className="p-5 flex items-center gap-5 group"
              >
                <span
                  className={`font-mono text-2xl font-bold w-10 flex-shrink-0 tabular-nums ${
                    index < 3
                      ? index === 0
                        ? "text-[#F5D76E]"
                        : index === 1
                        ? "text-[#C8D2DC]"
                        : "text-[#CD7F50]"
                      : "text-[color:var(--dopl-cream)]/30"
                  }`}
                >
                  <CountUp
                    value={index + 1}
                    duration={0.8 + index * 0.05}
                  />
                </span>
                <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-[color:var(--dopl-sage)] flex-shrink-0">
                  {index < 3 && (
                    <div
                      className="absolute -inset-1 blur-md opacity-60 rounded-2xl"
                      style={{
                        background:
                          index === 0
                            ? "rgba(245, 215, 110, 0.6)"
                            : index === 1
                            ? "rgba(200, 210, 220, 0.5)"
                            : "rgba(205, 127, 80, 0.5)",
                      }}
                    />
                  )}
                  <div className="relative w-full h-full flex items-center justify-center">
                    {fm.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={fm.avatar_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="font-display text-lg text-[color:var(--dopl-lime)]">
                        {fm.display_name[0]?.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex-grow min-w-0">
                  <p className="font-semibold truncate">{fm.display_name}</p>
                  <p className="text-xs text-[color:var(--dopl-cream)]/40 font-mono">
                    @{fm.handle}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-mono text-xl font-bold text-[color:var(--dopl-lime)]">
                    <CountUp value={fm.subscriber_count} duration={1} />
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-[color:var(--dopl-cream)]/30">
                    doplers
                  </p>
                </div>
              </GlassCard>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
