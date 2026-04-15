import { createServerSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import PortfoliosClient from "./portfolios-client";

export default async function PortfoliosPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
  const fm = await supabase
    .from("fund_managers")
    .select("broker_provider")
    .eq("id", user.id)
    .maybeSingle();
  if (!fm.error) {
    brokerProvider =
      (fm.data as { broker_provider?: string | null } | null)?.broker_provider ??
      null;
  }

  return (
    <PortfoliosClient
      portfolios={portfolios ?? []}
      positions={positions ?? []}
      brokerProvider={brokerProvider}
    />
  );
}
