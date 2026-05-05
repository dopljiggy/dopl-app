import { getCachedUser } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { redirect } from "next/navigation";
import ConnectClient from "./connect-client";
import type { ConnectionCardData } from "@/components/connect/broker-connection-card";

/**
 * Sprint 15: connect page now renders a list of broker connections plus an
 * "Add Broker" button. Each connection has its own sync/disconnect controls.
 *
 * We use the admin client to fetch connections + count positions in one
 * pass; FM ownership is enforced by filtering on `fund_manager_id`.
 */
export default async function ConnectBrokerPage({
  searchParams,
}: {
  searchParams: Promise<{
    connected?: string;
    positions?: string;
    error?: string;
  }>;
}) {
  const { supabase, user } = await getCachedUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const justConnected = params.connected === "true";

  const admin = createAdminClient();

  const [{ data: rawConns }, { data: fm }, { data: fmCount }] = await Promise.all([
    admin
      .from("broker_connections")
      .select(
        "id, provider, broker_name, is_active, last_synced, created_at"
      )
      .eq("fund_manager_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("fund_managers")
      .select("snaptrade_user_id, saltedge_customer_id")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("fund_managers")
      .select("subscriber_count")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const connectionRows = (rawConns ?? []) as Array<{
    id: string;
    provider: "snaptrade" | "saltedge" | "manual";
    broker_name: string;
    is_active: boolean;
    last_synced: string | null;
    created_at: string;
  }>;

  // Count positions per connection in a single batch query.
  const ids = connectionRows.map((c) => c.id);
  const counts = new Map<string, { pool: number; assigned: number }>();
  if (ids.length) {
    const { data: positions } = await admin
      .from("positions")
      .select("broker_connection_id, portfolio_id")
      .in("broker_connection_id", ids);
    for (const row of (positions ?? []) as {
      broker_connection_id: string;
      portfolio_id: string | null;
    }[]) {
      const c = counts.get(row.broker_connection_id) ?? { pool: 0, assigned: 0 };
      if (row.portfolio_id == null) c.pool += 1;
      else c.assigned += 1;
      counts.set(row.broker_connection_id, c);
    }
  }

  const connections: ConnectionCardData[] = connectionRows.map((c) => {
    const cnt = counts.get(c.id) ?? { pool: 0, assigned: 0 };
    return {
      id: c.id,
      provider: c.provider,
      broker_name: c.broker_name,
      is_active: c.is_active,
      last_synced: c.last_synced,
      position_count: cnt.pool + cnt.assigned,
      pool_count: cnt.pool,
      assigned_count: cnt.assigned,
    };
  });

  return (
    <ConnectClient
      connections={connections}
      hasSnaptradeUser={!!fm?.snaptrade_user_id}
      hasSaltedgeCustomer={!!fm?.saltedge_customer_id}
      subscriberCount={fmCount?.subscriber_count ?? 0}
      justConnected={justConnected}
      errorMessage={params.error ?? null}
    />
  );
}
