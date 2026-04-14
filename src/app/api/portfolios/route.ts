import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  const { data, error } = await supabase
    .from("portfolios")
    .insert({
      fund_manager_id: user.id,
      name: body.name,
      description: body.description,
      tier: body.tier,
      price_cents: body.price_cents,
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
