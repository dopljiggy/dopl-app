import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  fanOutPortfolioUpdate,
  type FanoutChange,
} from "@/lib/notification-fanout";

type NotifyBody = {
  portfolio_id: string;
  description?: string;
  thesis_note?: string | null;
  changes?: FanoutChange[];
};

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as NotifyBody;
  if (!body.portfolio_id) {
    return NextResponse.json(
      { error: "portfolio_id required" },
      { status: 400 }
    );
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

  try {
    const result = await fanOutPortfolioUpdate(createAdminClient(), {
      portfolio_id: body.portfolio_id,
      fund_manager_id: user.id,
      changes: body.changes ?? [],
      description: body.description,
      thesis_note: body.thesis_note ?? null,
    });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "fan-out failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
