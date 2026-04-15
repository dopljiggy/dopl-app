import { NextResponse } from "next/server";
import { saltedge } from "@/lib/saltedge";
import { createServerSupabase } from "@/lib/supabase-server";

export async function POST(request: Request) {
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

  const creds =
    (profile?.trading_connection_data as {
      saltedge_customer_id?: string;
    } | null) ?? {};

  if (!creds.saltedge_customer_id) {
    return NextResponse.json(
      { error: "saltedge customer not registered" },
      { status: 400 }
    );
  }

  try {
    const origin =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      new URL(request.url).origin;
    const returnTo = `${origin}/api/trading/saltedge/callback`;
    const session = await saltedge.createConnectUrl({
      customer_id: creds.saltedge_customer_id,
      return_to: returnTo,
    });
    return NextResponse.json({ redirectUrl: session.connect_url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "connect failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
