"use client";

import Link from "next/link";
import { Check, Circle } from "lucide-react";

export type FinishSetupItem = {
  label: string;
  done: boolean;
  href?: string;
  cta?: string;
};

type Props = {
  items: FinishSetupItem[];
  title?: string;
};

/**
 * Post-onboarding nudge card for the FM dashboard. Auto-hides once
 * every item is done.
 */
export function FinishSetupChecklist({
  items,
  title = "finish setting up",
}: Props) {
  if (items.every((i) => i.done)) return null;

  return (
    <div className="glass-card p-5 mb-8">
      <h3 className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/70 mb-3">
        {title}
      </h3>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.label}
            className="flex items-center gap-3 text-sm"
          >
            {item.done ? (
              <Check
                size={16}
                className="text-[color:var(--dopl-lime)] shrink-0"
              />
            ) : (
              <Circle
                size={16}
                className="text-[color:var(--dopl-cream)]/40 shrink-0"
              />
            )}
            <span
              className={
                item.done
                  ? "text-[color:var(--dopl-cream)]/40 line-through"
                  : "text-[color:var(--dopl-cream)]/80"
              }
            >
              {item.label}
            </span>
            {!item.done && item.href && (
              <Link
                href={item.href}
                className="ml-auto text-xs text-[color:var(--dopl-lime)] hover:underline"
              >
                {item.cta ?? "go →"}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
