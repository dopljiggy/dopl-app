"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, TrendingUp, LogOut } from "lucide-react";
import { CancelSubscriptionButton } from "@/components/ui/cancel-subscription-button";
import { useNotificationsContext } from "@/components/notifications-context";
import { BrokerPreferencePicker } from "@/components/broker-preference-picker";
import { createClient } from "@/lib/supabase";
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
  displayName,
  email,
  brokerPreference,
  subscriptions,
}: {
  userId: string;
  displayName: string;
  email: string | null;
  brokerPreference: string | null;
  subscriptions: MeSubscription[];
}) {
  const [subs, setSubs] = useState<MeSubscription[]>(subscriptions);
  const { notifications } = useNotificationsContext();
  const [signingOut, setSigningOut] = useState(false);

  const handleCancelled = (id: string) => {
    setSubs((prev) => prev.filter((s) => s.id !== id));
  };

  const signOut = async () => {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight mb-8">
        {displayName}
      </h1>

      <section className="mb-10">
        <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/50 mb-3">
          you are dopling...
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
                    {s.portfolio?.tier ?? "—"}
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
          your activity
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl glass-card-light p-5">
            <div className="flex items-center gap-2 mb-2">
              <Bell size={14} className="text-[color:var(--dopl-lime)]" />
              <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/40">
                alerts received
              </p>
            </div>
            <p className="text-2xl font-display font-semibold">
              {notifications.length}
            </p>
          </div>
          <div className="rounded-2xl glass-card-light p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={14} className="text-[color:var(--dopl-lime)]" />
              <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/40">
                portfolios
              </p>
            </div>
            <p className="text-2xl font-display font-semibold">
              {subs.length}
            </p>
          </div>
        </div>
        {notifications.length > 0 && (
          <Link
            href="/notifications"
            className="text-xs text-[color:var(--dopl-lime)] mt-3 inline-block hover:underline"
          >
            view all notifications →
          </Link>
        )}
      </section>

      <section className="mb-10">
        <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/50 mb-3">
          settings
        </h2>
        <div className="space-y-3">
          <div className="rounded-2xl glass-card-light p-5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/40 mb-1">
              name
            </p>
            <p className="text-sm">{displayName}</p>
          </div>
          {email && (
            <div className="rounded-2xl glass-card-light p-5">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/40 mb-1">
                email
              </p>
              <p className="text-sm font-mono">{email}</p>
            </div>
          )}
          <div className="rounded-2xl glass-card-light p-5">
            <BrokerPreferencePicker initial={brokerPreference} />
          </div>
        </div>
      </section>

      <button
        onClick={signOut}
        disabled={signingOut}
        className="glass-card-light rounded-xl px-4 py-3 text-sm flex items-center gap-2 hover:bg-[color:var(--dopl-sage)]/30 transition-colors disabled:opacity-50 w-full"
      >
        <LogOut size={14} className="text-[color:var(--dopl-cream)]/50" />
        {signingOut ? "signing out..." : "sign out"}
      </button>
    </div>
  );
}
