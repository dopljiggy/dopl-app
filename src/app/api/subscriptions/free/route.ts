import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

/**
 * Create a no-cost subscription for a free-tier portfolio.
 * Verifies the portfolio's tier = 'free', prevents duplicates, and
 * increments subscriber counts server-side via the shared RPC.
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { portfolio_id } = (await request.json()) as {
    portfolio_id?: string;
  };
  if (!portfolio_id) {
    return NextResponse.json({ error: "portfolio_id required" }, { status: 400 });
  }

  // Verify portfolio is free and active.
  const { data: portfolio, error: portErr } = await supabase
    .from("portfolios")
    .select("id, tier, price_cents, fund_manager_id, is_active, name")
    .eq("id", portfolio_id)
    .maybeSingle();
  if (portErr || !portfolio) {
    return NextResponse.json({ error: "portfolio not found" }, { status: 404 });
  }
  if (!portfolio.is_active) {
    return NextResponse.json({ error: "portfolio not active" }, { status: 400 });
  }
  if (portfolio.tier !== "free" || portfolio.price_cents !== 0) {
    return NextResponse.json(
      { error: "this portfolio is not free" },
      { status: 400 }
    );
  }

  // Prevent an owner from "dopling" their own portfolio.
  if (portfolio.fund_manager_id === user.id) {
    return NextResponse.json(
      { error: "you can't dopl your own portfolio" },
      { status: 400 }
    );
  }

  // Idempotent: if already subscribed, return success.
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("portfolio_id", portfolio_id)
    .maybeSingle();

  if (existing && existing.status === "active") {
    return NextResponse.json({ ok: true, already_subscribed: true });
  }

  // Use admin client to side-step RLS on INSERT + RPC counter bump.
  const admin = createAdminClient();

  if (existing) {
    // Reactivate a cancelled subscription rather than creating a duplicate.
    const { error } = await admin
      .from("subscriptions")
      .update({ status: "active", cancelled_at: null, price_cents: 0 })
      .eq("id", existing.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await admin.from("subscriptions").insert({
      user_id: user.id,
      portfolio_id,
      fund_manager_id: portfolio.fund_manager_id,
      stripe_subscription_id: null,
      status: "active",
      price_cents: 0,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    // Only bump counts on a fresh subscription.
    await admin.rpc("increment_subscriber_count", {
      p_portfolio_id: portfolio_id,
      p_fund_manager_id: portfolio.fund_manager_id,
    });

    // Inbound notification for the fund manager: "new dopler subscribed".
    const { data: doplerProfile } = await admin
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle();
    const doplerName =
      (doplerProfile?.full_name as string | null) ||
      (doplerProfile?.email as string | null)?.split("@")[0] ||
      "a new dopler";
    await admin.from("notifications").insert({
      user_id: portfolio.fund_manager_id,
      portfolio_update_id: null,
      title: `new dopler on ${portfolio.name}`,
      body: `${doplerName} just dopled your portfolio`,
    });
  }

  return NextResponse.json({ ok: true, portfolio_name: portfolio.name });
}
