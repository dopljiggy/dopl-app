import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createServerSupabase } from "@/lib/supabase-server";

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
    // Create or retrieve Stripe Connect account
    const { data: fm } = await supabase
      .from("fund_managers")
      .select("stripe_account_id")
      .eq("id", user.id)
      .single();

    let accountId = fm?.stripe_account_id;

    if (!accountId) {
      // business_type: "individual" skips the UAE-heavy business-docs flow
      // (trade license, memorandum of association, etc.) and sends the FM
      // through personal ID verification instead. Dopl's model is
      // individual fund managers — LLC/company FMs can still switch
      // business_type inside Stripe's hosted flow if needed.
      const account = await stripe.accounts.create({
        type: "express",
        business_type: "individual",
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
