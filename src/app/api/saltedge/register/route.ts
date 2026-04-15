import { NextResponse } from "next/server";
import { saltedge, errorBody } from "@/lib/saltedge";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 1) If we've already saved a customer_id, skip Salt Edge entirely.
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

  const saveCustomer = async (customerId: string) => {
    await admin
      .from("fund_managers")
      .update({
        saltedge_customer_id: customerId,
        broker_provider: "saltedge",
      })
      .eq("id", user.id);
  };

  // 2) Try to create.
  try {
    const customer = await saltedge.createCustomer(identifier);
    await saveCustomer(customer.id);
    return NextResponse.json({ customerId: customer.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "salt edge register failed";
    const isDuplicate =
      /already exists|duplicated|duplicate/i.test(msg) ||
      /DuplicatedCustomer/i.test(msg);

    if (!isDuplicate) {
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    // 2a) Salt Edge sometimes returns the existing customer_id inside the
    //     error body. Grab it if it's there.
    const body = errorBody(err) as
      | {
          error?: {
            message?: string;
            documentation_url?: string;
            request_id?: string;
            class?: string;
          };
          data?: { id?: string; identifier?: string; customer_id?: string };
        }
      | null;
    const inlineId =
      body?.data?.id ?? body?.data?.customer_id ?? null;
    if (inlineId) {
      await saveCustomer(inlineId);
      return NextResponse.json({
        customerId: inlineId,
        recovered: true,
        source: "error_body",
      });
    }

    // 2b) Fall back to paginating GET /customers and matching by identifier.
    try {
      const existing = await saltedge.findCustomerByIdentifier(identifier);
      if (existing?.id) {
        await saveCustomer(existing.id);
        return NextResponse.json({
          customerId: existing.id,
          recovered: true,
          source: "list",
        });
      }
    } catch (lookupErr) {
      // swallow — we still want to surface the original duplicate error below
      console.warn("salt edge customer lookup failed:", lookupErr);
    }

    return NextResponse.json(
      {
        error:
          "salt edge says this customer already exists but we could not look it up. contact support.",
        identifier,
        detail: msg,
      },
      { status: 500 }
    );
  }
}
