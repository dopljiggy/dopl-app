import { NextResponse } from "next/server";
import { saltedge } from "@/lib/saltedge";
import { createServerSupabase } from "@/lib/supabase-server";

/**
 * Create a Salt Edge Connect URL and return it to the client for redirect.
 * v6 endpoint: POST /connections/connect
 */
export async function POST(request: Request) {
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

  if (!fm?.saltedge_customer_id) {
    return NextResponse.json(
      { error: "salt edge customer not registered" },
      { status: 400 }
    );
  }

  try {
    const origin =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      new URL(request.url).origin;
    const returnTo = `${origin}/api/saltedge/callback`;

    const session = await saltedge.createConnectUrl({
      customer_id: fm.saltedge_customer_id,
      return_to: returnTo,
    });

    return NextResponse.json({
      redirectUrl: session.connect_url,
      expires_at: session.expires_at,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "connect failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
