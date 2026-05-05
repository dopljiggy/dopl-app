import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { syncAllConnections } from "@/lib/sync-connection";

/**
 * Sync every active broker_connection for the FM in one call.
 * Used by the "Sync All" button on /dashboard/connect and the
 * positions page. Iterates connections in order; per-connection
 * failures don't block siblings.
 */
export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const results = await syncAllConnections(admin, user.id);

  const upserted = results.reduce((a, r) => a + r.upserted, 0);
  const sold = results.reduce((a, r) => a + r.sold, 0);
  const errored = results.filter((r) => r.errored).length;

  return NextResponse.json({
    results,
    count: upserted,
    sold,
    errored,
  });
}
