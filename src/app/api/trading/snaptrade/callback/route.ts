import { NextResponse, type NextRequest } from "next/server";
import { snaptrade } from "@/lib/snaptrade";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || url.origin;
  const success = url.searchParams.get("success");

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  if (success !== "true") {
    return NextResponse.redirect(
      `${origin}/settings?error=${encodeURIComponent(
        "broker connection was cancelled"
      )}`
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("trading_connection_data")
    .eq("id", user.id)
    .maybeSingle();

  const creds =
    (profile?.trading_connection_data as {
      snaptrade_user_id?: string;
      snaptrade_user_secret?: string;
    } | null) ?? {};

  if (!creds.snaptrade_user_id || !creds.snaptrade_user_secret) {
    return NextResponse.redirect(
      `${origin}/settings?error=${encodeURIComponent(
        "snaptrade user missing"
      )}`
    );
  }

  try {
    const accounts = await snaptrade.accountInformation.listUserAccounts({
      userId: creds.snaptrade_user_id,
      userSecret: creds.snaptrade_user_secret,
    });
    const first = accounts.data?.[0];
    const brokerName = first?.institution_name ?? "Broker";

    // Best-effort broker website lookup.
    let websiteUrl: string | null = null;
    try {
      const auths =
        await snaptrade.connections.listBrokerageAuthorizations({
          userId: creds.snaptrade_user_id,
          userSecret: creds.snaptrade_user_secret,
        });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const a: any = auths.data?.[0];
      websiteUrl =
        a?.brokerage?.url ??
        a?.brokerage?.brokerage_url ??
        null;
    } catch {
      // ignore
    }

    const admin = createAdminClient();
    await admin
      .from("profiles")
      .update({
        trading_provider: "snaptrade",
        trading_connected: true,
        trading_connection_data: {
          ...creds,
          broker_name: brokerName,
          website_url: websiteUrl,
        },
      })
      .eq("id", user.id);

    return NextResponse.redirect(`${origin}/settings?connected=true`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "callback failed";
    return NextResponse.redirect(
      `${origin}/settings?error=${encodeURIComponent(msg)}`
    );
  }
}
