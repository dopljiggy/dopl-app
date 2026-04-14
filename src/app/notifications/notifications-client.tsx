"use client";

import Link from "next/link";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNotifications } from "@/hooks/use-notifications";

export default function NotificationsClient({ userId }: { userId: string }) {
  const { notifications, unreadCount, markAllRead } = useNotifications(userId);

  useEffect(() => {
    // mark read on view
    void markAllRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen">
      <nav className="flex items-center justify-between px-6 py-4 max-w-3xl mx-auto">
        <Link href="/feed" className="text-sm text-dopl-cream/60 hover:text-dopl-cream">
          ← back
        </Link>
        <Link href="/" className="font-display text-xl font-semibold">
          dopl
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-3xl font-semibold">notifications</h1>
          {unreadCount > 0 && (
            <span className="text-xs font-mono px-2 py-1 rounded bg-dopl-lime/10 text-dopl-lime">
              {unreadCount} new
            </span>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="glass-card p-12 text-center text-sm text-dopl-cream/40">
            no notifications yet
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {notifications.map((n) => (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`glass-card p-4 flex items-start gap-3 ${
                    !n.read ? "border-dopl-lime/30" : ""
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                      n.read ? "bg-dopl-sage" : "bg-dopl-lime"
                    }`}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{n.title}</p>
                    {n.body && (
                      <p className="text-xs text-dopl-cream/50 mt-0.5">
                        {n.body}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-dopl-cream/30 font-mono">
                    {timeAgo(n.created_at)}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </main>
  );
}

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
