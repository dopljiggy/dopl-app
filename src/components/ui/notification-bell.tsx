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

export default function NotificationBell({
  userId: _userId,
  tradingConnected = false,
  tradingName = null,
  tradingWebsite = null,
}: {
  userId: string | null;
  tradingConnected?: boolean;
  tradingName?: string | null;
  tradingWebsite?: string | null;
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

  // Compute anchor from button bounds when opening.
  useEffect(() => {
    if (!open) return;
    const update = () => {
      const btn = buttonRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      setAnchor({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
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
          setOpen((o) => !o);
          if (!open && unreadCount > 0) void markAllRead();
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
                style={{ top: anchor.top, right: anchor.right }}
                className="fixed w-[min(360px,calc(100vw-2rem))] glass-card glass-card-strong p-3 z-[70]"
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
                    {notifications.slice(0, 8).map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          setPopup({
                            id: n.id,
                            title: n.title,
                            body: n.body,
                            created_at: n.created_at,
                            actionable: n.actionable,
                          });
                          setOpen(false);
                        }}
                        className={`w-full text-left p-3 rounded-lg hover:bg-[color:var(--dopl-sage)]/25 transition-colors ${
                          !n.read
                            ? "border-l-2 border-[color:var(--dopl-lime)]"
                            : ""
                        }`}
                      >
                        <p className="text-sm font-semibold">{n.title}</p>
                        {n.body && (
                          <p className="text-xs text-[color:var(--dopl-cream)]/50 mt-0.5 line-clamp-2">
                            {n.body}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

      <NotificationPopup
        notification={popup}
        tradingConnected={tradingConnected}
        tradingName={tradingName}
        tradingWebsite={tradingWebsite}
        activeSubscribedPortfolioIds={activeSubscribedPortfolioIds}
        onClose={() => setPopup(null)}
      />
    </>
  );
}
