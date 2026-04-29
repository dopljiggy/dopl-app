import { getCachedUser } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import PortfoliosClient from "./portfolios-client";

export default async function PortfoliosPage() {
  const { supabase, user } = await getCachedUser();
  if (!user) redirect("/login");

  const { data: portfolios } = await supabase
    .from("portfolios")
    .select("*")
    .eq("fund_manager_id", user.id)
    .order("created_at", { ascending: false });

  const portfolioIds = (portfolios ?? []).map((p) => p.id);

  const { data: positions } = portfolioIds.length
    ? await supabase
        .from("positions")
        .select(
          "id, portfolio_id, ticker, name, allocation_pct, current_price, gain_loss_pct, shares, market_value"
        )
        .in("portfolio_id", portfolioIds)
    : { data: [] };

  let brokerProvider: string | null = null;
  let stripeOnboarded = false;
  const fm = await supabase
    .from("fund_managers")
    .select("broker_provider, stripe_onboarded")
    .eq("id", user.id)
    .maybeSingle();
  if (!fm.error) {
    const row =
      (fm.data as {
        broker_provider?: string | null;
        stripe_onboarded?: boolean | null;
      } | null) ?? null;
    brokerProvider = row?.broker_provider ?? null;
    stripeOnboarded = !!row?.stripe_onboarded;
  }

  return (
    <PortfoliosClient
      portfolios={portfolios ?? []}
      positions={positions ?? []}
      brokerProvider={brokerProvider}
      stripeOnboarded={stripeOnboarded}
    />
  );
}
