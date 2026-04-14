import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createServerSupabase } from "@/lib/supabase-server";

export async function POST() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Create or retrieve Stripe Connect account
    const { data: fm } = await supabase
      .from("fund_managers")
      .select("stripe_account_id")
      .eq("id", user.id)
      .single();

    let accountId = fm?.stripe_account_id;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
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
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?success=true`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
