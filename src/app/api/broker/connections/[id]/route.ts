import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { snaptrade } from "@/lib/snaptrade";
import { saltedge } from "@/lib/saltedge";

/**
 * Per-connection PATCH (rename / toggle is_active) and DELETE
 * (soft-delete + best-effort upstream revocation).
 *
 * Soft-delete keeps positions intact: subscribers continue to see the
 * last-known holdings of any positions that were assigned to a portfolio.
 * Pool positions for the disconnected connection cascade-delete via the
 * FK only if the connection row itself is hard-deleted, which we don't
 * do here — the row stays with is_active=false.
 */

interface PatchBody {
  broker_name?: string;
  is_active?: boolean;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as PatchBody;
  const update: Record<string, unknown> = {};
  if (typeof body.broker_name === "string") update.broker_name = body.broker_name;
  if (typeof body.is_active === "boolean") update.is_active = body.is_active;
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Ownership check via FM id.
  const { data: existing } = await admin
    .from("broker_connections")
    .select("id, fund_manager_id")
    .eq("id", id)
    .maybeSingle();
  if (!existing || existing.fund_manager_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: updated, error } = await admin
    .from("broker_connections")
    .update(update)
    .eq("id", id)
    .select(
      "id, provider, provider_auth_id, broker_name, is_active, last_synced, created_at"
    )
    .single();

  if (error || !updated) {
    return NextResponse.json(
      { error: error?.message ?? "update failed" },
      { status: 500 }
    );
  }

  await syncLegacyBrokerFlag(admin, user.id);

  return NextResponse.json({ connection: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const { data: connection } = await admin
    .from("broker_connections")
    .select("id, fund_manager_id, provider, provider_auth_id, is_active")
    .eq("id", id)
    .maybeSingle();

  if (!connection || connection.fund_manager_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Best-effort upstream revocation. Don't block local soft-delete on
  // upstream errors — the FM intent is "disconnect from dopl", not
  // "fix the upstream provider". Sprint 17: track failure and surface
  // via `warning` so the FM can use the cleanup tool if they hit slot
  // limits later.
  let revocationFailed = false;
  if (connection.is_active) {
    try {
      if (connection.provider === "snaptrade" && connection.provider_auth_id) {
        const { data: fm } = await admin
          .from("fund_managers")
          .select("snaptrade_user_id, snaptrade_user_secret")
          .eq("id", user.id)
          .maybeSingle();
        if (fm?.snaptrade_user_id && fm.snaptrade_user_secret) {
          await snaptrade.connections.removeBrokerageAuthorization({
            userId: fm.snaptrade_user_id,
            userSecret: fm.snaptrade_user_secret,
            authorizationId: connection.provider_auth_id,
          });
        }
      } else if (
        connection.provider === "saltedge" &&
        connection.provider_auth_id
      ) {
        await saltedge.deleteConnection(connection.provider_auth_id);
      }
    } catch (err) {
      revocationFailed = true;
      console.warn("upstream revoke failed (continuing):", err);
    }
  }

  // Soft-delete: positions keep working for subscribers.
  await admin
    .from("broker_connections")
    .update({ is_active: false })
    .eq("id", id);

  await syncLegacyBrokerFlag(admin, user.id);

  return NextResponse.json({
    ok: true,
    ...(revocationFailed
      ? {
          warning:
            "disconnected locally but broker-side cleanup failed — use the cleanup tool if you hit connection limits",
        }
      : {}),
  });
}

/**
 * Recompute legacy fund_managers.broker_connected / broker_name from
 * the active broker_connections rows. Keeps single-broker readers in
 * sync until those columns are removed.
 */
async function syncLegacyBrokerFlag(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  fundManagerId: string
) {
  const { data: active } = await admin
    .from("broker_connections")
    .select("broker_name, provider")
    .eq("fund_manager_id", fundManagerId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1);
  const first = (active ?? [])[0] as
    | { broker_name: string; provider: string }
    | undefined;
  await admin
    .from("fund_managers")
    .update({
      broker_connected: !!first,
      broker_name: first?.broker_name ?? null,
      broker_provider: first?.provider ?? null,
    })
    .eq("id", fundManagerId);
}
