import { NextResponse } from "next/server";
import { getStripe, DOPL_FEE_PERCENT } from "@/lib/stripe";
import { createServerSupabase } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { portfolioId } = await request.json();

  // Get portfolio and fund manager details
  const { data: portfolio } = await supabase
    .from("portfolios")
    .select("*, fund_managers!inner(stripe_account_id, display_name, handle)")
    .eq("id", portfolioId)
    .single();

  if (!portfolio || !portfolio.fund_managers?.stripe_account_id) {
    return NextResponse.json({ error: "Portfolio not found or payments not set up" }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${portfolio.name} by ${portfolio.fund_managers.display_name}`,
              description: portfolio.description || undefined,
            },
            unit_amount: portfolio.price_cents,
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      subscription_data: {
        application_fee_percent: DOPL_FEE_PERCENT,
        metadata: {
          portfolio_id: portfolioId,
          user_id: user.id,
          fund_manager_id: portfolio.fund_manager_id,
        },
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/feed/${portfolioId}?subscribed=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/${portfolio.fund_managers.handle}`,
    }, {
      stripeAccount: portfolio.fund_managers.stripe_account_id,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
