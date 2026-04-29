"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Bell } from "lucide-react";
import { useNotificationsContext } from "@/components/notifications-context";
import {
  NotificationPopup,
  type PopupNotification,
} from "@/components/ui/notification-popup";
import { timeAgo } from "@/lib/time-ago";

export default function NotificationBell({
  userId: _userId,
  brokerPreference = null,
}: {
  userId: string | null;
  brokerPreference?: string | null;
}) {
  const {
    notifications,
    unreadCount,
    markAllRead,
    activeSubscribedPortfolioIds,
  } = useNotificationsContext();
  const [open, setOpen] = useState(false);
  const [popup, setPopup] = useState<PopupNotification | null>(null);
  const [mounted, setMounted] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(
    null
  );
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const computeAnchor = (): { top: number; right: number } | null => {
    const btn = buttonRef.current;
    if (!btn) return null;
    const rect = btn.getBoundingClientRect();
    return {
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right,
    };
  };

  // Keep anchor fresh against resize/scroll. The INITIAL anchor is set
  // synchronously inside the click handler below — effect-only setting
  // leaves anchor=null on the first render after open flips, which makes
  // the `open && anchor` gate in AnimatePresence miss the initial mount.
  // Same latent race as the FM bell (Sprint 6 fix).
  useEffect(() => {
    if (!open) return;
    const update = () => {
      const next = computeAnchor();
      if (next) setAnchor(next);
    };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Click outside to close — guard both button and dropdown (portal means
  // the dropdown isn't a DOM descendant of the button).
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => {
          if (!open) {
            const next = computeAnchor();
            if (next) setAnchor(next);
            if (unreadCount > 0) void markAllRead();
          }
          setOpen((o) => !o);
        }}
        aria-label="notifications"
        className="relative p-2 text-[color:var(--dopl-cream)]/60 hover:text-[color:var(--dopl-cream)] transition-colors"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center">
            <span className="absolute inline-flex h-full w-full rounded-full bg-[color:var(--dopl-lime)] opacity-60 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[color:var(--dopl-lime)]" />
          </span>
        )}
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && anchor && (
              <motion.div
                ref={dropdownRef}
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.18, ease: [0.2, 0.7, 0.2, 1] }}
                style={{ position: "fixed", top: anchor.top, right: anchor.right }}
                className="w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-[color:var(--glass-border-strong)] bg-[color:var(--dopl-deep-2)] p-3 z-[70] shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)]"
              >
                <div className="flex items-center justify-between px-2 py-1 mb-2">
                  <p className="text-xs font-mono text-[color:var(--dopl-cream)]/60 uppercase tracking-wider">
                    notifications
                  </p>
                  <Link
                    href="/notifications"
                    className="text-xs text-[color:var(--dopl-lime)] hover:underline"
                    onClick={() => setOpen(false)}
                  >
                    see all
                  </Link>
                </div>
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[color:var(--dopl-cream)]/40">
                    nothing yet
                  </div>
                ) : (
                  <div className="max-h-[70vh] overflow-y-auto space-y-1">
                    {notifications.slice(0, 8).map((n) => {
                      const ticker = n.ticker;
                      const isSell = n.change_type === "sell";
                      return (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            // Defer popup mount by one frame so the
                            // dropdown's exit animation starts and
                            // doesn't share the same render commit as
                            // the popup mount — without this on mobile
                            // the popup appears at the top of the
                            // viewport instead of centered, since
                            // layout measures while the dropdown is
                            // still in the DOM.
                            const next = {
                              id: n.id,
                              title: n.title,
                              body: n.body,
                              created_at: n.created_at,
                              actionable: n.actionable,
                              meta: n.meta,
                              ticker: n.ticker,
                              change_type: n.change_type,
                            };
                            setOpen(false);
                            requestAnimationFrame(() => setPopup(next));
                          }}
                          className={`w-full text-left p-3 rounded-xl hover:bg-[color:var(--dopl-sage)]/25 transition-colors ${
                            !n.read
                              ? "border-l-2 border-[color:var(--dopl-lime)]"
                              : ""
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            {ticker ? (
                              <span
                                className={`font-mono text-lg font-bold ${
                                  isSell
                                    ? "text-amber-400"
                                    : "text-[color:var(--dopl-lime)]"
                                }`}
                              >
                                {ticker}
                              </span>
                            ) : (
                              <span className="text-sm font-semibold">
                                {n.title}
                              </span>
                            )}
                            <span className="text-[10px] text-[color:var(--dopl-cream)]/30 font-mono shrink-0">
                              {timeAgo(n.created_at)}
                            </span>
                          </div>
                          {ticker && (
                            <p className="text-xs font-semibold text-[color:var(--dopl-cream)]/70">
                              {n.title}
                            </p>
                          )}
                          {n.body && (
                            <p className="text-[11px] text-[color:var(--dopl-cream)]/40 mt-0.5 line-clamp-1">
                              {n.body}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

      <NotificationPopup
        notification={popup}
        brokerPreference={brokerPreference}
        activeSubscribedPortfolioIds={activeSubscribedPortfolioIds}
        onClose={() => setPopup(null)}
      />
    </>
  );
}
