import { createServerSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import DoplerShell from "@/components/dopler-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { PositionCard, type PositionLike } from "@/components/ui/position-card";

type PortfolioSub = {
  sub_id: string;
  portfolio_id: string;
  portfolio_name: string;
  portfolio_description: string | null;
  portfolio_tier: string;
  fund_manager_id: string;
  fm_handle: string | null;
  fm_display_name: string | null;
  fm_avatar_url: string | null;
};

export default async function FeedPage() {
  const supabase = await createServerSupabase();

  let user: { id: string } | null = null;
  try {
    const res = await supabase.auth.getUser();
    user = res.data.user ?? null;
  } catch (e) {
    console.error("[feed] getUser failed:", e);
  }
  if (!user) redirect("/login");

  // 1) Simple subscription query — just scalar columns, no joins. This can't
  //    return weird nested shapes.
  let subRows: {
    id: string;
    portfolio_id: string;
    fund_manager_id: string;
  }[] = [];
  try {
    const { data } = await supabase
      .from("subscriptions")
      .select("id, portfolio_id, fund_manager_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false });
    subRows = data ?? [];
  } catch (e) {
    console.error("[feed] subscriptions query failed:", e);
  }

  // 2) Fetch portfolio + fund_manager metadata in two parallel, flat queries.
  const portfolioIds = Array.from(new Set(subRows.map((s) => s.portfolio_id)));
  const fmIds = Array.from(new Set(subRows.map((s) => s.fund_manager_id)));

  let portfolioMap = new Map<
    string,
    {
      id: string;
      name: string;
      description: string | null;
      tier: string;
      fund_manager_id: string;
    }
  >();
  let fmMap = new Map<
    string,
    { id: string; handle: string; display_name: string; avatar_url: string | null }
  >();

  if (portfolioIds.length) {
    try {
      const { data } = await supabase
        .from("portfolios")
        .select("id, name, description, tier, fund_manager_id")
        .in("id", portfolioIds);
      portfolioMap = new Map((data ?? []).map((p) => [p.id, p]));
    } catch (e) {
      console.error("[feed] portfolios query failed:", e);
    }
  }
  if (fmIds.length) {
    try {
      const { data } = await supabase
        .from("fund_managers")
        .select("id, handle, display_name, avatar_url")
        .in("id", fmIds);
      fmMap = new Map((data ?? []).map((f) => [f.id, f]));
    } catch (e) {
      console.error("[feed] fund_managers query failed:", e);
    }
  }

  // 3) Positions across all subscribed portfolios.
  type PositionWithPortfolio = PositionLike & { portfolio_id: string };
  let positions: PositionWithPortfolio[] = [];
  if (portfolioIds.length) {
    try {
      const { data } = await supabase
        .from("positions")
        .select(
          "id, portfolio_id, ticker, name, allocation_pct, current_price, gain_loss_pct, shares, market_value"
        )
        .in("portfolio_id", portfolioIds)
        .order("market_value", { ascending: false });
      positions = (data as PositionWithPortfolio[]) ?? [];
    } catch (e) {
      console.error("[feed] positions query failed:", e);
    }
  }

  const positionsByPortfolio = new Map<string, PositionLike[]>();
  for (const p of positions) {
    const list = positionsByPortfolio.get(p.portfolio_id) ?? [];
    list.push(p);
    positionsByPortfolio.set(p.portfolio_id, list);
  }

  // Compose final rows, skipping anything whose portfolio/fm was missing.
  const subs: PortfolioSub[] = subRows.flatMap((s) => {
    const p = portfolioMap.get(s.portfolio_id);
    const fm = fmMap.get(s.fund_manager_id);
    if (!p) return [];
    return [
      {
        sub_id: s.id,
        portfolio_id: p.id,
        portfolio_name: p.name,
        portfolio_description: p.description,
        portfolio_tier: p.tier,
        fund_manager_id: p.fund_manager_id,
        fm_handle: fm?.handle ?? null,
        fm_display_name: fm?.display_name ?? null,
        fm_avatar_url: fm?.avatar_url ?? null,
      },
    ];
  });

  return (
    <DoplerShell>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight mb-2">
          your feed
        </h1>
        <p className="text-[color:var(--dopl-cream)]/50 text-sm mb-10">
          live positions from everyone you&apos;re dopling
        </p>

        {subs.length === 0 ? (
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
              const items = positionsByPortfolio.get(s.portfolio_id) ?? [];
              return (
                <section key={s.sub_id}>
                  <div className="flex items-center gap-4 mb-5">
                    <Link
                      href={s.fm_handle ? `/${s.fm_handle}` : "#"}
                      className="flex items-center gap-3 group"
                    >
                      <div className="w-11 h-11 rounded-xl overflow-hidden bg-[color:var(--dopl-sage)] flex items-center justify-center">
                        {s.fm_avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={s.fm_avatar_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="font-display text-base text-[color:var(--dopl-lime)]">
                            {(s.fm_display_name ?? "?")[0]?.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold group-hover:text-[color:var(--dopl-lime)] transition-colors">
                          {s.fm_display_name ?? "unknown"}
                        </p>
                        <p className="text-xs font-mono text-[color:var(--dopl-cream)]/40">
                          @{s.fm_handle ?? "—"}
                        </p>
                      </div>
                    </Link>
                    <span className="ml-auto flex items-center gap-2">
                      <span
                        className={`text-[10px] font-mono font-semibold px-2 py-1 rounded uppercase tracking-wider ${
                          s.portfolio_tier === "free"
                            ? "bg-[color:var(--dopl-sage)]/40 text-[color:var(--dopl-cream)]/70"
                            : s.portfolio_tier === "vip"
                            ? "bg-[color:var(--dopl-lime)]/15 text-[color:var(--dopl-lime)]"
                            : "bg-[color:var(--dopl-sage)]/30 text-[color:var(--dopl-cream)]/80"
                        }`}
                      >
                        {s.portfolio_tier}
                      </span>
                      <Link
                        href={`/feed/${s.portfolio_id}`}
                        className="text-xs text-[color:var(--dopl-lime)] hover:underline"
                      >
                        open
                      </Link>
                    </span>
                  </div>

                  <h3 className="font-display text-xl font-semibold mb-4">
                    {s.portfolio_name}
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
