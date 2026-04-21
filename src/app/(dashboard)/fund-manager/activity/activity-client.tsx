"use client";

import { UserPlus, UserMinus } from "lucide-react";
import { useFmNotificationsContext } from "@/components/fm-notifications-context";
import type { Notification } from "@/types/database";

function formatTierPrice(meta: Record<string, unknown> | null | undefined) {
  if (!meta) return "free tier";
  const tier = typeof meta.tier === "string" ? meta.tier : null;
  const priceCents =
    typeof meta.price_cents === "number" ? meta.price_cents : null;
  if (tier === "free" || priceCents == null || priceCents === 0) {
    return "free tier";
  }
  return `${tier ?? "paid"} — $${Math.round(priceCents / 100)}/mo`;
}

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ActivityRow({ notification }: { notification: Notification }) {
  const isAdded = notification.change_type === "subscription_added";
  const Icon = isAdded ? UserPlus : UserMinus;
  const tierLine = formatTierPrice(notification.meta);

  return (
    <div
      className={`flex items-start gap-4 p-5 rounded-2xl glass-card-light ${
        !notification.read
          ? "border-l-4 border-[color:var(--dopl-lime)]"
          : ""
      }`}
    >
      <div className="w-10 h-10 rounded-xl bg-[color:var(--dopl-lime)]/12 border border-[color:var(--dopl-lime)]/25 flex items-center justify-center text-[color:var(--dopl-lime)] shrink-0">
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{notification.title}</p>
        {notification.body && (
          <p className="text-xs text-[color:var(--dopl-cream)]/55 mt-1">
            {notification.body}
          </p>
        )}
        <p className="text-[10px] uppercase tracking-[0.18em] font-mono text-[color:var(--dopl-cream)]/40 mt-2">
          {tierLine}
        </p>
      </div>
      <span className="text-xs text-[color:var(--dopl-cream)]/40 font-mono shrink-0">
        {timeAgo(notification.created_at)}
      </span>
    </div>
  );
}

export default function ActivityClient({
  userId: _userId,
  initial,
}: {
  userId: string;
  initial: Notification[];
}) {
  const { notifications: liveNotifications } = useFmNotificationsContext();

  // Prefer the live list from context; fall back to the server-fetched
  // initial list if context hasn't hydrated yet. Defensive change_type
  // filter guards against any non-FM row slipping through — the server
  // fetch in page.tsx already narrows, but this keeps the UI honest if
  // a future contributor adds a second consumer that seeds the context
  // with broader data.
  const rows = liveNotifications.length > 0 ? liveNotifications : initial;
  const fmRows = rows.filter(
    (n) =>
      n.change_type === "subscription_added" ||
      n.change_type === "subscription_cancelled"
  );

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const newRows = fmRows.filter((n) => !n.read);
  const thisWeekRows = fmRows.filter(
    (n) => n.read && new Date(n.created_at).getTime() > sevenDaysAgo
  );

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight mb-2">
          activity
        </h1>
        <p className="text-sm text-[color:var(--dopl-cream)]/55">
          new doplers and cancellations across your portfolios.
        </p>
      </div>

      {fmRows.length === 0 ? (
        <div className="rounded-2xl glass-card-light p-8 text-center text-sm text-[color:var(--dopl-cream)]/50">
          nothing yet — share your dopl link to get your first dopler.
        </div>
      ) : (
        <>
          {newRows.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/50 mb-3">
                new
              </h2>
              <div className="space-y-2">
                {newRows.map((n) => (
                  <ActivityRow key={n.id} notification={n} />
                ))}
              </div>
            </section>
          )}
          {thisWeekRows.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/50 mb-3">
                this week
              </h2>
              <div className="space-y-2">
                {thisWeekRows.map((n) => (
                  <ActivityRow key={n.id} notification={n} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
