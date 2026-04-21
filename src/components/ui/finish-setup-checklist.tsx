"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Check,
  Circle,
  Link2,
  Briefcase,
  TrendingUp,
  DollarSign,
  Share2,
  type LucideIcon,
} from "lucide-react";

export type FinishSetupItemKey =
  | "broker"
  | "portfolio"
  | "positions"
  | "stripe"
  | "share";

export type FinishSetupItem = {
  key: FinishSetupItemKey;
  label: string;
  sublabel?: string;
  done: boolean;
  href?: string;
  cta?: string;
};

type Props = {
  items: FinishSetupItem[];
  title?: string;
  /**
   * When set, this key in localStorage forces the share item's `done` to
   * true (e.g. user copied or downloaded — UI-only side effect, no DB
   * write). Read client-side on mount.
   */
  shareLocalStorageKey?: string;
};

const ICONS: Record<FinishSetupItemKey, LucideIcon> = {
  broker: Link2,
  portfolio: Briefcase,
  positions: TrendingUp,
  stripe: DollarSign,
  share: Share2,
};

/**
 * Post-onboarding nudge card for the FM dashboard. Auto-hides once
 * every item is done.
 */
export function FinishSetupChecklist({
  items,
  title = "finish setting up",
  shareLocalStorageKey = "dopl_shared",
}: Props) {
  const [localShareDone, setLocalShareDone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = window.localStorage.getItem(shareLocalStorageKey);
    if (v === "1") setLocalShareDone(true);
  }, [shareLocalStorageKey]);

  const resolvedItems = items.map((item) =>
    item.key === "share" && localShareDone ? { ...item, done: true } : item
  );

  if (resolvedItems.every((i) => i.done)) return null;

  const doneCount = resolvedItems.filter((i) => i.done).length;
  const total = resolvedItems.length;

  return (
    <div className="glass-card p-8 md:p-10 mb-8 relative overflow-hidden">
      {/* Subtle lime wash top-left to give the card more visual weight than a plain list */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(500px 200px at 0% 0%, rgba(197,214,52,0.06), transparent 60%)",
        }}
      />
      <div className="relative flex items-center justify-between mb-6">
        <div>
          <h3 className="font-display text-xl md:text-2xl font-semibold">
            {title}
          </h3>
          <p className="text-xs text-[color:var(--dopl-cream)]/45 mt-1 font-mono uppercase tracking-[0.15em]">
            {`${doneCount} of ${total} complete`}
          </p>
        </div>
        <div className="hidden md:block">
          <div className="h-1.5 w-32 rounded-full bg-[color:var(--dopl-sage)]/30 overflow-hidden">
            <div
              className="h-full bg-[color:var(--dopl-lime)] transition-all duration-500"
              style={{ width: `${Math.round((doneCount / total) * 100)}%` }}
            />
          </div>
        </div>
      </div>
      <ul className="relative space-y-3">
        {resolvedItems.map((item) => {
          const Icon = ICONS[item.key];
          return (
            <li
              key={item.key}
              className={`flex items-center gap-4 p-3 md:p-4 rounded-xl transition-colors ${
                item.done
                  ? "bg-transparent"
                  : "bg-[color:var(--dopl-deep)]/50 hover:bg-[color:var(--dopl-deep)]"
              }`}
            >
              <div
                className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border transition-colors ${
                  item.done
                    ? "bg-[color:var(--dopl-lime)]/15 border-[color:var(--dopl-lime)]/30 text-[color:var(--dopl-lime)]"
                    : "bg-[color:var(--dopl-sage)]/20 border-[color:var(--dopl-sage)]/30 text-[color:var(--dopl-cream)]/50"
                }`}
              >
                {item.done ? <Check size={18} /> : <Icon size={18} />}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm md:text-base font-semibold ${
                    item.done
                      ? "text-[color:var(--dopl-cream)]/40 line-through"
                      : "text-[color:var(--dopl-cream)]"
                  }`}
                >
                  {item.label}
                </p>
                {item.sublabel && !item.done && (
                  <p className="text-xs text-[color:var(--dopl-cream)]/50 mt-0.5">
                    {item.sublabel}
                  </p>
                )}
              </div>
              {item.done ? (
                <span className="text-[10px] uppercase tracking-[0.2em] font-mono text-[color:var(--dopl-lime)]/70 shrink-0">
                  done
                </span>
              ) : (
                item.href && (
                  <Link
                    href={item.href}
                    className="shrink-0 btn-lime text-xs px-4 py-2 rounded-lg inline-flex items-center gap-1.5"
                  >
                    {item.cta ?? "go →"}
                  </Link>
                )
              )}
              {!item.done && !item.href && <Circle size={14} className="opacity-0" />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
