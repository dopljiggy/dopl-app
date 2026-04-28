"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNotificationsContext } from "@/components/notifications-context";
import { GlassCard } from "@/components/ui/glass-card";
import { Copy, ExternalLink, Link2, Check } from "lucide-react";
import Link from "next/link";
import {
  NotificationPopup,
  type PopupNotification,
} from "@/components/ui/notification-popup";
import { buildBrokerTradeUrl, getBrokerHomepage } from "@/lib/broker-deeplinks";
import { timeAgo } from "@/lib/time-ago";

function extractTicker(body: string | null | undefined): string | null {
  if (!body) return null;
  const m = body.match(/\b(added|removed|bought|sold)\s+([A-Z0-9.\-]{1,10})\b/);
  if (m) return m[2];
  const token = body.trim().split(/\s+/).pop();
  if (token && /^[A-Z0-9.\-]{1,10}$/.test(token)) return token;
  return null;
}

export default function NotificationsClient({
  brokerPreference,
}: {
  brokerPreference: string | null;
}) {
  const {
    notifications,
    unreadCount,
    markAllRead,
    activeSubscribedPortfolioIds,
  } = useNotificationsContext();
  const [copied, setCopied] = useState<string | null>(null);
  const [popup, setPopup] = useState<PopupNotification | null>(null);

  useEffect(() => {
    if (unreadCount > 0) void markAllRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadCount]);

  const copyTicker = async (ticker: string, id: string) => {
    try {
      await navigator.clipboard.writeText(ticker);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight">
          notifications
        </h1>
        {unreadCount > 0 && (
          <span className="text-xs font-mono px-2 py-1 rounded bg-[color:var(--dopl-lime)]/10 text-[color:var(--dopl-lime)]">
            {unreadCount} new
          </span>
        )}
      </div>

      {notifications.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <p className="text-sm text-[color:var(--dopl-cream)]/40">
            no notifications yet
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {notifications.map((n) => {
              const ticker = n.ticker ?? extractTicker(n.body);
              const isCopied = copied === n.id;
              const isSell = n.change_type === "sell";
              return (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`rounded-xl p-4 cursor-pointer transition-colors bg-[color:var(--dopl-sage)]/10 hover:bg-[color:var(--dopl-sage)]/20 ${
                    !n.read ? "border-l-2 border-[color:var(--dopl-lime)]" : ""
                  }`}
                  onClick={() =>
                    setPopup({
                      id: n.id,
                      title: n.title,
                      body: n.body,
                      created_at: n.created_at,
                      actionable: n.actionable,
                      meta: n.meta,
                      ticker: n.ticker,
                      change_type: n.change_type,
                    })
                  }
                >
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <div className="flex items-center gap-3">
                      {ticker ? (
                        <span
                          className={`font-mono text-2xl font-bold ${
                            isSell
                              ? "text-amber-400"
                              : "text-[color:var(--dopl-lime)]"
                          }`}
                        >
                          {ticker}
                        </span>
                      ) : (
                        <span className="text-sm font-semibold">{n.title}</span>
                      )}
                      {n.meta?.manual === true && (
                        <span className="text-[9px] uppercase tracking-[0.2em] font-mono text-[color:var(--dopl-cream)]/40 border border-[color:var(--dopl-cream)]/20 px-1.5 py-0.5 rounded-md">
                          manual
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-[color:var(--dopl-cream)]/30 font-mono shrink-0">
                      {timeAgo(n.created_at)}
                    </span>
                  </div>

                  {ticker && (
                    <p className="text-sm font-semibold text-[color:var(--dopl-cream)]/70 mb-0.5">
                      {n.title}
                    </p>
                  )}

                  {n.body && (
                    <p className="text-xs text-[color:var(--dopl-cream)]/40">
                      {n.body}
                    </p>
                  )}

                  {n.actionable === false ? (
                    <div className="mt-2 text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/40 font-mono">
                      informational
                    </div>
                  ) : (
                    <div
                      className="mt-3 flex flex-wrap gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {ticker && (
                        <button
                          onClick={() => copyTicker(ticker, n.id)}
                          className="px-3 py-1.5 text-xs rounded-lg bg-[color:var(--dopl-sage)]/20 hover:bg-[color:var(--dopl-sage)]/40 transition-colors inline-flex items-center gap-1.5"
                        >
                          {isCopied ? (
                            <>
                              <Check
                                size={12}
                                className="text-[color:var(--dopl-lime)]"
                              />
                              copied
                            </>
                          ) : (
                            <>
                              <Copy size={12} />
                              copy {ticker}
                            </>
                          )}
                        </button>
                      )}

                      {brokerPreference && brokerPreference !== "Other" ? (
                        <a
                          href={
                            buildBrokerTradeUrl(
                              brokerPreference,
                              getBrokerHomepage(brokerPreference),
                              ticker
                            ) ?? getBrokerHomepage(brokerPreference) ?? "#"
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 text-xs rounded-lg bg-[color:var(--dopl-lime)]/10 hover:bg-[color:var(--dopl-lime)]/20 transition-colors inline-flex items-center gap-1.5 text-[color:var(--dopl-lime)]"
                        >
                          <ExternalLink size={12} />
                          open {brokerPreference}
                        </a>
                      ) : !brokerPreference ? (
                        <Link
                          href="/settings"
                          className="px-3 py-1.5 text-xs rounded-lg hover:bg-[color:var(--dopl-lime)]/10 transition-colors inline-flex items-center gap-1.5 text-[color:var(--dopl-cream)]/50 hover:text-[color:var(--dopl-lime)]"
                        >
                          <Link2 size={12} />
                          set your broker
                        </Link>
                      ) : null}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <NotificationPopup
        notification={popup}
        brokerPreference={brokerPreference}
        activeSubscribedPortfolioIds={activeSubscribedPortfolioIds}
        onClose={() => setPopup(null)}
      />
    </div>
  );
}

