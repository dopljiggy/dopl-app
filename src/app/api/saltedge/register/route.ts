import { NextResponse } from "next/server";
import { saltedge } from "@/lib/saltedge";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: fm } = await supabase
    .from("fund_managers")
    .select("saltedge_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  if (fm?.saltedge_customer_id) {
    return NextResponse.json({ customerId: fm.saltedge_customer_id });
  }

  try {
    const customer = await saltedge.createCustomer(`dopl-${user.id}`);
    const admin = createAdminClient();
    await admin
      .from("fund_managers")
      .update({
        saltedge_customer_id: customer.id,
        broker_provider: "saltedge",
      })
      .eq("id", user.id);
    return NextResponse.json({ customerId: customer.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "salt edge register failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
