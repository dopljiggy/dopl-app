import { createServerSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import PortfolioDetailClient from "./portfolio-detail-client";
import DoplerShell from "@/components/dopler-shell";

export default async function PortfolioDetail({
  params,
}: {
  params: Promise<{ portfolioId: string }>;
}) {
  const { portfolioId } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: portfolio } = await supabase
    .from("portfolios")
    .select(
      "*, fund_manager:fund_managers!inner(handle, display_name, avatar_url, bio, subscriber_count, stripe_onboarded)"
    )
    .eq("id", portfolioId)
    .maybeSingle();

  // Portfolio may have been deleted, or the id in the URL is stale. Bounce
  // back to /feed instead of a dead-end 404 — the dopler sees their full
  // subscribed list there.
  if (!portfolio) redirect("/feed");

  const isOwner = portfolio.fund_manager_id === user.id;
  const isFree = portfolio.tier === "free";

  const [subResult, { data: positions }, { data: updates }] = await Promise.all([
    !isOwner && !isFree
      ? supabase
          .from("subscriptions")
          .select("id")
          .eq("user_id", user.id)
          .eq("portfolio_id", portfolioId)
          .eq("status", "active")
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("positions")
      .select("*")
      .eq("portfolio_id", portfolioId)
      .order("market_value", { ascending: false }),
    supabase
      .from("portfolio_updates")
      .select("*")
      .eq("portfolio_id", portfolioId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const subscribed = !!subResult.data;
  const canView = isOwner || isFree || subscribed;

  return (
    <DoplerShell>
      <div className="max-w-5xl mx-auto px-6 pt-4">
        <Link
          href="/feed"
          className="text-sm text-[color:var(--dopl-cream)]/60 hover:text-[color:var(--dopl-cream)] link-underline inline-block mb-4"
        >
          ← back to feed
        </Link>
      </div>
      <PortfolioDetailClient
        portfolio={portfolio}
        positions={positions ?? []}
        updates={updates ?? []}
        canView={canView}
        portfolioId={portfolioId}
        fmStripeOnboarded={!!portfolio.fund_manager?.stripe_onboarded}
      />
    </DoplerShell>
  );
}
