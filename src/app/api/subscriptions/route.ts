import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

/**
 * Undopl a subscription. Cancels the Stripe sub if it's paid, flips the row
 * to cancelled, and decrements subscriber_count on both portfolio + fund
 * manager. Only the owner of the subscription (user_id === auth user) can
 * cancel it.
 */
export async function DELETE(request: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stripe = getStripe();

  const body = (await request.json().catch(() => ({}))) as {
    subscription_id?: string;
  };
  if (!body.subscription_id) {
    return NextResponse.json(
      { error: "subscription_id required" },
      { status: 400 }
    );
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: sub } = await admin
    .from("subscriptions")
    .select(
      "id, user_id, portfolio_id, fund_manager_id, stripe_subscription_id, status"
    )
    .eq("id", body.subscription_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!sub) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (sub.status === "cancelled") {
    return NextResponse.json({ success: true, already: true });
  }

  // 1) Cancel Stripe subscription if this was a paid sub. Best-effort — a
  //    Stripe failure shouldn't block local cancellation.
  if (sub.stripe_subscription_id) {
    try {
      // Paid subs live on the fund manager's connected account. We stored
      // the subscription id, so we need to cancel via that account.
      const { data: fm } = await admin
        .from("fund_managers")
        .select("stripe_account_id")
        .eq("id", sub.fund_manager_id)
        .maybeSingle();
      if (fm?.stripe_account_id) {
        await stripe.subscriptions.cancel(
          sub.stripe_subscription_id,
          undefined,
          { stripeAccount: fm.stripe_account_id }
        );
      } else {
        await stripe.subscriptions.cancel(sub.stripe_subscription_id);
      }
    } catch (e) {
      console.warn("stripe cancel failed:", e);
    }
  }

  // 2) Flip subscription to cancelled.
  const { error: updateErr } = await admin
    .from("subscriptions")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", sub.id);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // 3) Decrement counts (inline, no RPC dependency). Read-then-write to
  //    clamp at zero.
  const { data: portfolioRow } = await admin
    .from("portfolios")
    .select("subscriber_count")
    .eq("id", sub.portfolio_id)
    .maybeSingle();
  if (portfolioRow) {
    await admin
      .from("portfolios")
      .update({
        subscriber_count: Math.max(0, (portfolioRow.subscriber_count ?? 1) - 1),
      })
      .eq("id", sub.portfolio_id);
  }
  const { data: fmRow } = await admin
    .from("fund_managers")
    .select("subscriber_count")
    .eq("id", sub.fund_manager_id)
    .maybeSingle();
  if (fmRow) {
    await admin
      .from("fund_managers")
      .update({
        subscriber_count: Math.max(0, (fmRow.subscriber_count ?? 1) - 1),
      })
      .eq("id", sub.fund_manager_id);
  }

  return NextResponse.json({ success: true });
}
