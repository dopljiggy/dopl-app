import { getCachedUser } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
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

  // Sprint 15: positions get a broker_connection_id; we look up
  // broker_name in a separate batch query and merge by id so each row
  // can render a per-broker badge in the expandable card.
  const admin = createAdminClient();
  const positionsRaw = portfolioIds.length
    ? (
        await admin
          .from("positions")
          .select(
            "id, portfolio_id, ticker, name, allocation_pct, current_price, gain_loss_pct, shares, market_value, broker_connection_id"
          )
          .in("portfolio_id", portfolioIds)
      ).data ?? []
    : [];

  const connectionIds = Array.from(
    new Set(
      (positionsRaw as Array<{ broker_connection_id: string | null }>)
        .map((p) => p.broker_connection_id)
        .filter((x): x is string => x != null)
    )
  );
  const brokerNameById = new Map<string, string>();
  if (connectionIds.length) {
    const { data: conns } = await admin
      .from("broker_connections")
      .select("id, broker_name")
      .in("id", connectionIds);
    for (const c of (conns ?? []) as { id: string; broker_name: string }[]) {
      brokerNameById.set(c.id, c.broker_name);
    }
  }
  const positions = (positionsRaw as Array<{
    id: string;
    portfolio_id: string;
    ticker: string;
    name: string | null;
    allocation_pct: number | null;
    current_price: number | null;
    gain_loss_pct: number | null;
    shares: number | null;
    market_value: number | null;
    broker_connection_id: string | null;
  }>).map((p) => ({
    ...p,
    broker_name: p.broker_connection_id
      ? brokerNameById.get(p.broker_connection_id) ?? null
      : null,
  }));

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
      positions={positions}
      brokerProvider={brokerProvider}
      stripeOnboarded={stripeOnboarded}
    />
  );
}
