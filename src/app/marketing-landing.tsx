"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { UserChip } from "@/components/ui/user-chip";

export type Viewer = {
  handle: string | null;
  displayName: string | null;
  role: "fund_manager" | "subscriber";
} | null;

export default function MarketingLanding({ viewer }: { viewer: Viewer }) {
  // Signal the StandaloneSplash that the marketing landing has mounted.
  // Same pattern as DoplerShell + DashboardChrome — set global flag
  // BEFORE dispatching so the splash can check synchronously.
  useEffect(() => {
    (window as Window & typeof globalThis & { __doplContentReady?: boolean }).__doplContentReady = true;
    window.dispatchEvent(new Event("dopl:content-ready"));
  }, []);

  const onSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <main className="min-h-screen">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/dopl-logo.svg"
            alt=""
            width={32}
            height={32}
            className="rounded-lg"
          />
          <span className="font-display text-2xl font-semibold tracking-tight text-dopl-cream">
            dopl
          </span>
        </Link>
        {viewer ? (
          <UserChip
            handle={viewer.handle}
            displayName={viewer.displayName}
            role={viewer.role}
            onSignOut={onSignOut}
          />
        ) : (
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm text-dopl-cream/60 hover:text-dopl-cream transition-colors"
            >
              Log In
            </Link>
            <Link href="/signup" className="btn-lime text-sm px-5 py-2.5">
              Get Started
            </Link>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <h1 className="font-display text-5xl md:text-7xl font-semibold leading-[1.1] tracking-tight mb-10">
          your audience.{" "}
          <span className="text-dopl-lime">your fund.</span>{" "}
          your price.
        </h1>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {viewer?.role === "subscriber" ? (
            <>
              <Link href="/feed" className="btn-lime text-base px-8 py-3.5">
                Your Feed
              </Link>
              <CtaSecondary href="/leaderboard" label="See Fund Managers" />
            </>
          ) : viewer?.role === "fund_manager" ? (
            <>
              <Link href="/dashboard" className="btn-lime text-base px-8 py-3.5">
                Your Dashboard
              </Link>
              <CtaSecondary href="/leaderboard" label="See Fund Managers" />
            </>
          ) : (
            <>
              <Link href="/signup" className="btn-lime text-base px-8 py-3.5">
                Launch Your Fund
              </Link>
              <CtaSecondary href="/leaderboard" label="See Fund Managers" />
            </>
          )}
        </div>
      </section>

      {/* Subtle gradient divider — separates hero from sections below */}
      <div
        className="h-px max-w-3xl mx-auto"
        style={{
          background:
            "linear-gradient(to right, transparent, rgba(197,214,52,0.25), transparent)",
        }}
      />

      {/* How it works */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <h2 className="font-display text-3xl font-semibold text-center mb-16">
          How It Works
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              step: "01",
              title: "Connect Your Broker",
              desc: "link your existing brokerage account. dopl reads your positions in real time. you keep trading normally.",
            },
            {
              step: "02",
              title: "Create Portfolio Tiers",
              desc: "set up free and paid portfolios. assign positions. set your price. dopl handles billing through Stripe.",
            },
            {
              step: "03",
              title: "Your Followers Subscribe",
              desc: "share your dopl link. followers pay to see your live portfolio. when you trade, they get notified instantly.",
            },
          ].map((item) => (
            <HowCard key={item.step} {...item} />
          ))}
        </div>
      </section>

      {/* Math section */}
      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <div className="glass-card p-12">
          <p className="text-dopl-cream/50 text-sm mb-2">the math</p>
          <p className="font-mono text-4xl md:text-5xl text-dopl-lime font-bold mb-4">
            200 doplers × $49/mo
          </p>
          <p className="font-mono text-2xl text-dopl-cream/80">
            = $9,800/mo in your pocket
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <h2 className="font-display text-3xl md:text-4xl font-semibold mb-4">
          Stop Giving Away Your Best Trades For Free
        </h2>
        <p className="text-dopl-cream/55 mb-8">
          your followers are already copying — manually, late, badly.
        </p>
        {viewer?.role === "subscriber" ? (
          <Link href="/feed" className="btn-lime text-base px-8 py-3.5 inline-block">
            Your Feed
          </Link>
        ) : viewer?.role === "fund_manager" ? (
          <Link href="/dashboard" className="btn-lime text-base px-8 py-3.5 inline-block">
            Your Dashboard
          </Link>
        ) : (
          <Link href="/signup" className="btn-lime text-base px-8 py-3.5 inline-block">
            Launch Your Fund
          </Link>
        )}
      </section>

      {/* Footer */}
      <footer
        className="px-6 pt-16 pb-10 mt-12 border-t"
        style={{
          borderColor: "rgba(197,214,52,0.18)",
        }}
      >
        <div className="max-w-6xl mx-auto flex flex-col items-center text-center md:flex-row md:items-end md:justify-between md:text-left gap-6">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/dopl-logo.svg"
              alt=""
              width={36}
              height={36}
              className="rounded-xl"
            />
            <div>
              <span className="font-display text-2xl font-semibold tracking-tight text-dopl-cream">
                dopl
              </span>
              <p className="text-xs text-dopl-cream/40 mt-0.5">
                infrastructure for fund managers
              </p>
            </div>
          </div>
          <div className="flex flex-col items-center md:items-end gap-2 text-xs">
            <div className="flex items-center gap-5 text-dopl-cream/40">
              <Link href="/" className="hover:text-dopl-cream transition-colors">
                Terms
              </Link>
              <Link href="/" className="hover:text-dopl-cream transition-colors">
                Privacy
              </Link>
              <Link href="/leaderboard" className="hover:text-dopl-cream transition-colors">
                Discover
              </Link>
            </div>
            <p className="text-dopl-cream/30 font-mono">© dopl 2026</p>
          </div>
        </div>
      </footer>
    </main>
  );
}

function CtaSecondary({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="group relative inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl text-base font-semibold text-dopl-cream/85 transition-all"
      style={{
        background:
          "linear-gradient(rgba(13,38,31,0.85), rgba(13,38,31,0.85)) padding-box, linear-gradient(135deg, rgba(197,214,52,0.45), rgba(45,74,62,0.55)) border-box",
        border: "1px solid transparent",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow =
          "0 0 0 1px rgba(197,214,52,0.25), 0 8px 32px -10px rgba(197,214,52,0.35)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "";
      }}
    >
      <span>{label}</span>
      <ArrowRight
        size={16}
        className="transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}

function HowCard({
  step,
  title,
  desc,
}: {
  step: string;
  title: string;
  desc: string;
}) {
  return (
    <div
      className="rounded-2xl p-8 transition-all hover:-translate-y-0.5"
      style={{
        background:
          "linear-gradient(rgba(13,38,31,0.6), rgba(13,38,31,0.6)) padding-box, linear-gradient(135deg, rgba(197,214,52,0.35), rgba(45,74,62,0.45)) border-box",
        border: "1px solid transparent",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow =
          "0 0 0 1px rgba(197,214,52,0.18), 0 12px 40px -16px rgba(197,214,52,0.28)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "";
      }}
    >
      <span className="font-mono text-dopl-lime text-sm font-semibold">
        {step}
      </span>
      <h3 className="font-display text-xl font-semibold mt-3 mb-3">{title}</h3>
      <p className="text-dopl-cream/55 text-sm leading-relaxed">{desc}</p>
    </div>
  );
}
