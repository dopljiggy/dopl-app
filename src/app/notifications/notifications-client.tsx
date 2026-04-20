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

function extractTicker(body: string | null | undefined): string | null {
  if (!body) return null;
  const m = body.match(/\b(added|removed|bought|sold)\s+([A-Z0-9.\-]{1,10})\b/);
  if (m) return m[2];
  const token = body.trim().split(/\s+/).pop();
  if (token && /^[A-Z0-9.\-]{1,10}$/.test(token)) return token;
  return null;
}

export default function NotificationsClient({
  tradingConnected,
  tradingName,
  tradingWebsite,
}: {
  tradingConnected: boolean;
  tradingName: string | null;
  tradingWebsite: string | null;
}) {
  const { notifications, unreadCount, markAllRead } = useNotificationsContext();
  const [copied, setCopied] = useState<string | null>(null);
  const [popup, setPopup] = useState<PopupNotification | null>(null);

  useEffect(() => {
    void markAllRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              const ticker = extractTicker(n.body);
              const isCopied = copied === n.id;
              return (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`glass-card p-4 cursor-pointer ${
                    !n.read ? "glow-gain" : ""
                  }`}
                  onClick={() =>
                    setPopup({
                      id: n.id,
                      title: n.title,
                      body: n.body,
                      created_at: n.created_at,
                      actionable: n.actionable,
                      meta: n.meta,
                    })
                  }
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                        n.read
                          ? "bg-[color:var(--dopl-sage)]"
                          : "bg-[color:var(--dopl-lime)]"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">
                        {n.title}
                        {n.meta?.manual === true && (
                          <span
                            title="manually sent by the fund manager"
                            className="text-[9px] uppercase tracking-[0.2em] font-mono text-[color:var(--dopl-cream)]/40 border border-[color:var(--dopl-cream)]/20 px-1.5 py-0.5 rounded-md ml-2"
                          >
                            manual
                          </span>
                        )}
                      </p>
                      {n.body && (
                        <p className="text-xs text-[color:var(--dopl-cream)]/50 mt-0.5">
                          {n.body}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-[color:var(--dopl-cream)]/30 font-mono shrink-0">
                      {timeAgo(n.created_at)}
                    </span>
                  </div>

                  {n.actionable === false ? (
                    <div className="mt-2 pl-5 text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/40 font-mono">
                      informational
                    </div>
                  ) : (
                    <div
                      className="mt-3 pl-5 flex flex-wrap gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {ticker && (
                        <button
                          onClick={() => copyTicker(ticker, n.id)}
                          className="glass-card-light px-3 py-1.5 text-xs rounded-lg hover:bg-[color:var(--dopl-sage)]/40 transition-colors inline-flex items-center gap-1.5"
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

                      {tradingConnected && tradingWebsite ? (
                        <a
                          href={tradingWebsite}
                          target="_blank"
                          rel="noreferrer"
                          className="glass-card-light px-3 py-1.5 text-xs rounded-lg hover:bg-[color:var(--dopl-lime)]/15 transition-colors inline-flex items-center gap-1.5 text-[color:var(--dopl-lime)]"
                        >
                          <ExternalLink size={12} />
                          open {tradingName ?? "broker"}
                        </a>
                      ) : (
                        <Link
                          href="/settings"
                          className="px-3 py-1.5 text-xs rounded-lg hover:bg-[color:var(--dopl-lime)]/10 transition-colors inline-flex items-center gap-1.5 text-[color:var(--dopl-cream)]/50 hover:text-[color:var(--dopl-lime)]"
                        >
                          <Link2 size={12} />
                          connect where you trade
                        </Link>
                      )}
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
        tradingConnected={tradingConnected}
        tradingName={tradingName}
        tradingWebsite={tradingWebsite}
        onClose={() => setPopup(null)}
      />
    </div>
  );
}

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
