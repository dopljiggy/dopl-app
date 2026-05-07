import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { snaptrade } from "@/lib/snaptrade";
import { saltedge } from "@/lib/saltedge";

/**
 * Disconnect broker(s). Sprint 15:
 *   - Body { connection_id }: disconnect just that one connection (matches
 *     the multi-broker UX on the new connect page).
 *   - No body / { connection_id: undefined }: disconnect every active
 *     connection (backward compat with the legacy single-broker disconnect
 *     button + onboarding flow).
 *
 * Soft-delete: connections become is_active=false; positions stay so
 * subscribers keep seeing the last-known holdings on assigned positions.
 * Best-effort upstream revocation against SnapTrade / SaltEdge but no
 * blocking on upstream errors (FM intent is local; upstream cleanup is
 * a "nice to have").
 */
export async function DELETE(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let connectionId: string | undefined;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      connection_id?: string;
    };
    connectionId = body.connection_id;
  } catch {
    connectionId = undefined;
  }

  const admin = createAdminClient();

  // Pull target connection rows. Per-connection: just that row. All:
  // every active connection for the FM.
  let rows: Array<{
    id: string;
    provider: string;
    provider_auth_id: string | null;
  }> = [];
  if (connectionId) {
    const { data: row } = await admin
      .from("broker_connections")
      .select("id, fund_manager_id, provider, provider_auth_id, is_active")
      .eq("id", connectionId)
      .maybeSingle();
    if (!row || row.fund_manager_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (row.is_active) rows = [row];
  } else {
    const { data: r } = await admin
      .from("broker_connections")
      .select("id, provider, provider_auth_id")
      .eq("fund_manager_id", user.id)
      .eq("is_active", true);
    rows = (r ?? []) as typeof rows;
  }

  // Best-effort upstream revocation. Per-row try/catch — one provider
  // hiccup shouldn't block the others or the local soft-delete. Sprint
  // 17: track revocation failure and surface via `warning` on the
  // response so the FM knows to use the cleanup tool if they hit a
  // SnapTrade slot limit later.
  let revocationFailed = false;
  if (rows.length > 0) {
    const { data: fm } = await admin
      .from("fund_managers")
      .select("snaptrade_user_id, snaptrade_user_secret")
      .eq("id", user.id)
      .maybeSingle();
    for (const c of rows) {
      try {
        if (
          c.provider === "snaptrade" &&
          c.provider_auth_id &&
          fm?.snaptrade_user_id &&
          fm?.snaptrade_user_secret
        ) {
          await snaptrade.connections.removeBrokerageAuthorization({
            userId: fm.snaptrade_user_id,
            userSecret: fm.snaptrade_user_secret,
            authorizationId: c.provider_auth_id,
          });
        } else if (c.provider === "saltedge" && c.provider_auth_id) {
          await saltedge.deleteConnection(c.provider_auth_id);
        }
      } catch (err) {
        revocationFailed = true;
        console.warn(`upstream disconnect failed for ${c.id}:`, err);
      }
    }
  }

  // Local soft-delete.
  if (rows.length > 0) {
    await admin
      .from("broker_connections")
      .update({ is_active: false })
      .in(
        "id",
        rows.map((r) => r.id)
      );
  }

  // Refresh legacy fund_managers single-broker fields based on what's
  // left active. If everything just got disconnected, broker_connected
  // flips to false and broker_name clears.
  const { data: stillActive } = await admin
    .from("broker_connections")
    .select("broker_name, provider")
    .eq("fund_manager_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1);
  const first = (stillActive ?? [])[0] as
    | { broker_name: string; provider: string }
    | undefined;
  await admin
    .from("fund_managers")
    .update({
      broker_connected: !!first,
      broker_name: first?.broker_name ?? null,
      broker_provider: first?.provider ?? null,
      // Clear legacy saltedge_connection_id only if no SaltEdge
      // connection remains active.
      ...(first?.provider === "saltedge"
        ? {}
        : { saltedge_connection_id: null }),
    })
    .eq("id", user.id);

  return NextResponse.json({
    ok: true,
    disconnected: rows.length,
    ...(revocationFailed
      ? {
          warning:
            "disconnected locally but broker-side cleanup failed — use the cleanup tool if you hit connection limits",
        }
      : {}),
  });
}
