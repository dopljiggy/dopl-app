import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase-admin";
import { fanOutFmEvent } from "@/lib/notification-fanout";

export async function POST(request: Request) {
  const stripe = getStripe();
  const supabaseAdmin = createAdminClient();
  const body = await request.text();
  const signature = request.headers.get("stripe-signature")!;

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    return NextResponse.json(
      { error: `Webhook error: ${err.message}` },
      { status: 400 }
    );
  }

  switch (event.type) {
    case "checkout.session.completed": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const session = event.data.object as any;
      const metadata =
        session.subscription_data?.metadata || session.metadata || {};
      const { portfolio_id, user_id, fund_manager_id } = metadata as {
        portfolio_id?: string;
        user_id?: string;
        fund_manager_id?: string;
      };

      if (!portfolio_id || !user_id || !session.subscription) break;

      // Idempotency guard: if we've already processed this
      // stripe_subscription_id, return 200 without double-insert or
      // double-fanout. Backed by the UNIQUE constraint added in migration
      // 004 so the check-then-insert is race-safe under concurrent Stripe
      // retries (Task 2.5a).
      const { data: existingSub } = await supabaseAdmin
        .from("subscriptions")
        .select("id")
        .eq("stripe_subscription_id", session.subscription)
        .maybeSingle();
      if (existingSub) {
        return NextResponse.json({ received: true });
      }

      const { data: insertedSub, error: insertErr } = await supabaseAdmin
        .from("subscriptions")
        .insert({
          user_id,
          portfolio_id,
          fund_manager_id,
          stripe_subscription_id: session.subscription,
          status: "active",
          price_cents: session.amount_total,
        })
        .select("id")
        .single();
      if (insertErr || !insertedSub) {
        // UNIQUE-constraint race (another concurrent delivery beat us).
        // The other delivery already inserted + fanned out — treat as
        // idempotent success.
        return NextResponse.json({ received: true });
      }

      await supabaseAdmin.rpc("increment_subscriber_count", {
        p_portfolio_id: portfolio_id,
        p_fund_manager_id: fund_manager_id,
      });

      const { data: portfolio } = await supabaseAdmin
        .from("portfolios")
        .select("id, name, tier, price_cents, fund_manager_id")
        .eq("id", portfolio_id)
        .maybeSingle();
      const { data: dopler } = await supabaseAdmin
        .from("profiles")
        .select("full_name, email")
        .eq("id", user_id)
        .maybeSingle();

      await fanOutFmEvent(supabaseAdmin, {
        fund_manager_id:
          (portfolio?.fund_manager_id as string | undefined) ??
          fund_manager_id ??
          "",
        portfolio_id,
        portfolio_name:
          (portfolio?.name as string | undefined) ?? "your portfolio",
        dopler_user_id: user_id,
        dopler_handle:
          ((dopler?.full_name as string | null) ?? "").trim() ||
          ((dopler?.email as string | null) ?? "").split("@")[0] ||
          "a new dopler",
        tier: (portfolio?.tier as string | undefined) ?? "",
        price_cents: (portfolio?.price_cents as number | undefined) ?? null,
        subscription_id: insertedSub.id as string,
        event: "subscription_added",
      });
      break;
    }

    case "account.updated": {
      const account = event.data.object as {
        id: string;
        details_submitted?: boolean;
        charges_enabled?: boolean;
      };
      const onboarded = !!(
        account.details_submitted && account.charges_enabled
      );
      await supabaseAdmin
        .from("fund_managers")
        .update({ stripe_onboarded: onboarded })
        .eq("stripe_account_id", account.id);
      break;
    }

    case "customer.subscription.deleted": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subscription = event.data.object as any;

      // Read the row + portfolio details BEFORE the status flip so we can
      // short-circuit if already cancelled (idempotency) and have the meta
      // needed for the fanout after the mutation.
      const { data: subRow } = await supabaseAdmin
        .from("subscriptions")
        .select(
          "id, user_id, status, portfolio_id, fund_manager_id"
        )
        .eq("stripe_subscription_id", subscription.id)
        .maybeSingle();

      if (!subRow) break;
      if (subRow.status === "cancelled") {
        // Idempotent: already processed — Stripe is retrying.
        return NextResponse.json({ received: true });
      }

      const { error: updateErr } = await supabaseAdmin
        .from("subscriptions")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", subscription.id);
      if (updateErr) {
        return NextResponse.json(
          { error: updateErr.message },
          { status: 500 }
        );
      }

      // Decrement counters on both the portfolio and the fund manager.
      // Gate the fanout on these succeeding — if either decrement errors,
      // return 5xx so Stripe retries; the idempotent early-return above
      // short-circuits the second delivery cleanly.
      const { data: portfolioRow } = await supabaseAdmin
        .from("portfolios")
        .select("subscriber_count, name, tier, price_cents")
        .eq("id", subRow.portfolio_id)
        .maybeSingle();
      if (portfolioRow) {
        const { error: decErr } = await supabaseAdmin
          .from("portfolios")
          .update({
            subscriber_count: Math.max(
              0,
              ((portfolioRow.subscriber_count as number | null) ?? 1) - 1
            ),
          })
          .eq("id", subRow.portfolio_id);
        if (decErr) {
          return NextResponse.json(
            { error: decErr.message },
            { status: 500 }
          );
        }
      }

      const { data: fmRow } = await supabaseAdmin
        .from("fund_managers")
        .select("subscriber_count")
        .eq("id", subRow.fund_manager_id)
        .maybeSingle();
      if (fmRow) {
        const { error: decErr } = await supabaseAdmin
          .from("fund_managers")
          .update({
            subscriber_count: Math.max(
              0,
              ((fmRow.subscriber_count as number | null) ?? 1) - 1
            ),
          })
          .eq("id", subRow.fund_manager_id);
        if (decErr) {
          return NextResponse.json(
            { error: decErr.message },
            { status: 500 }
          );
        }
      }

      // Do NOT call stripe.subscriptions.cancel here — Stripe itself
      // initiated this event, so the upstream cancel has already happened.

      const { data: dopler } = await supabaseAdmin
        .from("profiles")
        .select("full_name, email")
        .eq("id", subRow.user_id)
        .maybeSingle();

      await fanOutFmEvent(supabaseAdmin, {
        fund_manager_id: subRow.fund_manager_id as string,
        portfolio_id: subRow.portfolio_id as string,
        portfolio_name:
          (portfolioRow?.name as string | undefined) ?? "your portfolio",
        dopler_user_id: subRow.user_id as string,
        dopler_handle:
          ((dopler?.full_name as string | null) ?? "").trim() ||
          ((dopler?.email as string | null) ?? "").split("@")[0] ||
          "a dopler",
        tier: (portfolioRow?.tier as string | undefined) ?? "",
        price_cents:
          (portfolioRow?.price_cents as number | undefined) ?? null,
        subscription_id: subRow.id as string,
        event: "subscription_cancelled",
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
