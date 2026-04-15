import { NextResponse } from "next/server";
import { saltedge } from "@/lib/saltedge";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

/**
 * Dopler-side Salt Edge registration. Writes the customer_id into
 * profiles.trading_connection_data.
 */
export async function POST() {
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

  const existing =
    (profile?.trading_connection_data as {
      saltedge_customer_id?: string;
    } | null) ?? {};

  if (existing.saltedge_customer_id) {
    return NextResponse.json({ customer_id: existing.saltedge_customer_id });
  }

  const identifier = `dopler-${user.id}`;
  const admin = createAdminClient();

  const save = async (customerId: string) => {
    await admin
      .from("profiles")
      .update({
        trading_provider: "saltedge",
        trading_connection_data: {
          ...existing,
          saltedge_customer_id: customerId,
        },
      })
      .eq("id", user.id);
  };

  try {
    const match = await saltedge.findCustomerByIdentifier(identifier);
    if (match?.customer_id) {
      await save(match.customer_id);
      return NextResponse.json({
        customer_id: match.customer_id,
        source: "list",
      });
    }
  } catch (err) {
    console.warn("saltedge list (dopler) failed:", err);
  }

  try {
    const customer = await saltedge.createCustomer(identifier);
    await save(customer.customer_id);
    return NextResponse.json({
      customer_id: customer.customer_id,
      source: "create",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "saltedge register failed";
    if (/already exists|duplicated/i.test(msg)) {
      try {
        const match = await saltedge.findCustomerByIdentifier(identifier);
        if (match?.customer_id) {
          await save(match.customer_id);
          return NextResponse.json({
            customer_id: match.customer_id,
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
