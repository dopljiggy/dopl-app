import { NextResponse, type NextRequest } from "next/server";
import { snaptrade } from "@/lib/snaptrade";
import { createServerSupabase } from "@/lib/supabase-server";

/**
 * SnapTrade Connect redirects here after the user finishes authenticating
 * with their broker (we pass this URL as `customRedirect` in /api/snaptrade/connect).
 * We run a sync immediately so the user lands back on /dashboard/connect with
 * positions already in the DB, then redirect them there.
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

  // If the user cancelled / the connection failed, bounce back cleanly.
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

  // Pull accounts + holdings and upsert a minimal broker-connected state.
  try {
    const accounts = await snaptrade.accountInformation.listUserAccounts({
      userId: fm.snaptrade_user_id,
      userSecret: fm.snaptrade_user_secret,
    });

    let positionCount = 0;
    for (const account of accounts.data ?? []) {
      const holdings = await snaptrade.accountInformation.getUserHoldings({
        userId: fm.snaptrade_user_id,
        userSecret: fm.snaptrade_user_secret,
        accountId: account.id!,
      });
      positionCount += holdings.data?.positions?.length ?? 0;
    }

    await supabase
      .from("fund_managers")
      .update({
        broker_connected: true,
        broker_name: accounts.data?.[0]?.institution_name ?? "Broker",
      })
      .eq("id", user.id);

    const successUrl = fromOnboarding
      ? `${origin}/onboarding?connected=true`
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
