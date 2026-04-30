import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createServerSupabase } from "@/lib/supabase-server";

// Map FM `region` → Stripe Connect country (ISO 3166-1 alpha-2).
// Required because Stripe defaults Express account country to the
// platform's country of registration (UAE for dopl), which means
// every FM ended up in AE regardless of their actual region.
// `europe` is a multi-country bucket; Netherlands is the chosen default
// (Stripe Express supported, central in EU, common FM base).
const COUNTRY_BY_REGION: Record<string, string> = {
  us_canada: "US",
  uk: "GB",
  europe: "NL",
  uae: "AE",
  australia: "AU",
  india: "IN",
  other: "US",
};

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let from: string | undefined;
  try {
    const body = (await request.json().catch(() => ({}))) as { from?: string };
    from = body?.from;
  } catch {
    from = undefined;
  }
  const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  const returnBase = from === "onboarding" ? "/onboarding" : "/dashboard/billing";
  // Sprint 4: onboarding-flow hands off through /oauth-return so the pre-
  // opened tab can close itself. Settings/billing flow keeps its original
  // self-tab destination.
  const successUrl =
    from === "onboarding"
      ? `${origin}/oauth-return?provider=stripe`
      : `${origin}${returnBase}?stripe_done=true`;

  try {
    const stripe = getStripe();
    const { data: fm } = await supabase
      .from("fund_managers")
      .select("stripe_account_id, stripe_onboarded, region")
      .eq("id", user.id)
      .single();

    const desiredCountry =
      COUNTRY_BY_REGION[fm?.region ?? "other"] ?? "US";

    let accountId = fm?.stripe_account_id;

    // If an unverified account exists with a mismatched country (e.g. the
    // old AE default, or FM changed region mid-onboarding), delete it and
    // recreate with the correct country. Never touch already-onboarded
    // accounts — those have live payouts attached.
    if (accountId && !fm?.stripe_onboarded) {
      try {
        const existing = await stripe.accounts.retrieve(accountId);
        if (existing.country !== desiredCountry) {
          await stripe.accounts.del(accountId).catch(() => {});
          accountId = null;
          await supabase
            .from("fund_managers")
            .update({ stripe_account_id: null })
            .eq("id", user.id);
        }
      } catch {
        // Account no longer exists in Stripe; clear and recreate.
        accountId = null;
        await supabase
          .from("fund_managers")
          .update({ stripe_account_id: null })
          .eq("id", user.id);
      }
    }

    if (!accountId) {
      const INDIVIDUAL_COUNTRIES = new Set(["US", "GB", "NL", "AU", "IN"]);
      const account = await stripe.accounts.create({
        type: "express",
        country: desiredCountry,
        ...(INDIVIDUAL_COUNTRIES.has(desiredCountry)
          ? { business_type: "individual" as const }
          : {}),
        metadata: { dopl_user_id: user.id },
      });
      accountId = account.id;

      await supabase
        .from("fund_managers")
        .update({ stripe_account_id: accountId })
        .eq("id", user.id);
    }

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}${returnBase}`,
      return_url: successUrl,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
