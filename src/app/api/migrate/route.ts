import { NextResponse } from "next/server";

/**
 * One-time migration endpoint. Attempts to add the multi-region broker
 * columns to `fund_managers` via a Supabase SQL RPC named `exec_sql`.
 *
 * If that RPC is not installed on your project, run the SQL in
 * `supabase/migrations/001_multi_region_broker.sql` manually in the
 * Supabase SQL editor.
 */
const SQL = `
alter table public.fund_managers add column if not exists region text;
alter table public.fund_managers add column if not exists broker_provider text default 'snaptrade';
alter table public.fund_managers add column if not exists saltedge_customer_id text;
alter table public.fund_managers add column if not exists saltedge_connection_id text;
`.trim();

export async function POST() {
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
