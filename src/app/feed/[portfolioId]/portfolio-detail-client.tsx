"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import { PositionCard, type PositionLike } from "@/components/ui/position-card";
import SlideToDopl from "@/components/ui/slide-to-dopl";
import { GlassCard } from "@/components/ui/glass-card";
import { fireToast } from "@/components/ui/toast";
import { resolveFm } from "@/lib/fm-resolver";
import type { Portfolio, PortfolioUpdate } from "@/types/database";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PortfolioWithFm = Portfolio & { fund_manager: any };

export default function PortfolioDetailClient(props: {
  portfolio: PortfolioWithFm;
  positions: PositionLike[];
  updates: PortfolioUpdate[];
  canView: boolean;
  portfolioId: string;
  fmStripeOnboarded?: boolean;
}) {
  return (
    <Suspense fallback={null}>
      <Inner {...props} />
    </Suspense>
  );
}

function Inner({
  portfolio,
  positions,
  updates,
  canView,
  portfolioId,
  fmStripeOnboarded = false,
}: {
  portfolio: PortfolioWithFm;
  positions: PositionLike[];
  updates: PortfolioUpdate[];
  canView: boolean;
  portfolioId: string;
  fmStripeOnboarded?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  // resolveFm gives a guaranteed display_name (falls back to "unknown" or
  // an id-stub handle), nullable handle/avatar_url. Necessary now that
  // the page query uses a LEFT JOIN — fund_manager can be null.
  const fm = resolveFm(
    portfolio.fund_manager,
    null,
    portfolio.fund_manager_id
  );

  // Show a success toast when returning from Stripe checkout.
  useEffect(() => {
    if (params.get("subscribed") === "true") {
      fireToast({
        title: `you're now dopling ${fm.display_name}`,
        body: `${portfolio.name} — positions unlocked`,
        avatarLetter: fm.display_name?.[0],
      });
      const url = new URL(window.location.href);
      url.searchParams.delete("subscribed");
      window.history.replaceState({}, "", url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [pulsingIds, setPulsingIds] = useState<Set<string>>(new Set());
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!canView) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`portfolio-${portfolioId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "positions",
          filter: `portfolio_id=eq.${portfolioId}`,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const row = payload.new ?? payload.old;
          if (row?.id) {
            setPulsingIds((prev) => new Set([...prev, row.id]));
            setTimeout(() => {
              setPulsingIds((prev) => {
                const next = new Set(prev);
                next.delete(row.id);
                return next;
              });
            }, 1200);
          }
          if (refreshTimer.current) clearTimeout(refreshTimer.current);
          refreshTimer.current = setTimeout(() => router.refresh(), 600);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "portfolio_updates",
          filter: `portfolio_id=eq.${portfolioId}`,
        },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [portfolioId, canView, router]);

  const handleSubscribe = async () => {
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portfolioId }),
    });
    const { url, error } = await res.json();
    if (url) {
      window.location.href = url;
      return;
    }
    fireToast({ title: "couldn't start checkout", body: error ?? "" });
  };

  const displayPositions: PositionLike[] = canView
    ? positions
    : Array.from({ length: 6 }).map((_, i) => ({
        id: `blur-${i}`,
        ticker: "ABCD",
        name: "Hidden Holding",
        allocation_pct: 20 - i * 2,
        current_price: 100,
        gain_loss_pct: 5,
        shares: 10,
        market_value: 1000,
      }));

  return (
    <div className="max-w-5xl mx-auto px-6 pb-20">
      <GlassCard className="p-6 md:p-8 mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          {(() => {
            const inner = (
              <>
                <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-[color:var(--dopl-sage)] flex-shrink-0">
                  {fm.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={fm.avatar_url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-display text-xl text-[color:var(--dopl-lime)]">
                      {fm.display_name?.[0]}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold group-hover:text-[color:var(--dopl-lime)] transition-colors">
                    {fm.display_name}
                  </p>
                  {fm.handle && (
                    <p className="text-xs text-[color:var(--dopl-cream)]/40 font-mono">
                      @{fm.handle}
                    </p>
                  )}
                </div>
              </>
            );
            // Link to the FM profile only when we have a handle. With
            // the LEFT JOIN, an orphaned portfolio gets the resolveFm
            // id-stub handle (e.g. fm_abc123), which doesn't route to a
            // real /[handle] page — render the chrome but not as a link.
            return fm.handle ? (
              <Link
                href={`/${fm.handle}`}
                className="flex items-center gap-4 group"
              >
                {inner}
              </Link>
            ) : (
              <div className="flex items-center gap-4 group">{inner}</div>
            );
          })()}
          <div className="md:ml-auto flex items-baseline gap-3">
            <span
              className={`text-[10px] font-mono font-semibold px-2 py-1 rounded tracking-wider uppercase ${
                portfolio.tier === "free"
                  ? "bg-[color:var(--dopl-lime)]/15 text-[color:var(--dopl-lime)]"
                  : portfolio.tier === "vip"
                  ? "bg-[color:var(--dopl-lime)]/20 text-[color:var(--dopl-lime)]"
                  : "bg-[color:var(--dopl-sage)]/40 text-[color:var(--dopl-cream)]/80"
              }`}
            >
              {portfolio.tier}
            </span>
            <span className="font-mono text-2xl font-bold text-[color:var(--dopl-lime)]">
              {portfolio.price_cents === 0
                ? "free"
                : `$${(portfolio.price_cents / 100).toFixed(0)}/mo`}
            </span>
          </div>
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-semibold mt-6 tracking-tight">
          {portfolio.name}
        </h1>
        {portfolio.description && (
          <p className="text-[color:var(--dopl-cream)]/65 text-sm md:text-base mt-3 max-w-2xl">
            {portfolio.description}
          </p>
        )}
      </GlassCard>

      {!canView && (
        <GlassCard className="p-8 mb-6 text-center" glow="gain">
          <p className="font-display text-xl font-semibold mb-2">
            dopl {fm.display_name} to see live positions
          </p>
          <p className="text-[color:var(--dopl-cream)]/55 text-sm mb-6 max-w-md mx-auto">
            real-time tickers, allocations, and instant alerts when they trade.
          </p>
          {portfolio.price_cents > 0 && !fmStripeOnboarded ? (
            <div className="glass-card-light p-6 text-center rounded-xl max-w-sm mx-auto">
              <p className="text-sm text-[color:var(--dopl-cream)]/60">
                this fund manager is finalizing setup.
              </p>
              <p className="text-xs text-[color:var(--dopl-cream)]/40 mt-1">
                check back soon.
              </p>
            </div>
          ) : (
            <div className="max-w-sm mx-auto">
              <SlideToDopl
                label={`slide to dopl · $${(portfolio.price_cents / 100).toFixed(0)}/mo`}
                completedLabel="redirecting..."
                onComplete={handleSubscribe}
              />
            </div>
          )}
        </GlassCard>
      )}

      <section className="mb-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl font-semibold">positions</h2>
          <span className="text-xs text-[color:var(--dopl-cream)]/40 font-mono uppercase tracking-wider">
            {canView ? displayPositions.length : "—"} holdings
          </span>
        </div>

        {displayPositions.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <p className="text-sm text-[color:var(--dopl-cream)]/40">
              no positions yet
            </p>
          </GlassCard>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayPositions.map((p, i) => (
              <PositionCard
                key={p.id}
                position={p}
                locked={!canView}
                floatIndex={i}
                pulsing={pulsingIds.has(p.id)}
              />
            ))}
          </div>
        )}
      </section>

      {updates && updates.length > 0 && (
        <section>
          <h2 className="font-display text-xl font-semibold mb-4">activity</h2>
          <div className="space-y-2">
            {updates.map((u, i) => (
              <motion.div
                key={u.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="glass-card-light p-4 flex items-start gap-3"
              >
                <span className="w-2 h-2 rounded-full bg-[color:var(--dopl-lime)] mt-1.5 flex-shrink-0" />
                <div className="flex-1 text-sm">
                  <p className="text-[color:var(--dopl-cream)]/85">
                    {u.description}
                  </p>
                  {u.thesis_note && (
                    <p className="text-xs text-[color:var(--dopl-cream)]/50 mt-1 italic">
                      “{u.thesis_note}”
                    </p>
                  )}
                </div>
                <span className="text-xs text-[color:var(--dopl-cream)]/30 font-mono">
                  {new Date(u.created_at).toLocaleDateString()}
                </span>
              </motion.div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
