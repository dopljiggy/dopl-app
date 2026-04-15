import { NextResponse } from "next/server";
import { saltedge } from "@/lib/saltedge";
import { createServerSupabase } from "@/lib/supabase-server";
import { extractPositions } from "./sync";

export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: fm } = await supabase
    .from("fund_managers")
    .select("saltedge_customer_id, saltedge_connection_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!fm?.saltedge_connection_id) {
    return NextResponse.json({ error: "Not connected" }, { status: 400 });
  }

  try {
    const accounts = await saltedge.listAccounts(fm.saltedge_connection_id);
    const positions = extractPositions(accounts);

    const accountSummary = accounts.map((a) => ({
      id: a.account_id ?? a.id,
      name: a.name,
      nature: a.nature,
      balance: a.balance,
      currency: a.currency_code,
    }));

    return NextResponse.json({
      positions,
      count: positions.length,
      accounts: accountSummary,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "sync failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
