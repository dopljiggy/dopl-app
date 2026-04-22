"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, UserPlus, UserMinus } from "lucide-react";
import { useFmNotificationsContext } from "@/components/fm-notifications-context";
import type { Notification } from "@/types/database";

type AnchorPos =
  | { kind: "top"; top: number; right: number }
  | { kind: "bottom"; bottom: number; right: number };

function formatTierPrice(meta: Record<string, unknown> | null | undefined) {
  if (!meta) return null;
  const tier = typeof meta.tier === "string" ? meta.tier : null;
  const priceCents = typeof meta.price_cents === "number" ? meta.price_cents : null;
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
  return `${Math.floor(s / 86400)}d ago`;
}

/**
 * FM-side notification bell. Mirrors the dopler bell's portal pattern
 * (createPortal to document.body, getBoundingClientRect-anchored fixed
 * positioning, click-outside guarding both button and dropdown refs) so
 * opening the dropdown never distorts the host nav — the nav-shift bug
 * Sprint 3 R3 fixed on the dopler side.
 *
 * Consumer decides the anchor direction: `anchor="top"` (default) opens
 * downward, `anchor="bottom"` opens upward. Mobile bottom-nav mounts
 * pass `anchor="bottom"`; desktop header/sidebar mounts omit the prop.
 */
export default function FmNotificationBell({
  anchor: anchorMode = "top",
}: {
  anchor?: "top" | "bottom";
}) {
  const { notifications, unreadCount, markAllRead } =
    useFmNotificationsContext();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<AnchorPos | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const computePos = (): AnchorPos | null => {
    const btn = buttonRef.current;
    if (!btn) return null;
    const rect = btn.getBoundingClientRect();
    if (anchorMode === "bottom") {
      return {
        kind: "bottom",
        bottom: window.innerHeight - rect.top + 8,
        right: window.innerWidth - rect.right,
      };
    }
    return {
      kind: "top",
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right,
    };
  };

  // Keep pos fresh against resize/scroll, but the INITIAL pos is set
  // synchronously inside the click handler below. An effect-only setter
  // would leave `pos = null` on the first render after `open` flips,
  // so the `open && pos` gate inside AnimatePresence would miss the
  // initial mount. Moving the first computation into the click handler
  // guarantees both `open` and `pos` are truthy in the same state batch.
  useEffect(() => {
    if (!open) return;
    const update = () => {
      const next = computePos();
      if (next) setPos(next);
    };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, anchorMode]);

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
            // Compute position BEFORE flipping open so the first render
            // after this click has pos != null and the portal mounts.
            const next = computePos();
            if (next) setPos(next);
            if (unreadCount > 0) void markAllRead();
          }
          setOpen((o) => !o);
        }}
        aria-label="fund manager activity"
        data-testid="fm-bell"
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
            {open && pos && (
              <motion.div
                ref={dropdownRef}
                data-testid="fm-bell-dropdown"
                initial={{ opacity: 0, y: pos.kind === "top" ? -6 : 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: pos.kind === "top" ? -6 : 6, scale: 0.98 }}
                transition={{ duration: 0.18, ease: [0.2, 0.7, 0.2, 1] }}
                style={
                  pos.kind === "top"
                    ? { top: pos.top, right: pos.right }
                    : { bottom: pos.bottom, right: pos.right }
                }
                className="fixed w-[min(360px,calc(100vw-2rem))] glass-card glass-card-strong p-3 z-[70]"
              >
                <div className="flex items-center justify-between px-2 py-1 mb-2">
                  <p className="text-xs font-mono text-[color:var(--dopl-cream)]/60 uppercase tracking-wider">
                    activity
                  </p>
                  <Link
                    href="/fund-manager/activity"
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
                      <FmBellRow
                        key={n.id}
                        notification={n}
                        onPicked={() => setOpen(false)}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}

function FmBellRow({
  notification,
  onPicked,
}: {
  notification: Notification;
  onPicked: () => void;
}) {
  const isAdded = notification.change_type === "subscription_added";
  const Icon = isAdded ? UserPlus : UserMinus;
  const tierLine = formatTierPrice(notification.meta);

  return (
    <Link
      href="/fund-manager/activity"
      onClick={onPicked}
      className={`w-full flex items-start gap-3 p-3 rounded-lg hover:bg-[color:var(--dopl-sage)]/25 transition-colors ${
        !notification.read
          ? "border-l-2 border-[color:var(--dopl-lime)]"
          : ""
      }`}
    >
      <div className="w-8 h-8 rounded-lg bg-[color:var(--dopl-lime)]/12 border border-[color:var(--dopl-lime)]/25 flex items-center justify-center text-[color:var(--dopl-lime)] shrink-0">
        <Icon size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{notification.title}</p>
        {notification.body && (
          <p className="text-xs text-[color:var(--dopl-cream)]/50 mt-0.5 line-clamp-2">
            {notification.body}
          </p>
        )}
        {tierLine && (
          <p className="text-[10px] uppercase tracking-[0.18em] font-mono text-[color:var(--dopl-cream)]/40 mt-1">
            {tierLine}
          </p>
        )}
      </div>
      <span className="text-[10px] text-[color:var(--dopl-cream)]/35 font-mono shrink-0">
        {timeAgo(notification.created_at)}
      </span>
    </Link>
  );
}
