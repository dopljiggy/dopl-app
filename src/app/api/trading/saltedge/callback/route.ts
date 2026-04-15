import { NextResponse, type NextRequest } from "next/server";
import { saltedge, connectionId } from "@/lib/saltedge";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || url.origin;

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

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
    return NextResponse.redirect(
      `${origin}/settings?error=${encodeURIComponent(
        "saltedge customer missing"
      )}`
    );
  }

  try {
    const connections = await saltedge.listConnections(
      creds.saltedge_customer_id
    );
    const sorted = [...connections].sort((a, b) =>
      (b.created_at ?? "").localeCompare(a.created_at ?? "")
    );
    const conn = sorted[0];
    const connId = conn ? connectionId(conn) : null;
    if (!conn || !connId) {
      return NextResponse.redirect(
        `${origin}/settings?error=${encodeURIComponent(
          "no connection found"
        )}`
      );
    }

    // Provider home_url for bank link-out.
    let website: string | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c: any = conn;
      website = c.provider?.home_url ?? c.provider?.url ?? null;
    } catch {
      /* ignore */
    }

    const admin = createAdminClient();
    await admin
      .from("profiles")
      .update({
        trading_provider: "saltedge",
        trading_connected: true,
        trading_connection_data: {
          ...creds,
          saltedge_connection_id: connId,
          bank_name: conn.provider_name ?? "Bank",
          provider_code: conn.provider_code ?? null,
          website_url: website,
        },
      })
      .eq("id", user.id);

    return NextResponse.redirect(`${origin}/settings?connected=true`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "callback failed";
    return NextResponse.redirect(
      `${origin}/settings?error=${encodeURIComponent(msg)}`
    );
  }
}
