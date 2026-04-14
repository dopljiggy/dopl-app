import { NextResponse } from "next/server";
import { snaptrade } from "@/lib/snaptrade";
import { createServerSupabase } from "@/lib/supabase-server";

export async function POST() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: fm } = await supabase
    .from("fund_managers")
    .select("snaptrade_user_id, snaptrade_user_secret")
    .eq("id", user.id)
    .single();

  if (!fm?.snaptrade_user_id) {
    return NextResponse.json({ error: "Not connected" }, { status: 400 });
  }

  try {
    // Get all accounts
    const accounts = await snaptrade.accountInformation.listUserAccounts({
      userId: fm.snaptrade_user_id,
      userSecret: fm.snaptrade_user_secret!,
    });

    // Get holdings for each account
    const allPositions: any[] = [];
    for (const account of accounts.data) {
      const holdings = await snaptrade.accountInformation.getUserHoldings({
        userId: fm.snaptrade_user_id,
        userSecret: fm.snaptrade_user_secret!,
        accountId: account.id!,
      });

      if (holdings.data.positions) {
        for (const pos of holdings.data.positions) {
          allPositions.push({
            ticker: pos.symbol?.symbol?.symbol || "UNKNOWN",
            name: pos.symbol?.symbol?.description || "",
            shares: pos.units,
            market_value: pos.units && pos.price ? pos.units * pos.price : null,
            current_price: pos.price,
            asset_type: "stock",
            last_synced: new Date().toISOString(),
          });
        }
      }
    }

    // Update broker connected status
    await supabase
      .from("fund_managers")
      .update({
        broker_connected: true,
        broker_name: accounts.data[0]?.institution_name || "Unknown",
      })
      .eq("id", user.id);

    return NextResponse.json({ positions: allPositions, count: allPositions.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
