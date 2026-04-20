import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

interface ProvisionBody {
  role: "fund_manager" | "subscriber";
  full_name?: string;
  handle?: string;
}

/**
 * Creates the profile row (with role) and, for fund managers, the
 * fund_managers row. Called from the signup client immediately after
 * signUp → signInWithPassword. Uses the service role key to bypass RLS so
 * the initial provisioning works even before the session propagates.
 */
export async function POST(request: Request) {
  // Verify the caller is authenticated — we won't provision anonymously.
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as ProvisionBody;
  const role: "fund_manager" | "subscriber" =
    body.role === "fund_manager" ? "fund_manager" : "subscriber";
  const fullName = body.full_name?.trim() || null;
  const handle = body.handle?.trim().toLowerCase() || null;

  const admin = createAdminClient();

  // Upsert profile — the DB trigger may have already inserted a row without
  // role, so we overwrite role/full_name here.
  const { error: profileErr } = await admin.from("profiles").upsert(
    {
      id: user.id,
      email: user.email ?? "",
      full_name: fullName,
      role,
    },
    { onConflict: "id" }
  );
  if (profileErr) {
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }

  // Fund manager provisioning.
  if (role === "fund_manager") {
    if (!handle) {
      return NextResponse.json(
        { error: "handle is required for fund managers" },
        { status: 400 }
      );
    }

    const { data: existing } = await admin
      .from("fund_managers")
      .select("id, handle")
      .eq("id", user.id)
      .maybeSingle();

    if (!existing) {
      // Check handle availability before inserting.
      const { data: handleTaken } = await admin
        .from("fund_managers")
        .select("id")
        .eq("handle", handle)
        .maybeSingle();
      if (handleTaken) {
        return NextResponse.json(
          { error: "that handle is taken" },
          { status: 409 }
        );
      }

      const { error: fmErr } = await admin.from("fund_managers").insert({
        id: user.id,
        handle,
        display_name: fullName || handle,
      });
      if (fmErr) {
        return NextResponse.json(
          {
            error: fmErr.message.includes("unique")
              ? "that handle is taken"
              : fmErr.message,
          },
          { status: 400 }
        );
      }
    }
  }

  return NextResponse.json({
    ok: true,
    role,
    needs_onboarding: role === "fund_manager",
  });
}
