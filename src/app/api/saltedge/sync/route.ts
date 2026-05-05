import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  syncSaltedgeConnection,
  type BrokerConnectionRow,
} from "@/lib/sync-connection";

/**
 * SaltEdge per-connection sync.
 *
 * POST body (optional): { connection_id?: string }  (broker_connections.id)
 *   - Provided: syncs that one connection.
 *   - Absent:   syncs all active SaltEdge connections for the FM.
 *
 * Returns: { results: SyncResult[] }
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  let connectionId: string | undefined;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      connection_id?: string;
    };
    connectionId = body.connection_id;
  } catch {
    connectionId = undefined;
  }

  let connections: BrokerConnectionRow[] = [];
  if (connectionId) {
    const { data: row } = await admin
      .from("broker_connections")
      .select(
        "id, fund_manager_id, provider, provider_auth_id, broker_name, is_active"
      )
      .eq("id", connectionId)
      .maybeSingle();
    if (
      !row ||
      row.fund_manager_id !== user.id ||
      row.provider !== "saltedge"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    connections = [row as BrokerConnectionRow];
  } else {
    const { data: rows } = await admin
      .from("broker_connections")
      .select(
        "id, fund_manager_id, provider, provider_auth_id, broker_name, is_active"
      )
      .eq("fund_manager_id", user.id)
      .eq("provider", "saltedge")
      .eq("is_active", true);
    connections = (rows ?? []) as BrokerConnectionRow[];
    if (connections.length === 0) {
      return NextResponse.json({ error: "Not connected" }, { status: 400 });
    }
  }

  try {
    const results = [];
    for (const c of connections) {
      results.push(await syncSaltedgeConnection(admin, user.id, c));
    }

    const upserted = results.reduce((a, r) => a + r.upserted, 0);
    const sold = results.reduce((a, r) => a + r.sold, 0);

    return NextResponse.json({
      results,
      count: upserted,
      sold,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "sync failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
