import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

/**
 * Idempotent: guarantees the current fund_manager has a fund_managers row.
 * Called from the share page on mount so the card always has real data —
 * the fallback handle is derived from the user's email local-part plus a
 * suffix from their uuid to avoid collisions.
 */
export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  // Only provision rows for fund managers (not doplers).
  const metaRole = (user.user_metadata as { role?: string } | null)?.role;
  const isFundManager =
    profile?.role === "fund_manager" || metaRole === "fund_manager";
  if (!isFundManager) {
    return NextResponse.json({ error: "Not a fund manager" }, { status: 403 });
  }

  // If row exists, just return it.
  const { data: existing } = await supabase
    .from("fund_managers")
    .select("id, handle, display_name, avatar_url, subscriber_count")
    .eq("id", user.id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ fm: existing, created: false });
  }

  const metaHandle = (
    (user.user_metadata as { handle?: string } | null)?.handle ?? ""
  )
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "");
  const metaName =
    (user.user_metadata as { full_name?: string } | null)?.full_name ??
    profile?.full_name ??
    "";
  const emailPrefix = (user.email ?? "user")
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "");

  const fallbackHandle =
    metaHandle || `${emailPrefix}-${user.id.slice(0, 6)}`;

  const admin = createAdminClient();

  // Also ensure a matching profiles row with role set.
  await admin.from("profiles").upsert(
    {
      id: user.id,
      email: user.email ?? "",
      full_name: metaName || null,
      role: "fund_manager",
    },
    { onConflict: "id" }
  );

  // Try a handful of handle variants if the first is taken.
  let handle = fallbackHandle;
  let inserted: {
    id: string;
    handle: string;
    display_name: string;
    avatar_url: string | null;
    subscriber_count: number;
  } | null = null;

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate =
      attempt === 0 ? handle : `${handle}-${user.id.slice(6 + attempt, 10 + attempt)}`;
    const { data, error } = await admin
      .from("fund_managers")
      .insert({
        id: user.id,
        handle: candidate,
        display_name: metaName || candidate,
      })
      .select("id, handle, display_name, avatar_url, subscriber_count")
      .maybeSingle();

    if (!error && data) {
      inserted = data;
      handle = candidate;
      break;
    }
    // If the error isn't a handle collision, bail.
    if (error && !/unique|duplicate/i.test(error.message)) {
      console.error("fund_managers insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (!inserted) {
    return NextResponse.json(
      { error: "could not generate a unique handle" },
      { status: 500 }
    );
  }

  return NextResponse.json({ fm: inserted, created: true });
}
