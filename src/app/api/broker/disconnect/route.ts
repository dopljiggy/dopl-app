import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { snaptrade } from "@/lib/snaptrade";
import { saltedge } from "@/lib/saltedge";

/**
 * Disconnect the fund manager's broker. Portfolios and positions are
 * preserved — subscribers keep access to the last known positions.
 * Cancels upstream provider connection where possible, then flips
 * broker_connected off on the fund_managers row.
 */
export async function DELETE() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  type FMRow = {
    broker_provider?: string | null;
    snaptrade_user_id?: string | null;
    snaptrade_user_secret?: string | null;
    saltedge_connection_id?: string | null;
  };
  let fm: FMRow | null = null;

  const withNewCols = await supabase
    .from("fund_managers")
    .select(
      "broker_provider, snaptrade_user_id, snaptrade_user_secret, saltedge_connection_id"
    )
    .eq("id", user.id)
    .maybeSingle();
  if (withNewCols.error) {
    const fallback = await supabase
      .from("fund_managers")
      .select("snaptrade_user_id, snaptrade_user_secret")
      .eq("id", user.id)
      .maybeSingle();
    fm = (fallback.data as unknown as FMRow | null) ?? null;
  } else {
    fm = (withNewCols.data as unknown as FMRow | null) ?? null;
  }

  const provider =
    fm?.broker_provider ?? (fm?.snaptrade_user_id ? "snaptrade" : null);

  // Best-effort provider cleanup — don't block on failure.
  try {
    if (
      provider === "snaptrade" &&
      fm?.snaptrade_user_id &&
      fm.snaptrade_user_secret
    ) {
      // Delete all broker connections for this user.
      const conns = await snaptrade.connections.listBrokerageAuthorizations({
        userId: fm.snaptrade_user_id,
        userSecret: fm.snaptrade_user_secret,
      });
      for (const c of conns.data ?? []) {
        if (c.id) {
          try {
            await snaptrade.connections.removeBrokerageAuthorization({
              userId: fm.snaptrade_user_id,
              userSecret: fm.snaptrade_user_secret,
              authorizationId: c.id,
            });
          } catch (err) {
            console.warn("snaptrade disconnect auth failed:", err);
          }
        }
      }
    } else if (provider === "saltedge" && fm?.saltedge_connection_id) {
      await saltedge.deleteConnection(fm.saltedge_connection_id);
    }
  } catch (err) {
    console.warn("upstream disconnect failed (continuing):", err);
  }

  // Flip local state. Use admin client so the write bypasses any RLS
  // edge cases and wipes provider-specific references.
  const admin = createAdminClient();
  const update: Record<string, unknown> = {
    broker_connected: false,
    broker_name: null,
  };
  if (withNewCols.error === null || !withNewCols.error) {
    // New columns exist.
    update.saltedge_connection_id = null;
  }
  const { error } = await admin
    .from("fund_managers")
    .update(update)
    .eq("id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
