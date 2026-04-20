import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("portfolios")
    .delete()
    .eq("id", id)
    .eq("fund_manager_id", user.id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  if (Number(body.price_cents ?? 0) > 0) {
    const { data: fm } = await supabase
      .from("fund_managers")
      .select("stripe_onboarded")
      .eq("id", user.id)
      .maybeSingle();
    if (!fm?.stripe_onboarded) {
      return NextResponse.json(
        {
          error: "Complete Stripe onboarding before publishing paid portfolios.",
          next: "/dashboard/billing",
        },
        { status: 400 }
      );
    }
  }

  const { error } = await supabase
    .from("portfolios")
    .update(body)
    .eq("id", id)
    .eq("fund_manager_id", user.id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
