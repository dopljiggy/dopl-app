import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { searchTickers } from "@/lib/finnhub";

/**
 * GET /api/market/search?q=AAP
 * Returns ticker autocomplete suggestions (Common Stock only).
 * Authed — surface is FM-only.
 */
export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ results: [] });

  try {
    const results = await searchTickers(q);
    return NextResponse.json({
      results: results.map((r) => ({
        symbol: r.symbol,
        description: r.description,
      })),
    });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
