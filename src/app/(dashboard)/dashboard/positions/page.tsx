import { getCachedUser } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { redirect } from "next/navigation";
import PositionsClient from "./positions-client";

export default async function PositionsPage() {
  const { supabase, user } = await getCachedUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  // Sprint 15: positions live in two states — pool (portfolio_id NULL) and
  // assigned (portfolio_id set). Both fetched in one round trip filtered by
  // the FM's broker_connections so RLS on the assigned-positions side
  // doesn't trip the pool query.
  const [{ data: portfolios }, { data: connections }] = await Promise.all([
    supabase
      .from("portfolios")
      .select("id, name, tier, price_cents")
      .eq("fund_manager_id", user.id)
      .order("created_at", { ascending: false }),
    admin
      .from("broker_connections")
      .select("id, provider, broker_name, is_active")
      .eq("fund_manager_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
  ]);

  const connectionIds = (connections ?? []).map((c) => c.id);

  let positions: PositionRow[] = [];
  if (connectionIds.length) {
    const { data } = await admin
      .from("positions")
      .select(
        "id, ticker, name, shares, current_price, market_value, allocation_pct, gain_loss_pct, portfolio_id, broker_connection_id, last_synced"
      )
      .in("broker_connection_id", connectionIds);
    positions = (data ?? []) as PositionRow[];
  }

  // Also include legacy positions with broker_connection_id NULL — these
  // pre-date migration 006 backfill on edge cases. Pull them via the FM's
  // portfolios so they still show up in the assigned column.
  const portfolioIds = (portfolios ?? []).map((p) => p.id);
  if (portfolioIds.length) {
    const { data: legacyPositions } = await admin
      .from("positions")
      .select(
        "id, ticker, name, shares, current_price, market_value, allocation_pct, gain_loss_pct, portfolio_id, broker_connection_id, last_synced"
      )
      .in("portfolio_id", portfolioIds)
      .is("broker_connection_id", null);
    if (legacyPositions?.length) {
      positions = [...positions, ...(legacyPositions as PositionRow[])];
    }
  }

  return (
    <PositionsClient
      portfolios={portfolios ?? []}
      connections={
        ((connections ?? []) as Array<{
          id: string;
          provider: "snaptrade" | "saltedge" | "manual";
          broker_name: string;
          is_active: boolean;
        }>) ?? []
      }
      positions={positions}
    />
  );
}

interface PositionRow {
  id: string;
  ticker: string;
  name: string | null;
  shares: number | null;
  current_price: number | null;
  market_value: number | null;
  allocation_pct: number | null;
  gain_loss_pct: number | null;
  portfolio_id: string | null;
  broker_connection_id: string | null;
  last_synced: string | null;
}
