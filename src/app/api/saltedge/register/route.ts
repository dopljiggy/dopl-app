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

  // Already-saved customer → short-circuit, skip Salt Edge entirely.
  const { data: fm } = await supabase
    .from("fund_managers")
    .select("saltedge_customer_id")
    .eq("id", user.id)
    .maybeSingle();
  if (fm?.saltedge_customer_id) {
    return NextResponse.json({ customerId: fm.saltedge_customer_id });
  }

  const admin = createAdminClient();
  const identifier = `dopl-${user.id}`;

  try {
    const customer = await saltedge.createCustomer(identifier);
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

    // Salt Edge returns DuplicatedCustomer / "already exists" when a customer
    // with this identifier is registered from a previous attempt. Recover by
    // fetching the existing customer and saving its id.
    const isDuplicate =
      /already exists|duplicated|duplicate/i.test(msg) ||
      /DuplicatedCustomer/i.test(msg);

    if (!isDuplicate) {
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    try {
      const existing = await saltedge.findCustomerByIdentifier(identifier);
      if (!existing?.id) {
        return NextResponse.json(
          { error: "customer exists but could not be fetched" },
          { status: 500 }
        );
      }
      await admin
        .from("fund_managers")
        .update({
          saltedge_customer_id: existing.id,
          broker_provider: "saltedge",
        })
        .eq("id", user.id);
      return NextResponse.json({ customerId: existing.id, recovered: true });
    } catch (fetchErr) {
      const fetchMsg =
        fetchErr instanceof Error ? fetchErr.message : "lookup failed";
      return NextResponse.json(
        { error: `could not recover existing customer: ${fetchMsg}` },
        { status: 500 }
      );
    }
  }
}
