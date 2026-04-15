import { NextResponse } from "next/server";
import { snaptrade } from "@/lib/snaptrade";
import { createServerSupabase } from "@/lib/supabase-server";

export async function POST(request: Request) {
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

  const creds =
    (profile?.trading_connection_data as {
      snaptrade_user_id?: string;
      snaptrade_user_secret?: string;
    } | null) ?? {};

  if (!creds.snaptrade_user_id || !creds.snaptrade_user_secret) {
    return NextResponse.json(
      { error: "SnapTrade user not registered" },
      { status: 400 }
    );
  }

  try {
    const origin =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      new URL(request.url).origin;
    const customRedirect = `${origin}/api/trading/snaptrade/callback?success=true`;

    const response = await snaptrade.authentication.loginSnapTradeUser({
      userId: creds.snaptrade_user_id,
      userSecret: creds.snaptrade_user_secret,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      customRedirect,
    } as any);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const redirectUrl = (response.data as any).redirectURI;
    return NextResponse.json({ redirectUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "connect failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
