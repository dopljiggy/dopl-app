"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { CancelSubscriptionButton } from "@/components/ui/cancel-subscription-button";
import { useNotificationsContext } from "@/components/notifications-context";
import type { Notification } from "@/types/database";

export type MeSubscription = {
  id: string;
  price_cents: number | null;
  created_at: string;
  portfolio: {
    id: string;
    name: string;
    tier: string;
    price_cents: number;
  } | null;
  fund_manager: {
    id: string;
    handle: string;
    display_name: string;
  } | null;
};

export default function MeClient({
  userId: _userId,
  subscriptions,
}: {
  userId: string;
  subscriptions: MeSubscription[];
}) {
  const [subs, setSubs] = useState<MeSubscription[]>(subscriptions);
  const { notifications } = useNotificationsContext();

  const monthlyCents = subs.reduce(
    (sum, s) => sum + (s.price_cents ?? 0),
    0
  );
  const monthlyDollars = monthlyCents / 100;

  const handleCancelled = (id: string) => {
    setSubs((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight mb-2">
        /me
      </h1>
      <p className="text-sm text-[color:var(--dopl-cream)]/55 mb-8">
        your subscriptions, your spend, your notifications.
      </p>

      <section className="mb-10">
        <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/50 mb-3">
          your subscriptions
        </h2>
        {subs.length === 0 ? (
          <div className="rounded-2xl glass-card-light p-8 text-center">
            <p className="text-sm text-[color:var(--dopl-cream)]/60 mb-4">
              you&apos;re not dopling anyone yet
            </p>
            <Link
              href="/leaderboard"
              className="btn-lime text-sm px-5 py-2 inline-block"
            >
              discover fund managers
            </Link>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {subs.map((s) => (
              <motion.div
                key={s.id}
                layout
                initial={{ opacity: 1 }}
                exit={{
                  opacity: 0,
                  height: 0,
                  marginBottom: 0,
                  paddingTop: 0,
                  paddingBottom: 0,
                }}
                transition={{ duration: 0.2 }}
                className="rounded-2xl glass-card-light p-5 mb-3 flex items-start gap-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[color:var(--dopl-cream)]/50 font-mono">
                    @{s.fund_manager?.handle ?? "fund-manager"}
                  </p>
                  <p className="text-base font-semibold mt-0.5">
                    {s.portfolio?.name ?? "portfolio"}
                  </p>
                  <p className="text-[10px] uppercase tracking-[0.18em] font-mono text-[color:var(--dopl-cream)]/40 mt-2">
                    {s.portfolio?.tier ?? "—"}{" "}
                    {s.price_cents != null && s.price_cents > 0
                      ? `— $${(s.price_cents / 100).toFixed(0)}/mo`
                      : "— free"}
                  </p>
                </div>
                <CancelSubscriptionButton
                  subscriptionId={s.id}
                  onCancelled={() => handleCancelled(s.id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </section>

      <section className="mb-10">
        <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/50 mb-3">
          your monthly spend
        </h2>
        <div className="rounded-2xl glass-card-light p-6">
          <p className="text-3xl font-display font-semibold">
            {`$${monthlyDollars.toFixed(0)}`}
          </p>
          <p className="text-xs text-[color:var(--dopl-cream)]/50 mt-1">
            per month, across {subs.length} active sub
            {subs.length === 1 ? "" : "s"}
          </p>
        </div>
      </section>

      <section className="mb-10">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/50">
            recent notifications
          </h2>
          <Link
            href="/notifications"
            className="text-xs text-[color:var(--dopl-lime)] hover:underline"
          >
            see all →
          </Link>
        </div>
        {notifications.length === 0 ? (
          <div className="rounded-2xl glass-card-light p-6 text-center text-xs text-[color:var(--dopl-cream)]/50">
            nothing yet
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.slice(0, 5).map((n) => (
              <NotificationMini key={n.id} n={n} />
            ))}
          </div>
        )}
      </section>

      <div className="mt-10 pt-6 border-t border-[color:var(--glass-border)]">
        <Link
          href="/settings"
          className="text-xs text-[color:var(--dopl-cream)]/45 hover:text-[color:var(--dopl-cream)]"
        >
          account settings →
        </Link>
      </div>
    </div>
  );
}

function NotificationMini({ n }: { n: Notification }) {
  return (
    <div className="rounded-xl glass-card-light p-4">
      <p className="text-sm font-semibold">{n.title}</p>
      {n.body && (
        <p className="text-xs text-[color:var(--dopl-cream)]/50 mt-1">
          {n.body}
        </p>
      )}
    </div>
  );
}
