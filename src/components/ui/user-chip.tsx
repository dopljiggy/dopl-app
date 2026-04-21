"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, LogOut, Settings, LayoutDashboard, Home } from "lucide-react";

type Props = {
  handle: string | null;
  displayName?: string | null;
  role: "fund_manager" | "subscriber";
  onSignOut: () => Promise<void> | void;
};

/**
 * Top-right handle chip for authed users on `/`. Click opens a small
 * dropdown with a role-appropriate primary link + settings + sign out.
 */
export function UserChip({ handle, displayName, role, onSignOut }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // FMs have handles (they publish at dopl.com/handle) — show @handle.
  // Doplers don't set a handle — show displayName (or a short fallback).
  // "@you" was too generic and unfriendly; removed.
  const label = (() => {
    if (role === "fund_manager" && handle) return `@${handle}`;
    if (displayName) return displayName;
    if (handle) return `@${handle}`;
    return "me";
  })();
  const avatarLetter =
    (displayName ?? handle ?? "?").charAt(0).toUpperCase();

  const primaryLabel = role === "fund_manager" ? "dashboard" : "feed";
  const primaryHref = role === "fund_manager" ? "/dashboard" : "/feed";
  const PrimaryIcon = role === "fund_manager" ? LayoutDashboard : Home;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="glass-card-light px-3 py-1.5 rounded-full text-xs inline-flex items-center gap-2 hover:bg-[color:var(--dopl-sage)]/40"
      >
        <span className="w-6 h-6 rounded-full bg-[color:var(--dopl-lime)]/15 text-[color:var(--dopl-lime)] font-mono text-[11px] flex items-center justify-center">
          {avatarLetter}
        </span>
        <span className="font-mono">{label}</span>
        <ChevronDown size={12} className="opacity-60" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.2, 0.7, 0.2, 1] }}
            className="absolute right-0 mt-2 w-48 glass-card glass-card-strong p-2 z-50"
          >
            <Link
              href={primaryHref}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-[color:var(--dopl-sage)]/25"
              onClick={() => setOpen(false)}
            >
              <PrimaryIcon size={14} />
              {primaryLabel}
            </Link>
            <Link
              href="/settings"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-[color:var(--dopl-sage)]/25"
              onClick={() => setOpen(false)}
            >
              <Settings size={14} />
              settings
            </Link>
            <button
              onClick={() => {
                setOpen(false);
                void onSignOut();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-[color:var(--dopl-sage)]/25 text-left"
            >
              <LogOut size={14} />
              sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
