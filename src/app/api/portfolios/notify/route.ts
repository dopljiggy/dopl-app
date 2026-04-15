import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

/**
 * Fan out a portfolio-update notification to every active dopler of the
 * given portfolio. Triggered explicitly by the fund manager from the
 * portfolios page once they've confirmed a position change.
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    portfolio_id: string;
    update_type?: "position_added" | "position_removed" | "rebalanced" | "note";
    description: string;
    thesis_note?: string | null;
  };
  if (!body.portfolio_id || !body.description) {
    return NextResponse.json(
      { error: "portfolio_id and description required" },
      { status: 400 }
    );
  }

  // Ownership check.
  const { data: portfolio } = await supabase
    .from("portfolios")
    .select("id, name, fund_manager_id")
    .eq("id", body.portfolio_id)
    .maybeSingle();
  if (!portfolio || portfolio.fund_manager_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: pu, error: puErr } = await admin
    .from("portfolio_updates")
    .insert({
      portfolio_id: body.portfolio_id,
      fund_manager_id: user.id,
      update_type: body.update_type ?? "note",
      description: body.description,
      thesis_note: body.thesis_note ?? null,
    })
    .select("id")
    .single();

  if (puErr || !pu) {
    return NextResponse.json(
      { error: puErr?.message ?? "could not log update" },
      { status: 500 }
    );
  }

  const { data: subs } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("portfolio_id", body.portfolio_id)
    .eq("status", "active");

  const rows =
    subs?.map((s) => ({
      user_id: (s as { user_id: string }).user_id,
      portfolio_update_id: pu.id,
      title: portfolio.name,
      body: body.description,
    })) ?? [];

  if (rows.length) {
    const { error } = await admin.from("notifications").insert(rows);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, notified: rows.length });
}
