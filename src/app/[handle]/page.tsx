import { getCachedUser } from "@/lib/supabase-server";
import { notFound } from "next/navigation";
import Link from "next/link";
import ProfileHero from "./profile-hero";
import ProfileTiers from "./profile-tiers";
import DoplerShell from "@/components/dopler-shell";

// Reserve any paths that sit at the root alongside /[handle].
const RESERVED = new Set([
  "dashboard",
  "feed",
  "leaderboard",
  "login",
  "signup",
  "notifications",
  "onboarding",
  "welcome",
  "auth",
  "api",
  "favicon.ico",
]);

export default async function FundManagerProfile({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle: raw } = await params;
  const handle = decodeURIComponent(raw).toLowerCase();

  if (RESERVED.has(handle)) return notFound();

  const { supabase, user } = await getCachedUser();

  // Case-insensitive lookup so /Kai and /kai both resolve. Wrap in try/catch
  // so a transient Supabase error doesn't look like a 404 — show a graceful
  // error page instead.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fm: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fmErr: any = null;
  try {
    const result = await supabase
      .from("fund_managers")
      .select("*")
      .ilike("handle", handle)
      .maybeSingle();
    fm = result.data;
    fmErr = result.error;
  } catch (e) {
    fmErr = e;
  }

  if (fmErr) {
    console.error("[handle] fund_managers lookup failed:", fmErr);
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="glass-card p-10 max-w-md text-center">
          <h1 className="font-display text-2xl font-semibold mb-2">
            couldn&apos;t load this profile
          </h1>
          <p className="text-sm text-[color:var(--dopl-cream)]/55 mb-6">
            please try again in a moment.
          </p>
          <Link
            href="/leaderboard"
            className="btn-lime text-sm px-6 py-2.5 inline-block"
          >
            back to leaderboard
          </Link>
        </div>
      </main>
    );
  }
  if (!fm) return notFound();

  // Current user (used to check subscriptions for live gating).
  const isOwner = user?.id === fm.id;

  // Doplers browsing a public profile get the dopler shell wrapper so their
  // bell + settings are available — without it, realtime toasts flash once
  // and vanish with no way to retrieve the notification.
  let viewerIsDopler = false;
  if (user && !isOwner) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    viewerIsDopler = profile?.role === "subscriber";
  }

  const { data: portfolios } = await supabase
    .from("portfolios")
    .select("*")
    .eq("fund_manager_id", fm.id)
    .eq("is_active", true)
    .order("price_cents", { ascending: true });

  const portfolioIds = (portfolios ?? []).map((p) => p.id);

  // All positions across this FM's portfolios.
  const { data: positions } = portfolioIds.length
    ? await supabase
        .from("positions")
        .select(
          "id, portfolio_id, ticker, name, allocation_pct, current_price, gain_loss_pct, shares, market_value"
        )
        .in("portfolio_id", portfolioIds)
        .order("allocation_pct", { ascending: false })
    : { data: [] };

  // Current user's active subscriptions to this FM's portfolios.
  // Track both the portfolio_ids they're subscribed to AND the subscription_id
  // for each, so the undopl button on subscribed tiers has something to call.
  let subscribedPortfolioIds = new Set<string>();
  const subscriptionByPortfolio = new Map<string, string>();
  if (user && portfolioIds.length) {
    const { data: subs } = await supabase
      .from("subscriptions")
      .select("id, portfolio_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .in("portfolio_id", portfolioIds);
    for (const s of subs ?? []) {
      subscribedPortfolioIds.add(s.portfolio_id);
      subscriptionByPortfolio.set(s.portfolio_id, s.id);
    }
  }

  // Bucket positions per portfolio.
  const positionsByPortfolio = new Map<string, typeof positions>();
  for (const p of positions ?? []) {
    const list = positionsByPortfolio.get(p.portfolio_id) ?? [];
    list.push(p);
    positionsByPortfolio.set(p.portfolio_id, list);
  }

  const tierCards = (portfolios ?? []).map((p) => {
    const ps = positionsByPortfolio.get(p.id) ?? [];
    const isFree = p.tier === "free" || p.price_cents === 0;
    const isSubscribed = subscribedPortfolioIds.has(p.id);
    const canView = isFree || isSubscribed || isOwner;
    return {
      ...p,
      position_count: ps.length,
      preview_tickers: ps.slice(0, 5).map((x) => x.ticker),
      can_view: canView,
      is_subscribed: isSubscribed,
      is_owner: isOwner,
      subscription_id: subscriptionByPortfolio.get(p.id) ?? null,
      positions: canView ? ps : [],
    };
  });

  const body = (
    <main className="min-h-screen">
      <ProfileHero
        bannerUrl={fm.banner_url}
        avatarUrl={fm.avatar_url}
        displayName={fm.display_name}
        handle={fm.handle}
        bio={fm.bio}
        subscriberCount={fm.subscriber_count}
        portfolioCount={portfolios?.length ?? 0}
        links={Array.isArray(fm.links) ? fm.links : []}
      />

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
              tiers={tierCards}
              handle={fm.handle}
              displayName={fm.display_name}
              isAuthed={!!user}
              brokerProvider={fm.broker_provider ?? null}
              fmStripeOnboarded={!!fm.stripe_onboarded}
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

  return viewerIsDopler ? <DoplerShell>{body}</DoplerShell> : body;
}
