import { NextResponse, type NextRequest } from "next/server";
import { snaptrade } from "@/lib/snaptrade";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

/**
 * SnapTrade Connect redirects here after the user finishes authenticating
 * with their broker (we pass this URL as `customRedirect` in /api/snaptrade/connect).
 *
 * Sprint 15: enumerates `listBrokerageAuthorizations()` and INSERTs a
 * broker_connections row for each new authorization. FMs can return through
 * this callback multiple times (once per broker) and end up with multiple
 * connection rows. Existing rows (matched by provider_auth_id) are reused.
 *
 * Backward compat: also dual-writes `fund_managers.broker_connected = true`
 * and `broker_name` to the first authorization's institution name.
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
  const success = url.searchParams.get("success");
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

  if (success !== "true") {
    return clearOnboardingCookie(
      NextResponse.redirect(
        `${origin}${returnBase}?error=${encodeURIComponent(
          "broker connection was cancelled"
        )}`
      )
    );
  }

  const { data: fm } = await supabase
    .from("fund_managers")
    .select("id, snaptrade_user_id, snaptrade_user_secret")
    .eq("id", user.id)
    .maybeSingle();

  if (!fm?.snaptrade_user_id || !fm.snaptrade_user_secret) {
    return clearOnboardingCookie(
      NextResponse.redirect(
        `${origin}${returnBase}?error=${encodeURIComponent(
          "snaptrade user not found — try connecting again"
        )}`
      )
    );
  }

  try {
    const admin = createAdminClient();

    // Discover all SnapTrade authorizations for this user. Each entry =
    // one connected brokerage. Dopl creates one broker_connections row per.
    const authsRes = await snaptrade.connections.listBrokerageAuthorizations({
      userId: fm.snaptrade_user_id,
      userSecret: fm.snaptrade_user_secret,
    });
    const auths = authsRes.data ?? [];

    // Existing rows for this FM keyed by provider_auth_id, so we don't
    // re-insert on a repeat callback (FM clicked Add Broker twice).
    const { data: existing } = await admin
      .from("broker_connections")
      .select("id, provider_auth_id, is_active")
      .eq("fund_manager_id", user.id)
      .eq("provider", "snaptrade");
    const existingMap = new Map(
      (existing ?? []).map((row) => [
        row.provider_auth_id as string | null,
        row,
      ])
    );

    let firstBrokerName: string | null = null;
    let positionCount = 0;

    for (const auth of auths) {
      const authId = auth.id;
      if (!authId) continue;

      // Pull the authorization's institution name. SDK returns
      // brokerage as either an object (preferred) or just an id.
      const brokerage =
        (auth as { brokerage?: { name?: string } | string }).brokerage;
      const brokerName =
        (typeof brokerage === "object" && brokerage?.name) ||
        (auth as { name?: string }).name ||
        "Broker";
      if (!firstBrokerName) firstBrokerName = brokerName;

      const found = existingMap.get(authId);
      if (found) {
        // Re-activate any soft-deleted matching row + refresh broker_name.
        if (!found.is_active) {
          await admin
            .from("broker_connections")
            .update({ is_active: true, broker_name: brokerName })
            .eq("id", found.id);
        }
      } else {
        await admin.from("broker_connections").insert({
          fund_manager_id: user.id,
          provider: "snaptrade",
          provider_auth_id: authId,
          broker_name: brokerName,
          is_active: true,
        });
      }
    }

    // Tally positions across accounts for the redirect query string.
    // The actual sync into the pool happens lazily on the connect page
    // or via /api/broker/sync-all.
    const accounts = await snaptrade.accountInformation.listUserAccounts({
      userId: fm.snaptrade_user_id,
      userSecret: fm.snaptrade_user_secret,
    });
    for (const account of accounts.data ?? []) {
      const holdings = await snaptrade.accountInformation.getUserHoldings({
        userId: fm.snaptrade_user_id,
        userSecret: fm.snaptrade_user_secret,
        accountId: account.id!,
      });
      positionCount += holdings.data?.positions?.length ?? 0;
    }

    // Dual-write legacy single-broker fields. Use the first authorization's
    // institution name (or accounts fallback) so older readers stay coherent.
    const fallbackName =
      firstBrokerName || accounts.data?.[0]?.institution_name || "Broker";
    await admin
      .from("fund_managers")
      .update({
        broker_connected: true,
        broker_name: fallbackName,
        broker_provider: "snaptrade",
      })
      .eq("id", user.id);

    const successUrl = fromOnboarding
      ? `${origin}/oauth-return?provider=snaptrade`
      : `${origin}/dashboard/connect?connected=true&positions=${positionCount}`;
    return clearOnboardingCookie(NextResponse.redirect(successUrl));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "sync failed";
    return clearOnboardingCookie(
      NextResponse.redirect(
        `${origin}${returnBase}?error=${encodeURIComponent(msg)}`
      )
    );
  }
}
