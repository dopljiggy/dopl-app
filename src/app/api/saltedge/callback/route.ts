import { NextResponse, type NextRequest } from "next/server";
import { saltedge, connectionId } from "@/lib/saltedge";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { syncSaltedgePositions } from "../sync/sync";

/**
 * Salt Edge redirects the user back here after finishing Connect.
 * We pick the newest connection for this customer, save the connection_id,
 * run a sync, and bounce back to the dashboard.
 */
function isFromOnboarding(request: NextRequest): boolean {
  return /(?:^|; )dopl_onboarding_flow=1(?:;|$)/.test(
    request.headers.get("cookie") ?? ""
  );
}

function clearOnboardingCookie(res: NextResponse): NextResponse {
  res.cookies.set("dopl_onboarding_flow", "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
  });
  return res;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || url.origin;
  const fromOnboarding = isFromOnboarding(request);
  const returnBase = fromOnboarding ? "/onboarding" : "/dashboard/connect";

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return clearOnboardingCookie(
      NextResponse.redirect(`${origin}/login?error=session%20expired`)
    );
  }

  const { data: fm } = await supabase
    .from("fund_managers")
    .select("saltedge_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!fm?.saltedge_customer_id) {
    return clearOnboardingCookie(
      NextResponse.redirect(
        `${origin}${returnBase}?error=${encodeURIComponent(
          "salt edge customer missing — try again"
        )}`
      )
    );
  }

  try {
    const connections = await saltedge.listConnections(fm.saltedge_customer_id);
    // Newest first — the most recently created connection is the one the
    // user just finished.
    const sorted = [...connections].sort((a, b) =>
      (b.created_at ?? "").localeCompare(a.created_at ?? "")
    );
    const connection = sorted[0];
    const connId = connection ? connectionId(connection) : null;
    if (!connection || !connId) {
      return clearOnboardingCookie(
        NextResponse.redirect(
          `${origin}${returnBase}?error=${encodeURIComponent(
            "no salt edge connection found"
          )}`
        )
      );
    }

    const admin = createAdminClient();
    await admin
      .from("fund_managers")
      .update({
        saltedge_connection_id: connId,
        broker_connected: true,
        broker_name: connection.provider_name ?? "Bank",
        broker_provider: "saltedge",
      })
      .eq("id", user.id);

    const positionCount = await syncSaltedgePositions(user.id, connId);

    // Sprint 4: onboarding-flow success lands on the new-tab handoff page;
    // settings/connect flow keeps its original destination.
    const successUrl = fromOnboarding
      ? `${origin}/oauth-return?provider=saltedge`
      : `${origin}/dashboard/connect?connected=true&positions=${positionCount}`;
    return clearOnboardingCookie(NextResponse.redirect(successUrl));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "sync failed";
    return clearOnboardingCookie(
      NextResponse.redirect(
        `${origin}${returnBase}?error=${encodeURIComponent(msg)}`
      )
    );
  }
}
