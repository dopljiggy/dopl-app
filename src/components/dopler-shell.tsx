"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Home, Compass, Bell, User } from "lucide-react";
import { useEffect, useState } from "react";
import NotificationBell from "@/components/ui/notification-bell";
import PageTransition from "@/components/ui/page-transition";
import { createClient } from "@/lib/supabase";
import { useNotifications } from "@/hooks/use-notifications";

const nav = [
  { href: "/feed", icon: Home, label: "feed" },
  { href: "/leaderboard", icon: Compass, label: "discover" },
  { href: "/notifications", icon: Bell, label: "alerts" },
  { href: "/settings", icon: User, label: "profile" },
];

export default function DoplerShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  const { unreadCount } = useNotifications(userId);

  return (
    <div className="min-h-screen pb-24 md:pb-0">
      {/* Top nav — all sizes */}
      <nav className="sticky top-0 z-30 backdrop-blur-xl bg-[color:var(--dopl-deep)]/65 border-b border-[color:var(--glass-border)]">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-6">
          <Link
            href="/feed"
            className="flex items-center gap-2"
            aria-label="dopl home"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/dopl-logo.svg"
              alt=""
              width={26}
              height={26}
              className="rounded-lg"
            />
            <span className="font-display text-xl font-semibold tracking-tight">
              dopl
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1 ml-4">
            {nav.slice(0, 3).map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    active
                      ? "text-[color:var(--dopl-lime)]"
                      : "text-[color:var(--dopl-cream)]/60 hover:text-[color:var(--dopl-cream)]"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="dopler-top-active"
                      className="absolute inset-0 rounded-lg bg-[color:var(--dopl-lime)]/10 border border-[color:var(--dopl-lime)]/20"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="relative">{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <NotificationBell userId={userId} />
          </div>
        </div>
      </nav>

      <PageTransition>{children}</PageTransition>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto max-w-md px-3 pb-3">
          <div className="glass-card glass-card-strong flex items-center justify-around py-2 px-2 rounded-2xl">
            {nav.map((item) => {
              const active = pathname === item.href;
              const showBadge =
                item.href === "/notifications" && unreadCount > 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="relative flex flex-col items-center justify-center flex-1 py-2 min-h-[44px]"
                >
                  {active && (
                    <motion.span
                      layoutId="dopler-bottom-active"
                      className="absolute inset-1 rounded-xl bg-[color:var(--dopl-lime)]/12 border border-[color:var(--dopl-lime)]/25"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <div className="relative">
                    <item.icon
                      size={20}
                      strokeWidth={active ? 2.4 : 1.6}
                      className={`relative ${
                        active
                          ? "text-[color:var(--dopl-lime)]"
                          : "text-[color:var(--dopl-cream)]/60"
                      }`}
                      fill={active ? "rgba(197,214,52,0.18)" : "none"}
                    />
                    {showBadge && (
                      <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-[color:var(--dopl-lime)] text-[color:var(--dopl-deep)] text-[9px] font-mono font-bold flex items-center justify-center">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </div>
                  <span
                    className={`relative text-[10px] mt-0.5 ${
                      active
                        ? "text-[color:var(--dopl-lime)]"
                        : "text-[color:var(--dopl-cream)]/50"
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
