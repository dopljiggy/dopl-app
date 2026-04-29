"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Home, Compass, Bell, User } from "lucide-react";
import { useEffect, useState } from "react";
import NotificationBell from "@/components/ui/notification-bell";
import { NotificationToastListener } from "@/components/ui/notification-toast-listener";
import PageTransition from "@/components/ui/page-transition";
import { NavLink } from "@/components/ui/nav-link";
import { createClient } from "@/lib/supabase";
import { useNotifications } from "@/hooks/use-notifications";
import { NotificationsProvider } from "@/components/notifications-context";
import PushPrompt from "@/components/pwa/push-prompt";

const nav = [
  { href: "/feed", icon: Home, label: "feed" },
  { href: "/leaderboard", icon: Compass, label: "discover" },
  { href: "/notifications", icon: Bell, label: "alerts" },
  { href: "/me", icon: User, label: "profile" },
];

export default function DoplerShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(null);

  const [brokerPreference, setBrokerPreference] = useState<string | null>(null);

  // Portfolio ids the viewer is currently subscribed to (`status='active'`).
  // Used by the popup's stale-actionable guard — position-change
  // notifications for a portfolio the dopler has since cancelled render
  // a "view portfolio" CTA instead of a broker-action CTA.
  const [activeSubscribedPortfolioIds, setActiveSubscribedPortfolioIds] =
    useState<Set<string>>(new Set());

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (!uid) return;
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("trading_broker_preference")
          .eq("id", uid)
          .maybeSingle();
        setBrokerPreference(profile?.trading_broker_preference ?? null);
      } catch {
        /* ignore — column may not exist yet */
      }
      try {
        const { data: subs } = await supabase
          .from("subscriptions")
          .select("portfolio_id")
          .eq("user_id", uid)
          .eq("status", "active");
        setActiveSubscribedPortfolioIds(
          new Set(
            (subs ?? []).map(
              (s) => (s as { portfolio_id: string }).portfolio_id
            )
          )
        );
      } catch {
        /* ignore */
      }
    });
  }, []);

  // Service worker posts PUSH_NAV when a push notification is tapped — iOS
  // Safari doesn't support client.navigate(), so the SW posts a message
  // and this listener does the navigation client-side.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "PUSH_NAV" && event.data.url) {
        window.location.href = event.data.url;
      }
    };
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () =>
      navigator.serviceWorker?.removeEventListener("message", onMessage);
  }, []);

  // Signal the StandaloneSplash that page content has mounted. Set the
  // global flag BEFORE dispatching so the splash can check it
  // synchronously when its own effect runs, even if that's after this
  // effect (concurrent mode, Suspense streaming).
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as Window & typeof globalThis & { __doplContentReady?: boolean }).__doplContentReady = true;
    window.dispatchEvent(new Event("dopl:content-ready"));
  }, []);

  // Clear any delivered push notifications still in the OS notification
  // tray when the app becomes visible. Two trigger points:
  //   1. Initial mount — covers "user opened the app directly", which
  //      doesn't fire visibilitychange.
  //   2. visibilitychange to "visible" — covers backgrounded → foreground
  //      transitions on PWAs.
  // SW.getNotifications() ships in Chrome/Firefox/Edge + Safari 16+.
  // Older Safari/iOS don't support web push at all, so the optional
  // chain on navigator.serviceWorker handles them gracefully.
  useEffect(() => {
    const clearPush = () => {
      if (document.visibilityState !== "visible") return;
      navigator.serviceWorker?.ready
        .then((reg) => reg.getNotifications())
        .then((ns) => ns.forEach((n) => n.close()))
        .catch(() => {});
    };
    clearPush();
    document.addEventListener("visibilitychange", clearPush);
    return () =>
      document.removeEventListener("visibilitychange", clearPush);
  }, []);

  const baseState = useNotifications(userId);
  const notificationsState = {
    ...baseState,
    activeSubscribedPortfolioIds,
  };
  const { unreadCount } = notificationsState;

  // Sync unread count to the PWA app icon badge. setAppBadge/clearAppBadge
  // are non-standard (Chromium + iOS Safari PWA), so type-assert locally
  // rather than augmenting the global Navigator type.
  useEffect(() => {
    const nav = navigator as Navigator & {
      setAppBadge?: (count: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (typeof nav.setAppBadge !== "function") return;
    if (unreadCount > 0) {
      nav.setAppBadge(unreadCount).catch(() => {});
    } else {
      nav.clearAppBadge?.().catch(() => {});
    }
  }, [unreadCount]);

  return (
    <NotificationsProvider value={notificationsState}>
      <div className="min-h-screen pb-32 md:pb-0">
      {/* Top nav — all sizes */}
      <nav className="sticky top-0 z-30 backdrop-blur-xl bg-[color:var(--dopl-deep)]/65 border-b border-[color:var(--glass-border)]">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center gap-6">
          <Link
            href="/"
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
                <NavLink
                  key={item.href}
                  href={item.href}
                  prefetch
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
                </NavLink>
              );
            })}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div>
              <NotificationBell
                userId={userId}
                brokerPreference={brokerPreference}
              />
            </div>
            <Link
              href="/me"
              aria-label="your subscriptions + profile"
              className={`hidden md:inline-flex items-center justify-center w-9 h-9 rounded-full transition-colors ${
                pathname === "/me"
                  ? "bg-[color:var(--dopl-lime)]/12 text-[color:var(--dopl-lime)]"
                  : "text-[color:var(--dopl-cream)]/60 hover:text-[color:var(--dopl-cream)] hover:bg-[color:var(--dopl-sage)]/25"
              }`}
            >
              <User size={18} strokeWidth={1.8} />
            </Link>
            <NotificationToastListener userId={userId} />
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
                <NavLink
                  key={item.href}
                  href={item.href}
                  prefetch
                  className="relative flex flex-col items-center justify-center flex-1 py-2 min-h-[44px]"
                >
                  <div className="relative">
                    <item.icon
                      size={20}
                      strokeWidth={active ? 2.2 : 1.6}
                      className={
                        active
                          ? "text-[color:var(--dopl-lime)]"
                          : "text-[color:var(--dopl-cream)]/60"
                      }
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
                </NavLink>
              );
            })}
          </div>
        </div>
      </nav>
      <PushPrompt />
      </div>
    </NotificationsProvider>
  );
}
