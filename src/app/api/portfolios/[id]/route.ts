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

  // Paid tier changes are allowed pre-Stripe. Doplers see the "finalizing
  // setup" lock until stripe_onboarded flips true; checkout is the final
  // gate. Keeps onboarding unblocked when Stripe docs take hours to clear.
  const { error } = await supabase
    .from("portfolios")
    .update(body)
    .eq("id", id)
    .eq("fund_manager_id", user.id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
