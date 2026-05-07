import { NextResponse } from "next/server";
import { snaptrade } from "@/lib/snaptrade";
import { createServerSupabase } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: fm } = await supabase
    .from("fund_managers")
    .select("snaptrade_user_id, snaptrade_user_secret")
    .eq("id", user.id)
    .single();

  if (!fm?.snaptrade_user_id) {
    return NextResponse.json({ error: "SnapTrade user not registered" }, { status: 400 });
  }

  try {
    // Sprint 17: pre-flight authorization count check. SnapTrade free tier
    // caps users at 5 authorizations and returns "Connection Limit Reached"
    // mid-OAuth otherwise. Catching it here means the FM stays in dopl and
    // sees an actionable error instead of bouncing to SnapTrade and back.
    const SNAPTRADE_FREE_TIER_LIMIT = 5;
    try {
      const auths = await snaptrade.connections.listBrokerageAuthorizations({
        userId: fm.snaptrade_user_id,
        userSecret: fm.snaptrade_user_secret!,
      });
      const current = auths.data?.length ?? 0;
      if (current >= SNAPTRADE_FREE_TIER_LIMIT) {
        return NextResponse.json(
          {
            error:
              "connection limit reached — disconnect a broker or clean up stale connections",
            limit: SNAPTRADE_FREE_TIER_LIMIT,
            current,
          },
          { status: 429 }
        );
      }
    } catch (err) {
      console.warn("pre-flight authorization count failed:", err);
      // Don't block the connect flow on the pre-flight; SnapTrade will
      // still surface the limit if we hit it.
    }

    const origin =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      new URL(request.url).origin;
    const customRedirect = `${origin}/api/snaptrade/callback?success=true`;

    const response = await snaptrade.authentication.loginSnapTradeUser({
      userId: fm.snaptrade_user_id,
      userSecret: fm.snaptrade_user_secret!,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      customRedirect,
    } as any);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const redirectUrl = (response.data as any).redirectURI;
    return NextResponse.json({ redirectUrl });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
