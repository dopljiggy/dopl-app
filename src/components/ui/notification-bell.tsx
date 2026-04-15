"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Bell } from "lucide-react";
import { useNotifications } from "@/hooks/use-notifications";
import { fireToast } from "@/components/ui/toast";
import {
  NotificationPopup,
  type PopupNotification,
} from "@/components/ui/notification-popup";

export default function NotificationBell({
  userId,
  tradingConnected = false,
  tradingName = null,
  tradingWebsite = null,
}: {
  userId: string | null;
  tradingConnected?: boolean;
  tradingName?: string | null;
  tradingWebsite?: string | null;
}) {
  const { notifications, unreadCount, markAllRead } = useNotifications(userId);
  const [open, setOpen] = useState(false);
  const [popup, setPopup] = useState<PopupNotification | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef<string | null>(null);

  // Fire a toast on each newly received notification (not on initial load).
  useEffect(() => {
    if (!notifications.length) return;
    const newest = notifications[0];
    if (lastIdRef.current === null) {
      lastIdRef.current = newest.id;
      return;
    }
    if (newest.id !== lastIdRef.current) {
      lastIdRef.current = newest.id;
      if (!newest.read) {
        fireToast({
          title: newest.title,
          body: newest.body ?? undefined,
        });
      }
    }
  }, [notifications]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
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

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.2, 0.7, 0.2, 1] }}
            className="absolute right-0 mt-2 w-[min(360px,calc(100vw-2rem))] glass-card glass-card-strong p-3 z-50"
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
              <div className="max-h-80 overflow-y-auto space-y-1">
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
      </AnimatePresence>

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
