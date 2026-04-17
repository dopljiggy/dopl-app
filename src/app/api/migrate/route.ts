import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

/**
 * One-time migration endpoint. Attempts to add the multi-region broker
 * columns to `fund_managers` via a Supabase SQL RPC named `exec_sql`.
 *
 * Gated behind MIGRATION_ADMIN_TOKEN. Call with
 *   curl -X POST -H "Authorization: Bearer $MIGRATION_ADMIN_TOKEN" \
 *        https://dopl-app.vercel.app/api/migrate
 *
 * If the `exec_sql` RPC is not installed on your project, run the SQL in
 * `supabase/migrations/001_multi_region_broker.sql` manually in the
 * Supabase SQL editor instead.
 */
const SQL = `
alter table public.fund_managers add column if not exists region text;
alter table public.fund_managers add column if not exists broker_provider text default 'snaptrade';
alter table public.fund_managers add column if not exists saltedge_customer_id text;
alter table public.fund_managers add column if not exists saltedge_connection_id text;
`.trim();

function authorize(request: Request): NextResponse | null {
  const expected = process.env.MIGRATION_ADMIN_TOKEN;
  if (!expected) {
    // Don't leak the gate mechanism or env-var name to unauthenticated callers.
    console.error(
      "[/api/migrate] MIGRATION_ADMIN_TOKEN is not configured — refusing to serve"
    );
    return NextResponse.json(
      { error: "server misconfigured" },
      { status: 500 }
    );
  }

  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const provided = match?.[1] ?? "";

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!timingSafeEqual(expectedBuf, providedBuf)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}

export async function POST(request: Request) {
  const denial = authorize(request);
  if (denial) return denial;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "missing supabase env" }, { status: 500 });
  }

  try {
    const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql: SQL }),
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        {
          ok: false,
          note:
            "exec_sql RPC not available — run supabase/migrations/001_multi_region_broker.sql in the SQL editor",
          detail: text,
        },
        { status: 200 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "migration failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
