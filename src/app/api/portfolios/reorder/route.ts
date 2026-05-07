import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

/**
 * Sprint 17: bulk-update display_order on a set of portfolios so the
 * FM's custom drag/arrow-reorder persists. The caller passes the full
 * set being reordered — we trust the order in the array and re-stamp
 * display_order = index + 1 for every row, which keeps numbering
 * dense and stable across operations.
 *
 * Ownership check is per-row: every id in the body must belong to
 * the authenticated FM, otherwise 403. RLS would already block the
 * update (portfolios policy = `fund_manager_id = auth.uid()`) but
 * the explicit check returns a cleaner error.
 */

interface ReorderBody {
  order: { id: string; display_order: number }[];
}

export async function PATCH(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ReorderBody;
  try {
    body = (await request.json()) as ReorderBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.order) || body.order.length === 0) {
    return NextResponse.json(
      { error: "order array required" },
      { status: 400 }
    );
  }

  const ids = body.order.map((o) => o.id);
  const admin = createAdminClient();

  // Ownership check on every id. Anything not owned by this FM short-
  // circuits the whole batch — partial writes would leave the order
  // inconsistent.
  const { data: ownership } = await admin
    .from("portfolios")
    .select("id, fund_manager_id")
    .in("id", ids);
  const ownerOk =
    (ownership ?? []).length === ids.length &&
    (ownership ?? []).every(
      (p) => (p as { fund_manager_id: string }).fund_manager_id === user.id
    );
  if (!ownerOk) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Per-row update. Postgres has no batch-update-with-different-values
  // primitive without a CASE expression or a values list — the row
  // count is small (FM portfolios), so N round trips is fine.
  for (const row of body.order) {
    await admin
      .from("portfolios")
      .update({ display_order: row.display_order })
      .eq("id", row.id);
  }

  return NextResponse.json({ ok: true, updated: body.order.length });
}
