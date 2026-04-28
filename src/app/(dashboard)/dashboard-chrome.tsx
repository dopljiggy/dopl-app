"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  Link2,
  CreditCard,
  User,
  Share2,
  TrendingUp,
  Home,
  Settings,
} from "lucide-react";
import { motion } from "framer-motion";
import PageTransition from "@/components/ui/page-transition";
import SignOutLink from "@/components/sign-out-link";
import { NavLink } from "@/components/ui/nav-link";
import { FmNotificationsProvider } from "@/components/fm-notifications-context";
import { useFmNotifications } from "@/hooks/use-fm-notifications";
import FmNotificationBell from "@/components/ui/fm-notification-bell";

const sideNav = [
  { href: "/dashboard", icon: LayoutDashboard, label: "overview" },
  { href: "/dashboard/portfolios", icon: Briefcase, label: "portfolios" },
  { href: "/dashboard/positions", icon: TrendingUp, label: "positions" },
  { href: "/dashboard/connect", icon: Link2, label: "broker" },
  { href: "/dashboard/billing", icon: CreditCard, label: "billing" },
  { href: "/dashboard/profile", icon: User, label: "profile" },
  { href: "/dashboard/share", icon: Share2, label: "share" },
];

const bottomNav = [
  { href: "/dashboard", icon: Home, label: "home" },
  { href: "/dashboard/portfolios", icon: Briefcase, label: "portfolios" },
  { href: "/dashboard/share", icon: Share2, label: "share" },
  { href: "/dashboard/profile", icon: Settings, label: "settings" },
];

function DoplLogo() {
  return (
    <Link href="/" className="flex items-center gap-2 group" aria-label="dopl home">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/dopl-logo.svg"
        alt=""
        width={28}
        height={28}
        className="rounded-lg"
      />
      <span className="font-display text-xl font-semibold tracking-tight">
        dopl
      </span>
    </Link>
  );
}

function SideNav() {
  const pathname = usePathname();
  return (
    <nav className="space-y-1">
      {sideNav.map((item) => {
        const active = pathname === item.href;
        return (
          <NavLink
            key={item.href}
            href={item.href}
            prefetch
            className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
              active
                ? "text-[color:var(--dopl-lime)]"
                : "text-[color:var(--dopl-cream)]/50 hover:text-[color:var(--dopl-cream)] hover:bg-[color:var(--dopl-sage)]/20"
            }`}
          >
            {active && (
              <motion.span
                layoutId="sidebar-active"
                className="absolute inset-0 rounded-xl bg-[color:var(--dopl-lime)]/10 border border-[color:var(--dopl-lime)]/20"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <span className="relative flex items-center gap-3">
              <item.icon size={18} />
              {item.label}
            </span>
          </NavLink>
        );
      })}
    </nav>
  );
}

function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto max-w-md px-3 pb-3">
        <div className="glass-card glass-card-strong flex items-center justify-around py-2 px-2 rounded-2xl">
          {bottomNav.map((item) => {
            const active =
              pathname === item.href ||
              (item.href === "/dashboard/profile" &&
                pathname.startsWith("/dashboard/profile"));
            return (
              <NavLink
                key={item.href}
                href={item.href}
                prefetch
                className="relative flex flex-col items-center justify-center flex-1 py-2 min-h-[44px]"
              >
                <item.icon
                  size={20}
                  strokeWidth={active ? 2.2 : 1.6}
                  className={
                    active
                      ? "text-[color:var(--dopl-lime)]"
                      : "text-[color:var(--dopl-cream)]/60"
                  }
                />
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
          {/* Sprint 5's 5th "activity" slot was reverted in Sprint 6 —
              the layout (4 labeled tabs + a button-not-link 5th slot)
              cramped the labels and left the bell visually isolated on
              the right. Mobile FMs reach /fund-manager/activity via the
              dashboard sidebar or in-content links instead. */}
        </div>
      </div>
    </nav>
  );
}

export default function DashboardChrome({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  const fmNotificationsValue = useFmNotifications(userId);
  return (
    <FmNotificationsProvider value={fmNotificationsValue}>
      <div className="min-h-screen flex">
        <aside className="w-64 border-r border-[color:var(--glass-border)] p-6 hidden md:flex md:flex-col sticky top-0 h-screen overflow-y-auto">
          <div className="mb-10">
            <DoplLogo />
          </div>
          <SideNav />
          <div className="mt-auto pt-6 border-t border-[color:var(--glass-border)]">
            <SignOutLink />
          </div>
        </aside>

        <main className="flex-1 p-5 md:p-10 pb-36 md:pb-10 min-w-0 max-w-[1200px] mx-auto w-full">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3 md:hidden">
              <DoplLogo />
            </div>
            <div className="ml-auto">
              <FmNotificationBell anchor="top" />
            </div>
          </div>
          <PageTransition>{children}</PageTransition>
        </main>

        <BottomNav />
      </div>
    </FmNotificationsProvider>
  );
}
