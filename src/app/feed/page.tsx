import { createServerSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import DoplerShell from "@/components/dopler-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { PositionCard, type PositionLike } from "@/components/ui/position-card";

export default async function FeedPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: subs } = await supabase
    .from("subscriptions")
    .select(
      "id, status, price_cents, portfolio:portfolios(id, name, description, tier, fund_manager_id), fund_manager:fund_managers(handle, display_name, avatar_url)"
    )
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  // Grab all positions for all subscribed portfolios.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const portfolioIds = (subs ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((s: any) => s.portfolio?.id)
    .filter(Boolean);

  const { data: positions } = portfolioIds.length
    ? await supabase
        .from("positions")
        .select(
          "id, portfolio_id, ticker, name, allocation_pct, current_price, gain_loss_pct, shares, market_value"
        )
        .in("portfolio_id", portfolioIds)
        .order("market_value", { ascending: false })
    : { data: [] };

  const positionsByPortfolio = new Map<string, PositionLike[]>();
  for (const p of positions ?? []) {
    const list = positionsByPortfolio.get(p.portfolio_id) ?? [];
    list.push(p);
    positionsByPortfolio.set(p.portfolio_id, list);
  }

  return (
    <DoplerShell>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight mb-2">
          your feed
        </h1>
        <p className="text-[color:var(--dopl-cream)]/50 text-sm mb-10">
          live positions from everyone you&apos;re dopling
        </p>

        {!subs || subs.length === 0 ? (
          <GlassCard className="p-12 text-center max-w-lg mx-auto">
            <p className="text-[color:var(--dopl-cream)]/60 mb-6">
              you haven&apos;t dopled anyone yet
            </p>
            <Link
              href="/leaderboard"
              className="btn-lime text-sm px-6 py-2.5 inline-block"
            >
              find a fund manager →
            </Link>
          </GlassCard>
        ) : (
          <div className="space-y-10">
            {subs.map((s) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const p = (s as any).portfolio;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const fm = (s as any).fund_manager;
              if (!p) return null;
              const items = positionsByPortfolio.get(p.id) ?? [];
              return (
                <section key={s.id}>
                  {/* Section header: FM + portfolio name */}
                  <div className="flex items-center gap-4 mb-5">
                    <Link
                      href={`/${fm?.handle}`}
                      className="flex items-center gap-3 group"
                    >
                      <div className="w-11 h-11 rounded-xl overflow-hidden bg-[color:var(--dopl-sage)] flex items-center justify-center">
                        {fm?.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={fm.avatar_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="font-display text-base text-[color:var(--dopl-lime)]">
                            {fm?.display_name?.[0]?.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold group-hover:text-[color:var(--dopl-lime)] transition-colors">
                          {fm?.display_name}
                        </p>
                        <p className="text-xs font-mono text-[color:var(--dopl-cream)]/40">
                          @{fm?.handle}
                        </p>
                      </div>
                    </Link>
                    <span className="ml-auto flex items-center gap-2">
                      <span
                        className={`text-[10px] font-mono font-semibold px-2 py-1 rounded uppercase tracking-wider ${
                          p.tier === "free"
                            ? "bg-[color:var(--dopl-sage)]/40 text-[color:var(--dopl-cream)]/70"
                            : p.tier === "vip"
                            ? "bg-[color:var(--dopl-lime)]/15 text-[color:var(--dopl-lime)]"
                            : "bg-[color:var(--dopl-sage)]/30 text-[color:var(--dopl-cream)]/80"
                        }`}
                      >
                        {p.tier}
                      </span>
                      <Link
                        href={`/feed/${p.id}`}
                        className="text-xs text-[color:var(--dopl-lime)] hover:underline"
                      >
                        open
                      </Link>
                    </span>
                  </div>

                  <h3 className="font-display text-xl font-semibold mb-4">
                    {p.name}
                  </h3>

                  {items.length === 0 ? (
                    <GlassCard className="p-6 text-center">
                      <p className="text-sm text-[color:var(--dopl-cream)]/40">
                        no positions yet
                      </p>
                    </GlassCard>
                  ) : (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {items.slice(0, 6).map((pos, i) => (
                        <PositionCard
                          key={pos.id}
                          position={pos}
                          floatIndex={i}
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </DoplerShell>
  );
}
