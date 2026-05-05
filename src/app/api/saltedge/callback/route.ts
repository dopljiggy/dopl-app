import { NextResponse, type NextRequest } from "next/server";
import { saltedge, connectionId } from "@/lib/saltedge";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { syncSaltedgePositions } from "../sync/sync";

/**
 * Salt Edge redirects the user back here after finishing Connect.
 *
 * Sprint 15: each new SaltEdge connection becomes one broker_connections
 * row with provider='saltedge' and provider_auth_id=connection_id. FMs
 * can return through this callback multiple times to add more banks/
 * brokers; each lands as a separate connection.
 *
 * Backward compat: also dual-writes `fund_managers.broker_connected`,
 * `broker_name`, `saltedge_connection_id`, and `broker_provider`.
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
    const admin = createAdminClient();

    // Pull all SaltEdge connections for this customer. Sprint 15: every
    // connection becomes its own broker_connections row. We walk the full
    // list (newest first) and INSERT/reactivate one row per connection.
    const connections = await saltedge.listConnections(fm.saltedge_customer_id);
    const sorted = [...connections].sort((a, b) =>
      (b.created_at ?? "").localeCompare(a.created_at ?? "")
    );
    if (sorted.length === 0) {
      return clearOnboardingCookie(
        NextResponse.redirect(
          `${origin}${returnBase}?error=${encodeURIComponent(
            "no salt edge connection found"
          )}`
        )
      );
    }

    const { data: existingRows } = await admin
      .from("broker_connections")
      .select("id, provider_auth_id, is_active")
      .eq("fund_manager_id", user.id)
      .eq("provider", "saltedge");
    const existingMap = new Map(
      (existingRows ?? []).map((r) => [r.provider_auth_id as string | null, r])
    );

    let firstName: string | null = null;
    let firstConnId: string | null = null;
    for (const c of sorted) {
      const cid = connectionId(c);
      if (!cid) continue;
      const brokerName = c.provider_name ?? "Bank";
      if (!firstName) firstName = brokerName;
      if (!firstConnId) firstConnId = cid;

      const found = existingMap.get(cid);
      if (found) {
        if (!found.is_active) {
          await admin
            .from("broker_connections")
            .update({ is_active: true, broker_name: brokerName })
            .eq("id", found.id);
        }
      } else {
        await admin.from("broker_connections").insert({
          fund_manager_id: user.id,
          provider: "saltedge",
          provider_auth_id: cid,
          broker_name: brokerName,
          is_active: true,
        });
      }
    }

    if (!firstConnId) {
      return clearOnboardingCookie(
        NextResponse.redirect(
          `${origin}${returnBase}?error=${encodeURIComponent(
            "no salt edge connection found"
          )}`
        )
      );
    }

    await admin
      .from("fund_managers")
      .update({
        saltedge_connection_id: firstConnId,
        broker_connected: true,
        broker_name: firstName ?? "Bank",
        broker_provider: "saltedge",
      })
      .eq("id", user.id);

    const positionCount = await syncSaltedgePositions(user.id, firstConnId);

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
