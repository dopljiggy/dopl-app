import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { fanOutFmEvent } from "@/lib/notification-fanout";

/**
 * Undopl a subscription. Cancels the Stripe sub if it's paid, flips the row
 * to cancelled, decrements subscriber_count on both portfolio + fund
 * manager, then fires an FM-side `subscription_cancelled` notification
 * (gated on all three DB writes succeeding). Only the owner of the
 * subscription (user_id === auth user) can cancel it.
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

  // Fetch BEFORE any mutation so we have the full context for fanout and
  // can short-circuit if already cancelled.
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

  // Pre-fetch portfolio + FM + dopler profile so the fanout payload has
  // everything it needs after the DB mutations succeed.
  const { data: portfolio } = await admin
    .from("portfolios")
    .select("id, name, tier, price_cents, subscriber_count")
    .eq("id", sub.portfolio_id)
    .maybeSingle();

  const { data: fmRow } = await admin
    .from("fund_managers")
    .select("subscriber_count, stripe_account_id")
    .eq("id", sub.fund_manager_id)
    .maybeSingle();

  const { data: doplerProfile } = await admin
    .from("profiles")
    .select("full_name, email")
    .eq("id", sub.user_id)
    .maybeSingle();

  // ---- DB mutations (all gated for fanout) ----
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

  if (portfolio) {
    const { error: decErr } = await admin
      .from("portfolios")
      .update({
        subscriber_count: Math.max(
          0,
          ((portfolio.subscriber_count as number | null) ?? 1) - 1
        ),
      })
      .eq("id", sub.portfolio_id);
    if (decErr) {
      return NextResponse.json({ error: decErr.message }, { status: 500 });
    }
  }

  if (fmRow) {
    const { error: decErr } = await admin
      .from("fund_managers")
      .update({
        subscriber_count: Math.max(
          0,
          ((fmRow.subscriber_count as number | null) ?? 1) - 1
        ),
      })
      .eq("id", sub.fund_manager_id);
    if (decErr) {
      return NextResponse.json({ error: decErr.message }, { status: 500 });
    }
  }

  // ---- Stripe cancel (best-effort, NOT gated) ----
  // A Stripe failure shouldn't block local cancellation or the FM fanout.
  // The user-facing DB state is already correct; Stripe-side state can be
  // reconciled later from the FM's dashboard.
  if (sub.stripe_subscription_id) {
    try {
      if (fmRow?.stripe_account_id) {
        await stripe.subscriptions.cancel(
          sub.stripe_subscription_id,
          undefined,
          { stripeAccount: fmRow.stripe_account_id as string }
        );
      } else {
        await stripe.subscriptions.cancel(sub.stripe_subscription_id);
      }
    } catch (e) {
      console.warn("stripe cancel failed:", e);
    }
  }

  // ---- Fanout — all three step-2 mutations succeeded if we got here ----
  const doplerHandle =
    ((doplerProfile?.full_name as string | null) ?? "").trim() ||
    ((doplerProfile?.email as string | null) ?? "").split("@")[0] ||
    "a dopler";

  await fanOutFmEvent(admin, {
    fund_manager_id: sub.fund_manager_id as string,
    portfolio_id: sub.portfolio_id as string,
    portfolio_name:
      (portfolio?.name as string | undefined) ?? "your portfolio",
    dopler_user_id: sub.user_id as string,
    dopler_handle: doplerHandle,
    tier: (portfolio?.tier as string | undefined) ?? "",
    price_cents: (portfolio?.price_cents as number | undefined) ?? null,
    subscription_id: sub.id as string,
    event: "subscription_cancelled",
  });

  return NextResponse.json({ success: true });
}
