import { createServerSupabase } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import Link from "next/link";
import ProfileHero from "./profile-hero";
import ProfileTiers from "./profile-tiers";

export default async function FundManagerProfile({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const supabase = await createServerSupabase();

  const { data: fm } = await supabase
    .from("fund_managers")
    .select("*")
    .eq("handle", handle)
    .single();

  if (!fm) return notFound();

  const { data: portfolios } = await supabase
    .from("portfolios")
    .select("*")
    .eq("fund_manager_id", fm.id)
    .eq("is_active", true)
    .order("price_cents", { ascending: true });

  // Fetch position counts so we can show a blurred preview count per tier.
  const portfolioIds = (portfolios ?? []).map((p) => p.id);
  const { data: positions } = portfolioIds.length
    ? await supabase
        .from("positions")
        .select("portfolio_id, ticker, allocation_pct")
        .in("portfolio_id", portfolioIds)
    : { data: [] };

  const positionStats = new Map<
    string,
    { count: number; topTickers: string[] }
  >();
  for (const p of positions ?? []) {
    const s = positionStats.get(p.portfolio_id) ?? { count: 0, topTickers: [] };
    s.count += 1;
    if (s.topTickers.length < 4) s.topTickers.push(p.ticker);
    positionStats.set(p.portfolio_id, s);
  }

  return (
    <main className="min-h-screen">
      {/* Hero with parallax banner */}
      <ProfileHero
        bannerUrl={fm.banner_url}
        avatarUrl={fm.avatar_url}
        displayName={fm.display_name}
        handle={fm.handle}
        bio={fm.bio}
        subscriberCount={fm.subscriber_count}
        links={Array.isArray(fm.links) ? fm.links : []}
      />

      {/* Tier grid */}
      <div className="max-w-5xl mx-auto px-6 pb-24 pt-4">
        {portfolios && portfolios.length > 0 ? (
          <>
            <div className="flex items-baseline justify-between mb-6">
              <h2 className="font-display text-2xl font-semibold">portfolios</h2>
              <span className="text-xs font-mono text-[color:var(--dopl-cream)]/40 uppercase tracking-wider">
                {portfolios.length} tier{portfolios.length === 1 ? "" : "s"}
              </span>
            </div>
            <ProfileTiers
              portfolios={portfolios.map((p) => ({
                ...p,
                position_count: positionStats.get(p.id)?.count ?? 0,
                preview_tickers: positionStats.get(p.id)?.topTickers ?? [],
              }))}
              handle={fm.handle}
            />
          </>
        ) : (
          <div className="glass-card p-12 text-center">
            <p className="text-[color:var(--dopl-cream)]/50">
              {fm.display_name} hasn&apos;t published portfolios yet.
            </p>
          </div>
        )}
      </div>

      {/* Powered by dopl */}
      <footer className="pb-10 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card-light text-xs text-[color:var(--dopl-cream)]/50 hover:text-[color:var(--dopl-cream)] transition-colors"
        >
          <span className="font-mono">powered by</span>
          <span className="font-display font-semibold text-[color:var(--dopl-lime)]">
            dopl
          </span>
        </Link>
      </footer>
    </main>
  );
}
