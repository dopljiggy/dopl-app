"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Copy,
  ExternalLink,
  Link2,
  Check,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export type PopupNotification = {
  id: string;
  title: string;
  body: string | null;
  created_at: string;
  actionable?: boolean;
  meta?: Record<string, unknown> | null;
  // Typed DB columns — prefer these over regex-parsing the body.
  // Optional so legacy callers that only pass {id,title,body,created_at}
  // still compile; the popup falls back to extractTicker for those.
  ticker?: string | null;
  change_type?: string | null;
};

function extractPortfolioId(
  meta: Record<string, unknown> | null | undefined
): string | null {
  const pid = meta?.portfolio_id;
  return typeof pid === "string" ? pid : null;
}

function extractTicker(body: string | null | undefined): string | null {
  if (!body) return null;
  const m = body.match(
    /\b(added|removed|bought|sold)\s+([A-Z0-9.\-]{1,10})\b/
  );
  if (m) return m[2];
  const token = body.trim().split(/\s+/).pop();
  if (token && /^[A-Z0-9.\-]{1,10}$/.test(token)) return token;
  return null;
}

/**
 * Full-screen modal that opens when a dopler taps a notification.
 * Mobile: bottom-sheet slide-up. Desktop: centered modal with scale-in.
 */
export function NotificationPopup({
  notification,
  tradingConnected,
  tradingName,
  tradingWebsite,
  activeSubscribedPortfolioIds,
  onClose,
}: {
  notification: PopupNotification | null;
  tradingConnected: boolean;
  tradingName: string | null;
  tradingWebsite: string | null;
  activeSubscribedPortfolioIds?: Set<string>;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
  }, [notification?.id]);

  // Prefer the typed ticker column; fall back to regex-extracting the
  // body for legacy notifications that predate the column being populated.
  const ticker = notification?.ticker ?? extractTicker(notification?.body);
  const notifPortfolioId = extractPortfolioId(notification?.meta);
  // Stale-actionable guard: if the notification's portfolio is NOT in the
  // dopler's currently-active subscriptions (e.g. they cancelled, or the
  // notification is from before they ever subscribed), downgrade the CTA
  // from broker-action to a read-only "view portfolio" link. Fallback is
  // permissive — rows without portfolio_id (legacy pre-Sprint-5) keep the
  // existing broker-action behavior.
  const isStaleActionable =
    !!notifPortfolioId &&
    !!activeSubscribedPortfolioIds &&
    !activeSubscribedPortfolioIds.has(notifPortfolioId);

  const copyTicker = async () => {
    if (!ticker) return;
    try {
      await navigator.clipboard.writeText(ticker);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <AnimatePresence>
      {notification && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-end md:items-center justify-center"
          onClick={onClose}
        >
          <div
            aria-hidden
            className="absolute inset-0 bg-[color:var(--dopl-deep)]/70 backdrop-blur-md"
          />

          <motion.div
            initial={{ y: "100%", opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: "100%", opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full md:max-w-md glass-card glass-card-strong rounded-t-3xl md:rounded-3xl p-6 md:p-7 md:mx-4 pb-8 md:pb-7"
            style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
          >
            <button
              onClick={onClose}
              aria-label="close"
              className="absolute top-4 right-4 text-[color:var(--dopl-cream)]/40 hover:text-[color:var(--dopl-cream)]"
            >
              <X size={16} />
            </button>

            {/* Mobile grabber */}
            <div className="md:hidden mx-auto mb-5 h-1 w-10 rounded-full bg-[color:var(--dopl-cream)]/20" />

            <div className="w-11 h-11 rounded-2xl bg-[color:var(--dopl-lime)]/12 border border-[color:var(--dopl-lime)]/25 flex items-center justify-center text-[color:var(--dopl-lime)] mb-4">
              <TrendingUp size={18} />
            </div>

            <h3 className="font-display text-xl font-semibold mb-1 leading-snug pr-4">
              {notification.title}
            </h3>
            {notification.meta?.manual === true && (
              <div className="text-[10px] uppercase tracking-[0.2em] font-mono text-[color:var(--dopl-cream)]/40 mt-1 mb-2">
                manually sent by the fund manager
              </div>
            )}
            {notification.body && (
              <p className="text-sm text-[color:var(--dopl-cream)]/65 leading-relaxed mb-5">
                {notification.body}
              </p>
            )}

            {ticker && (
              <div className="glass-card-light rounded-xl p-4 mb-5">
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/40 mb-1">
                      ticker
                    </p>
                    <p className="font-mono text-2xl font-semibold text-[color:var(--dopl-lime)]">
                      {ticker}
                    </p>
                  </div>
                  <span className="text-xs text-[color:var(--dopl-cream)]/40 font-mono">
                    {timeAgo(notification.created_at)}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {notification.actionable === false ? (
                <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/40 font-mono text-center py-2">
                  informational
                </div>
              ) : isStaleActionable && notifPortfolioId ? (
                <Link
                  href={`/feed/${notifPortfolioId}`}
                  onClick={onClose}
                  className="btn-lime w-full text-sm py-3 inline-flex items-center justify-center gap-2"
                >
                  <ExternalLink size={14} />
                  view portfolio
                </Link>
              ) : (
                <>
                  {tradingConnected && tradingWebsite ? (
                    <a
                      href={tradingWebsite}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-lime w-full text-sm py-3 inline-flex items-center justify-center gap-2"
                    >
                      <ExternalLink size={14} />
                      trade this · open {tradingName ?? "broker"}
                    </a>
                  ) : (
                    <Link
                      href="/settings"
                      onClick={onClose}
                      className="btn-lime w-full text-sm py-3 inline-flex items-center justify-center gap-2"
                    >
                      <Link2 size={14} />
                      connect where you trade
                    </Link>
                  )}

                  {ticker && (
                    <button
                      onClick={copyTicker}
                      className="w-full glass-card-light py-2.5 text-sm rounded-xl hover:bg-[color:var(--dopl-sage)]/40 transition-colors inline-flex items-center justify-center gap-2"
                    >
                      {copied ? (
                        <>
                          <Check size={14} className="text-[color:var(--dopl-lime)]" />
                          copied!
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          copy {ticker}
                        </>
                      )}
                    </button>
                  )}
                </>
              )}

              <button
                onClick={onClose}
                className="w-full py-2.5 text-xs text-[color:var(--dopl-cream)]/50 hover:text-[color:var(--dopl-cream)] transition-colors"
              >
                dismiss
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
