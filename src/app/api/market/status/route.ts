import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getMarketStatus } from "@/lib/finnhub";

/**
 * GET /api/market/status
 * Returns US market open/closed status for the FM trading terminal badge.
 */
export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const status = await getMarketStatus();
    return NextResponse.json(status);
  } catch {
    // Treat outage as "closed" so the UI doesn't show a stale "open" badge.
    return NextResponse.json({ isOpen: false, exchange: "US" });
  }
}
