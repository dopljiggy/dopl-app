import { NextResponse, type NextRequest } from "next/server";
import { saltedge } from "@/lib/saltedge";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { syncSaltedgePositions } from "../sync/sync";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || url.origin;

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=session%20expired`);
  }

  const { data: fm } = await supabase
    .from("fund_managers")
    .select("saltedge_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!fm?.saltedge_customer_id) {
    return NextResponse.redirect(
      `${origin}/dashboard/connect?error=${encodeURIComponent(
        "salt edge customer missing — try again"
      )}`
    );
  }

  try {
    const connections = await saltedge.listConnections(fm.saltedge_customer_id);
    const connection = connections[0];
    if (!connection) {
      return NextResponse.redirect(
        `${origin}/dashboard/connect?error=${encodeURIComponent(
          "no salt edge connection found"
        )}`
      );
    }

    const admin = createAdminClient();
    await admin
      .from("fund_managers")
      .update({
        saltedge_connection_id: connection.id,
        broker_connected: true,
        broker_name: connection.provider_name ?? "Bank",
        broker_provider: "saltedge",
      })
      .eq("id", user.id);

    const positionCount = await syncSaltedgePositions(user.id, connection.id);

    return NextResponse.redirect(
      `${origin}/dashboard/connect?connected=true&positions=${positionCount}`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "sync failed";
    return NextResponse.redirect(
      `${origin}/dashboard/connect?error=${encodeURIComponent(msg)}`
    );
  }
}
