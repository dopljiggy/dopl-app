import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const stripe = getStripe();
  const supabaseAdmin = createAdminClient();
  const body = await request.text();
  const signature = request.headers.get("stripe-signature")!;

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook error: ${err.message}` }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as any;
      const { portfolio_id, user_id, fund_manager_id } = session.subscription_data?.metadata || session.metadata || {};

      if (portfolio_id && user_id) {
        // Create subscription record
        await supabaseAdmin.from("subscriptions").insert({
          user_id,
          portfolio_id,
          fund_manager_id,
          stripe_subscription_id: session.subscription,
          status: "active",
          price_cents: session.amount_total,
        });

        // Increment subscriber counts
        await supabaseAdmin.rpc("increment_subscriber_count", {
          p_portfolio_id: portfolio_id,
          p_fund_manager_id: fund_manager_id,
        });
      }
      break;
    }

    case "account.updated": {
      const account = event.data.object as { id: string; details_submitted?: boolean; charges_enabled?: boolean };
      const onboarded = !!(account.details_submitted && account.charges_enabled);
      await supabaseAdmin
        .from("fund_managers")
        .update({ stripe_onboarded: onboarded })
        .eq("stripe_account_id", account.id);
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as any;
      await supabaseAdmin
        .from("subscriptions")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
        .eq("stripe_subscription_id", subscription.id);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
