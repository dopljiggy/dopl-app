import { NextResponse } from "next/server";
import { snaptrade } from "@/lib/snaptrade";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

/**
 * SnapTrade authorization cleanup. Sprint 17.
 *
 * Free tier = 5 authorizations per SnapTrade user. Ghost authorizations
 * accumulate when `removeBrokerageAuthorization()` fails silently during
 * disconnect (network blip, upstream throttle, etc.). The FM ends up with
 * "Connection Limit Reached" while only N < 5 connections show in dopl.
 *
 * POST diffs SnapTrade-side authorizations against active broker_connections
 * and revokes anything we don't own. Self-heals NULL provider_auth_id rows
 * BEFORE the diff so a legitimate-but-unhealed migration-006 row is matched
 * against its upstream auth and not mistakenly revoked. Self-heal pattern
 * mirrors sync-connection.ts:89-111.
 *
 * GET is diagnostic — returns both lists side-by-side without mutating.
 */

interface SnapTradeAuth {
  id?: string;
  brokerage?: { name?: string } | string;
  name?: string;
}

function getBrokerName(auth: SnapTradeAuth): string {
  const b = auth.brokerage;
  return (
    (typeof b === "object" && b?.name) || auth.name || "Broker"
  );
}

export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: fm } = await admin
    .from("fund_managers")
    .select("snaptrade_user_id, snaptrade_user_secret")
    .eq("id", user.id)
    .maybeSingle();
  if (!fm?.snaptrade_user_id || !fm?.snaptrade_user_secret) {
    return NextResponse.json(
      { error: "snaptrade user not registered" },
      { status: 400 }
    );
  }

  let auths: SnapTradeAuth[];
  try {
    const res = await snaptrade.connections.listBrokerageAuthorizations({
      userId: fm.snaptrade_user_id,
      userSecret: fm.snaptrade_user_secret,
    });
    auths = (res.data ?? []) as SnapTradeAuth[];
  } catch (err) {
    const msg = err instanceof Error ? err.message : "auth lookup failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // Self-heal: backfill provider_auth_id on active rows that are still
  // NULL after migration 006. We match by broker_name against the live
  // SnapTrade auth list. Without this, a legitimate-but-unhealed row
  // would have NO matching auth_id and the diff would treat its upstream
  // auth as a ghost — revoking it would orphan the local row.
  const { data: activeRows } = await admin
    .from("broker_connections")
    .select("id, provider_auth_id, broker_name")
    .eq("fund_manager_id", user.id)
    .eq("provider", "snaptrade")
    .eq("is_active", true);

  let healed = 0;
  const active: { id: string; provider_auth_id: string | null; broker_name: string }[] =
    (activeRows ?? []) as typeof active;
  for (const row of active) {
    if (row.provider_auth_id) continue;
    const match = auths.find((a) => getBrokerName(a) === row.broker_name);
    if (match?.id) {
      await admin
        .from("broker_connections")
        .update({ provider_auth_id: match.id })
        .eq("id", row.id);
      row.provider_auth_id = match.id;
      healed += 1;
    }
  }

  const ownedAuthIds = new Set(
    active
      .map((r) => r.provider_auth_id)
      .filter((x): x is string => x != null)
  );

  // Anything in the SnapTrade auth list that we don't own is a ghost —
  // revoke it to free a slot.
  let removed = 0;
  for (const auth of auths) {
    if (!auth.id || ownedAuthIds.has(auth.id)) continue;
    try {
      await snaptrade.connections.removeBrokerageAuthorization({
        userId: fm.snaptrade_user_id,
        userSecret: fm.snaptrade_user_secret,
        authorizationId: auth.id,
      });
      removed += 1;
    } catch (err) {
      console.warn(`cleanup: removeBrokerageAuthorization failed for ${auth.id}:`, err);
    }
  }

  return NextResponse.json({
    total: auths.length,
    removed,
    remaining: auths.length - removed,
    healed,
  });
}

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: fm } = await admin
    .from("fund_managers")
    .select("snaptrade_user_id, snaptrade_user_secret")
    .eq("id", user.id)
    .maybeSingle();
  if (!fm?.snaptrade_user_id || !fm?.snaptrade_user_secret) {
    return NextResponse.json(
      { error: "snaptrade user not registered" },
      { status: 400 }
    );
  }

  let auths: SnapTradeAuth[];
  try {
    const res = await snaptrade.connections.listBrokerageAuthorizations({
      userId: fm.snaptrade_user_id,
      userSecret: fm.snaptrade_user_secret,
    });
    auths = (res.data ?? []) as SnapTradeAuth[];
  } catch (err) {
    const msg = err instanceof Error ? err.message : "auth lookup failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const { data: activeRows } = await admin
    .from("broker_connections")
    .select("id, provider_auth_id, broker_name, is_active")
    .eq("fund_manager_id", user.id)
    .eq("provider", "snaptrade");

  return NextResponse.json({
    snaptrade: auths.map((a) => ({
      id: a.id,
      broker_name: getBrokerName(a),
    })),
    local: activeRows ?? [],
  });
}
