import { NextResponse } from "next/server";
import { snaptrade } from "@/lib/snaptrade";
import { createServerSupabase } from "@/lib/supabase-server";
import { v4 as uuidv4 } from "uuid";

export async function POST() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const userId = uuidv4();
    const response = await snaptrade.authentication.registerSnapTradeUser({
      userId,
    });

    // Store SnapTrade credentials
    await supabase
      .from("fund_managers")
      .update({
        snaptrade_user_id: userId,
        snaptrade_user_secret: response.data.userSecret,
      })
      .eq("id", user.id);

    return NextResponse.json({ userId, userSecret: response.data.userSecret });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
