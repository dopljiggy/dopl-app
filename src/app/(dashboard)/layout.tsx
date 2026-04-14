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
  Bell,
  TrendingUp,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PageTransition from "@/components/ui/page-transition";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "overview" },
  { href: "/dashboard/portfolios", icon: Briefcase, label: "portfolios" },
  { href: "/dashboard/positions", icon: TrendingUp, label: "positions" },
  { href: "/dashboard/connect", icon: Link2, label: "broker" },
  { href: "/dashboard/billing", icon: CreditCard, label: "billing" },
  { href: "/dashboard/profile", icon: User, label: "profile" },
  { href: "/dashboard/share", icon: Share2, label: "share" },
];

function NavList({ onClick }: { onClick?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-1">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClick}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              isActive
                ? "bg-dopl-lime/10 text-dopl-lime"
                : "text-dopl-cream/50 hover:text-dopl-cream hover:bg-dopl-sage/20"
            }`}
          >
            <item.icon size={18} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [drawer, setDrawer] = useState(false);

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <aside className="w-64 border-r border-dopl-sage/20 p-6 hidden md:block">
        <Link href="/" className="font-display text-2xl font-semibold mb-10 block">
          dopl
        </Link>
        <NavList />
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 md:hidden bg-black/60 backdrop-blur-sm"
            onClick={() => setDrawer(false)}
          >
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.2 }}
              className="absolute left-0 top-0 bottom-0 w-72 bg-dopl-deep border-r border-dopl-sage/20 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-10">
                <Link
                  href="/"
                  className="font-display text-2xl font-semibold"
                  onClick={() => setDrawer(false)}
                >
                  dopl
                </Link>
                <button
                  onClick={() => setDrawer(false)}
                  className="text-dopl-cream/50 hover:text-dopl-cream"
                >
                  <X size={20} />
                </button>
              </div>
              <NavList onClick={() => setDrawer(false)} />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="flex-1 p-5 md:p-10 min-w-0">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3 md:hidden">
            <button
              onClick={() => setDrawer(true)}
              className="text-dopl-cream/70 hover:text-dopl-cream"
              aria-label="open menu"
            >
              <Menu size={22} />
            </button>
            <span className="font-display text-xl font-semibold">dopl</span>
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <Link
              href="/notifications"
              className="relative p-2 text-dopl-cream/50 hover:text-dopl-cream transition-colors"
              aria-label="notifications"
            >
              <Bell size={20} />
            </Link>
          </div>
        </div>
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
