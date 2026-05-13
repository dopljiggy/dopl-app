import { getCachedUser } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { redirect } from "next/navigation";
import TradeClient from "./trade-client";
import type {
  PoolConnection,
  PoolPosition,
  PoolPortfolio,
} from "@/components/positions/pool-pane";
import type { Portfolio } from "@/types/database";
import type { PositionRow as AssignedPositionRow } from "../portfolios/expandable-portfolio-card";

/**
 * Sprint 17 Trade page.
 *
 * One-screen workflow: portfolio list (left, expandable cards reused from
 * /dashboard/portfolios) + position pool (right, reused PoolPane). Mobile
 * collapses to a tab bar between the two halves so the FM doesn't need
 * to bounce between /portfolios and /positions to assign a position.
 */
export default async function TradePage() {
  const { supabase, user } = await getCachedUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const [{ data: portfolios }, { data: connections }, { data: fm }] =
    await Promise.all([
      supabase
        .from("portfolios")
        .select("*")
        .eq("fund_manager_id", user.id)
        .order("created_at", { ascending: false }),
      admin
        .from("broker_connections")
        .select("id, provider, broker_name, is_active")
        .eq("fund_manager_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: true }),
      supabase
        .from("fund_managers")
        .select("broker_provider, stripe_onboarded")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

  const portfolioList: Portfolio[] = (portfolios ?? []) as Portfolio[];
  const connectionList: PoolConnection[] = (connections ?? []) as PoolConnection[];
  const connectionIds = connectionList.map((c) => c.id);
  const portfolioIds = portfolioList.map((p) => p.id);

  // Fetch positions both via broker_connections (covers pool + assigned
  // for migrated rows) AND via portfolios for legacy positions whose
  // broker_connection_id is NULL.
  const selectFields =
    "id, ticker, name, shares, current_price, market_value, allocation_pct, gain_loss_pct, entry_price, portfolio_id, broker_connection_id";

  let positions: RawPosition[] = [];
  if (connectionIds.length) {
    const { data } = await admin
      .from("positions")
      .select(selectFields)
      .in("broker_connection_id", connectionIds);
    positions = (data ?? []) as RawPosition[];
  }
  if (portfolioIds.length) {
    const { data: legacy } = await admin
      .from("positions")
      .select(selectFields)
      .in("portfolio_id", portfolioIds)
      .is("broker_connection_id", null);
    if (legacy?.length) {
      positions = [...positions, ...(legacy as RawPosition[])];
    }
  }

  const brokerNameById = new Map<string, string>(
    connectionList.map((c) => [c.id, c.broker_name])
  );

  const pool: PoolPosition[] = positions
    .filter((p) => p.portfolio_id == null)
    .map((p) => ({
      id: p.id,
      ticker: p.ticker,
      name: p.name,
      shares: p.shares,
      current_price: p.current_price,
      market_value: p.market_value,
      gain_loss_pct: p.gain_loss_pct,
      entry_price: p.entry_price,
      broker_connection_id: p.broker_connection_id,
    }));

  const assigned: AssignedPositionRow[] = positions
    .filter((p) => p.portfolio_id != null)
    .map((p) => ({
      id: p.id,
      portfolio_id: p.portfolio_id as string,
      ticker: p.ticker,
      name: p.name,
      allocation_pct: p.allocation_pct,
      current_price: p.current_price,
      gain_loss_pct: p.gain_loss_pct,
      shares: p.shares,
      market_value: p.market_value,
      entry_price: p.entry_price,
      broker_name: p.broker_connection_id
        ? brokerNameById.get(p.broker_connection_id) ?? null
        : null,
    }));

  const portfolioStubs: PoolPortfolio[] = portfolioList.map((p) => ({
    id: p.id,
    name: p.name,
    tier: p.tier,
    price_cents: p.price_cents,
  }));

  const fmRow =
    (fm as {
      broker_provider?: string | null;
      stripe_onboarded?: boolean | null;
    } | null) ?? null;

  return (
    <TradeClient
      portfolios={portfolioList}
      portfolioStubs={portfolioStubs}
      connections={connectionList}
      pool={pool}
      assigned={assigned}
      brokerProvider={fmRow?.broker_provider ?? null}
      stripeOnboarded={!!fmRow?.stripe_onboarded}
    />
  );
}

interface RawPosition {
  id: string;
  ticker: string;
  name: string | null;
  shares: number | null;
  current_price: number | null;
  market_value: number | null;
  allocation_pct: number | null;
  gain_loss_pct: number | null;
  entry_price: number | null;
  portfolio_id: string | null;
  broker_connection_id: string | null;
}
