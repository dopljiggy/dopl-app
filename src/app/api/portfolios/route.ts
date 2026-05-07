import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  // Sprint 17: stamp display_order = max(existing FM-owned) + 1 so new
  // portfolios land at the end of any custom-order list. With every row
  // defaulting to 0 from migration 008, the first new portfolio created
  // post-migration becomes 1 and subsequent ones increment from there
  // — preserving the FM's custom sort across creations.
  const { data: maxRow } = await supabase
    .from("portfolios")
    .select("display_order")
    .eq("fund_manager_id", user.id)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = ((maxRow?.display_order as number | null) ?? 0) + 1;

  // Paid portfolios are allowed pre-Stripe. Doplers see the "finalizing
  // setup" lock on paid tiers until the FM's stripe_onboarded flips true;
  // the /api/stripe/checkout handler is the final gate (it fails when
  // stripe_account_id is missing or the account is not charge-enabled).
  const { data, error } = await supabase
    .from("portfolios")
    .insert({
      fund_manager_id: user.id,
      name: body.name,
      description: body.description,
      tier: body.tier,
      price_cents: body.price_cents,
      display_order: nextOrder,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const { searchParams } = new URL(request.url);
  const fundManagerId = searchParams.get("fund_manager_id");

  let query = supabase.from("portfolios").select("*").eq("is_active", true);

  if (fundManagerId) {
    query = query.eq("fund_manager_id", fundManagerId);
  }

  const { data, error } = await query.order("price_cents", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
