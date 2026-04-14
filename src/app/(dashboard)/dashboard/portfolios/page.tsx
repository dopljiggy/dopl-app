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

  const { data: positions } = await supabase
    .from("positions")
    .select("portfolio_id, ticker")
    .in("portfolio_id", (portfolios ?? []).map((p) => p.id).length
      ? (portfolios ?? []).map((p) => p.id)
      : ["00000000-0000-0000-0000-000000000000"]);

  const positionCounts = new Map<string, number>();
  for (const p of positions ?? []) {
    positionCounts.set(p.portfolio_id, (positionCounts.get(p.portfolio_id) ?? 0) + 1);
  }

  return (
    <PortfoliosClient
      portfolios={(portfolios ?? []).map((p) => ({
        ...p,
        position_count: positionCounts.get(p.id) ?? 0,
      }))}
    />
  );
}
