import { getCachedUser } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import PositionsClient from "./positions-client";

export default async function PositionsPage() {
  const { supabase, user } = await getCachedUser();
  if (!user) redirect("/login");

  const [{ data: portfolios }, { data: fm }] = await Promise.all([
    supabase
      .from("portfolios")
      .select("id, name, tier, price_cents")
      .eq("fund_manager_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("fund_managers")
      .select("broker_connected")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const portfolioIds = (portfolios ?? []).map((p) => p.id);
  const { data: assignedPositions } = await supabase
    .from("positions")
    .select("id, ticker, name, shares, current_price, market_value, allocation_pct, portfolio_id")
    .in(
      "portfolio_id",
      portfolioIds.length
        ? portfolioIds
        : ["00000000-0000-0000-0000-000000000000"]
    );

  return (
    <PositionsClient
      portfolios={portfolios ?? []}
      assignedPositions={assignedPositions ?? []}
      brokerConnected={!!fm?.broker_connected}
    />
  );
}
