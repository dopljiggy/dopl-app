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
