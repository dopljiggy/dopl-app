import { NextResponse } from "next/server";
import { snaptrade } from "@/lib/snaptrade";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { v4 as uuidv4 } from "uuid";

/**
 * Dopler-side SnapTrade registration. Writes credentials into
 * profiles.trading_connection_data so notifications can deep-link
 * the dopler back to their broker.
 */
export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("trading_connection_data")
    .eq("id", user.id)
    .maybeSingle();

  const existing =
    (profile?.trading_connection_data as {
      snaptrade_user_id?: string;
      snaptrade_user_secret?: string;
    } | null) ?? {};

  if (existing.snaptrade_user_id && existing.snaptrade_user_secret) {
    return NextResponse.json({ userId: existing.snaptrade_user_id });
  }

  try {
    const userId = uuidv4();
    const response = await snaptrade.authentication.registerSnapTradeUser({
      userId,
    });
    const secret = response.data.userSecret;

    const admin = createAdminClient();
    await admin
      .from("profiles")
      .update({
        trading_provider: "snaptrade",
        trading_connection_data: {
          ...existing,
          snaptrade_user_id: userId,
          snaptrade_user_secret: secret,
        },
      })
      .eq("id", user.id);

    return NextResponse.json({ userId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "register failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
