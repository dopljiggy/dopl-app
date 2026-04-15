"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { PositionCard, type PositionLike } from "@/components/ui/position-card";
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
          <div className="flex items-center gap-4 mb-5">
            <Link
              href={s.fm_handle ? `/${s.fm_handle}` : "#"}
              className="flex items-center gap-3 group min-w-0"
            >
              <div className="w-11 h-11 rounded-xl overflow-hidden bg-[color:var(--dopl-sage)] flex items-center justify-center flex-shrink-0">
                {s.fm_avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.fm_avatar_url}
                    alt=""
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
                  <p className="text-xs font-mono text-[color:var(--dopl-cream)]/40">
                    @{s.fm_handle}
                  </p>
                )}
              </div>
            </Link>

            <span className="ml-auto flex items-center gap-1">
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
                onSuccess={() =>
                  setSections((prev) => prev.filter((x) => x.sub_id !== s.sub_id))
                }
              />
            </span>
          </div>

          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <h3 className="font-display text-xl font-semibold">
              {s.portfolio_name}
            </h3>
            <SyncBadge provider={s.fm_broker_provider} />
          </div>

          {s.positions.length === 0 ? (
            <GlassCard className="p-6 text-center">
              <p className="text-sm text-[color:var(--dopl-cream)]/40">
                no positions yet
              </p>
            </GlassCard>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {s.positions.slice(0, 6).map((pos, i) => (
                <PositionCard key={pos.id} position={pos} floatIndex={i} />
              ))}
            </div>
          )}
        </motion.section>
      ))}
    </AnimatePresence>
  );
}
