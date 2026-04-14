import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

/**
 * Bulk-update custom allocation_pct across the positions in one portfolio.
 * Only the portfolio's fund manager can edit.
 */
export async function PATCH(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    portfolio_id: string;
    allocations: { id: string; allocation_pct: number }[];
  };
  if (!body.portfolio_id || !Array.isArray(body.allocations)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  // Ownership check.
  const { data: portfolio } = await supabase
    .from("portfolios")
    .select("id, fund_manager_id")
    .eq("id", body.portfolio_id)
    .maybeSingle();
  if (!portfolio || portfolio.fund_manager_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Update each position. We don't do this in a transaction because RLS
  // already restricts to this portfolio's fund_manager.
  const errors: string[] = [];
  for (const a of body.allocations) {
    const pct = Math.max(0, Math.min(100, Number(a.allocation_pct) || 0));
    const { error } = await supabase
      .from("positions")
      .update({ allocation_pct: pct })
      .eq("id", a.id)
      .eq("portfolio_id", body.portfolio_id);
    if (error) errors.push(error.message);
  }

  if (errors.length) {
    return NextResponse.json({ error: errors.join("; ") }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
