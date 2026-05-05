import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

/**
 * Broker connections CRUD. One row per OAuth (or manual) connection;
 * each FM can have N. See migration 006.
 *
 * GET  → list FM's connections with position counts (admin client to
 *        join positions in one query; ownership filtered by FM id).
 * POST → create a connection. Used internally by callbacks; FM-facing
 *        flows should go through /api/snaptrade/connect or /api/saltedge/connect.
 *        Dual-writes fund_managers.broker_connected for backward compat.
 */

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const { data: connections, error } = await admin
    .from("broker_connections")
    .select(
      "id, provider, provider_auth_id, broker_name, is_active, last_synced, created_at"
    )
    .eq("fund_manager_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ids = (connections ?? []).map((c) => c.id);
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

  return NextResponse.json({
    connections: (connections ?? []).map((c) => {
      const cnt = counts.get(c.id) ?? { pool: 0, assigned: 0 };
      return {
        ...c,
        position_count: cnt.pool + cnt.assigned,
        pool_count: cnt.pool,
        assigned_count: cnt.assigned,
      };
    }),
  });
}

interface CreateBody {
  provider: "snaptrade" | "saltedge" | "manual";
  provider_auth_id?: string | null;
  broker_name: string;
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as CreateBody;
  if (!body.provider || !body.broker_name) {
    return NextResponse.json(
      { error: "provider and broker_name required" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Idempotency: if a connection with the same (FM, provider, auth_id)
  // already exists, return it instead of inserting a duplicate. The
  // partial unique index would catch this on auth_id-bearing rows, but
  // returning the existing id is friendlier for callbacks that retry.
  if (body.provider_auth_id) {
    const { data: existing } = await admin
      .from("broker_connections")
      .select("id, provider, provider_auth_id, broker_name, is_active, last_synced, created_at")
      .eq("fund_manager_id", user.id)
      .eq("provider", body.provider)
      .eq("provider_auth_id", body.provider_auth_id)
      .maybeSingle();
    if (existing) {
      // Re-activate if previously soft-deleted.
      if (!existing.is_active) {
        await admin
          .from("broker_connections")
          .update({ is_active: true, broker_name: body.broker_name })
          .eq("id", existing.id);
      }
      await dualWriteBrokerConnected(admin, user.id, body.broker_name);
      return NextResponse.json({ connection: { ...existing, is_active: true } });
    }
  }

  const { data: created, error } = await admin
    .from("broker_connections")
    .insert({
      fund_manager_id: user.id,
      provider: body.provider,
      provider_auth_id: body.provider_auth_id ?? null,
      broker_name: body.broker_name,
      is_active: true,
    })
    .select(
      "id, provider, provider_auth_id, broker_name, is_active, last_synced, created_at"
    )
    .single();

  if (error || !created) {
    return NextResponse.json(
      { error: error?.message ?? "could not create connection" },
      { status: 500 }
    );
  }

  await dualWriteBrokerConnected(admin, user.id, body.broker_name);

  return NextResponse.json({ connection: created });
}

/**
 * Dual-write the legacy single-broker fields on fund_managers so older
 * code paths (and any UI still reading those columns) keep working
 * during the multi-broker rollout. Removed in a future sprint after
 * all readers migrate.
 */
async function dualWriteBrokerConnected(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  fundManagerId: string,
  brokerName: string
) {
  await admin
    .from("fund_managers")
    .update({
      broker_connected: true,
      broker_name: brokerName,
    })
    .eq("id", fundManagerId);
}
