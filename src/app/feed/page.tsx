import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { redirect } from "next/navigation";
import Link from "next/link";
import DoplerShell from "@/components/dopler-shell";
import { GlassCard } from "@/components/ui/glass-card";
import { type PositionLike } from "@/components/ui/position-card";
import FeedSections from "./feed-sections";
import { resolveFm } from "@/lib/fm-resolver";

type FundManagerRow = {
  id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  subscriber_count: number | null;
};

type PortfolioRow = {
  id: string;
  name: string;
  description: string | null;
  tier: string;
  fund_manager_id: string;
};

type PositionRow = PositionLike & { portfolio_id: string };

type SubscriptionRow = {
  id: string;
  portfolio_id: string;
  fund_manager_id: string;
  portfolio: PortfolioRow | null;
};

export default async function FeedPage() {
  // Auth via cookie-based client.
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Service role: bypass RLS so joins on fund_managers always resolve.
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1) subscriptions + portfolio in one go.
  const { data: subsData } = await admin
    .from("subscriptions")
    .select(
      "id, portfolio_id, fund_manager_id, portfolio:portfolios(id, name, description, tier, fund_manager_id)"
    )
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const subs = (subsData ?? []) as unknown as SubscriptionRow[];

  // 2) fund managers by id. Use both subscriptions.fund_manager_id and the
  //    nested portfolio.fund_manager_id as sources — covers the case where
  //    an older subscription row has an unexpected fund_manager_id.
  const fmIds = Array.from(
    new Set(
      subs.flatMap((s) =>
        [s.fund_manager_id, s.portfolio?.fund_manager_id].filter(
          (id): id is string => typeof id === "string" && id.length > 0
        )
      )
    )
  );
  const fmMap = new Map<string, FundManagerRow>();
  if (fmIds.length) {
    const { data: fmRows } = await admin
      .from("fund_managers")
      .select(
        "id, handle, display_name, avatar_url, bio, subscriber_count, broker_provider"
      )
      .in("id", fmIds);
    for (const row of (fmRows ?? []) as FundManagerRow[]) {
      fmMap.set(row.id, row);
    }
  }

  // 2b) Backstop: if any fund_manager is missing or has a blank display_name,
  //     look them up in profiles for `full_name` / `email`. This catches
  //     fund managers whose fund_managers row hasn't been provisioned yet
  //     (ensure runs on the share page).
  const profileMap = new Map<
    string,
    { full_name: string | null; email: string | null }
  >();
  if (fmIds.length) {
    const { data: profileRows } = await admin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", fmIds);
    for (const row of profileRows ?? []) {
      profileMap.set(
        (row as { id: string }).id,
        {
          full_name: (row as { full_name: string | null }).full_name,
          email: (row as { email: string | null }).email,
        }
      );
    }
  }

  const resolveFmById = (id: string) =>
    resolveFm(
      fmMap.get(id) as (FundManagerRow & { broker_provider?: string | null }) | undefined,
      profileMap.get(id)
    );

  // 3) positions for every subscribed portfolio.
  const portfolioIds = subs.map((s) => s.portfolio_id);
  const positionsByPortfolio = new Map<string, PositionLike[]>();
  if (portfolioIds.length) {
    const { data: posRows } = await admin
      .from("positions")
      .select(
        "id, portfolio_id, ticker, name, allocation_pct, current_price, gain_loss_pct, shares, market_value"
      )
      .in("portfolio_id", portfolioIds)
      .order("market_value", { ascending: false });
    for (const p of (posRows ?? []) as PositionRow[]) {
      const list = positionsByPortfolio.get(p.portfolio_id) ?? [];
      list.push(p);
      positionsByPortfolio.set(p.portfolio_id, list);
    }
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
            <FeedSections
              initial={subs.flatMap((s) => {
                if (!s.portfolio) return [];
                // Portfolio.fund_manager_id is authoritative; fall back to
                // subscriptions.fund_manager_id only if the nested row is
                // missing for some reason.
                const fmId =
                  s.portfolio.fund_manager_id || s.fund_manager_id;
                const fm = resolveFmById(fmId);
                return [
                  {
                    sub_id: s.id,
                    portfolio_id: s.portfolio.id,
                    portfolio_name: s.portfolio.name,
                    portfolio_description: s.portfolio.description,
                    portfolio_tier: s.portfolio.tier,
                    fm_handle: fm.handle,
                    fm_display_name: fm.display_name,
                    fm_avatar_url: fm.avatar_url,
                    fm_broker_provider: fm.broker_provider,
                    positions: positionsByPortfolio.get(s.portfolio_id) ?? [],
                  },
                ];
              })}
            />
          </div>
        )}
      </div>
    </DoplerShell>
  );
}
