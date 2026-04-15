import { NextResponse } from "next/server";
import { saltedge } from "@/lib/saltedge";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

/**
 * Ensure the current fund manager has a Salt Edge customer_id.
 *
 * Flow (verified against live v6 API):
 *   1. If fund_managers.saltedge_customer_id is already set → return it.
 *   2. List existing Salt Edge customers and match on identifier → save+return.
 *   3. Otherwise POST /customers to create → save+return.
 */
export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: fm } = await supabase
    .from("fund_managers")
    .select("saltedge_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  if (fm?.saltedge_customer_id) {
    return NextResponse.json({ customer_id: fm.saltedge_customer_id });
  }

  const identifier = `dopl-${user.id}`;
  const admin = createAdminClient();

  const save = async (customerId: string) => {
    await admin
      .from("fund_managers")
      .update({
        saltedge_customer_id: customerId,
        broker_provider: "saltedge",
      })
      .eq("id", user.id);
  };

  // 2. Try to find first — avoids DuplicatedCustomer on retries.
  try {
    const existing = await saltedge.findCustomerByIdentifier(identifier);
    if (existing?.customer_id) {
      await save(existing.customer_id);
      return NextResponse.json({
        customer_id: existing.customer_id,
        source: "list",
      });
    }
  } catch (err) {
    // Listing failed — continue to create; surface error only if create also fails.
    console.warn("salt edge list customers failed:", err);
  }

  // 3. Create.
  try {
    const customer = await saltedge.createCustomer(identifier);
    await save(customer.customer_id);
    return NextResponse.json({
      customer_id: customer.customer_id,
      source: "create",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "salt edge register failed";

    // DuplicatedCustomer can still race — one more list attempt.
    const isDup = /already exists|duplicated/i.test(msg);
    if (isDup) {
      try {
        const existing = await saltedge.findCustomerByIdentifier(identifier);
        if (existing?.customer_id) {
          await save(existing.customer_id);
          return NextResponse.json({
            customer_id: existing.customer_id,
            source: "list_after_duplicate",
          });
        }
      } catch {
        /* fall through */
      }
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
