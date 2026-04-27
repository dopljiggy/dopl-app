import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("profiles")
    .select("trading_broker_preference")
    .eq("id", user.id)
    .maybeSingle();

  return NextResponse.json({
    broker: data?.trading_broker_preference ?? null,
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const broker = typeof body.broker === "string" ? body.broker.trim() : null;

  const { error } = await supabase
    .from("profiles")
    .update({ trading_broker_preference: broker || null })
    .eq("id", user.id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ broker: broker || null });
}
