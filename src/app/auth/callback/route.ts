import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase-server";

/**
 * Supabase magic-link callback.
 *
 * Depending on project config, the link may arrive as either:
 *   - PKCE:   /auth/callback?code=<code>
 *   - OTP:    /auth/callback?token_hash=<hash>&type=<email|magiclink|...>
 *
 * We handle both, then provision the profile + fund_manager row from the
 * signup metadata and redirect to /dashboard (fund_manager) or /feed
 * (subscriber).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = url.searchParams.get("next");
  const errDesc =
    url.searchParams.get("error_description") ||
    url.searchParams.get("error");

  // Surface provider-side errors (expired link, etc) back to the user.
  if (errDesc) {
    return NextResponse.redirect(
      `${url.origin}/login?error=${encodeURIComponent(errDesc)}`
    );
  }

  const supabase = await createServerSupabase();

  // Exchange whichever token shape we got for a session cookie.
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        `${url.origin}/login?error=${encodeURIComponent(error.message)}`
      );
    }
  } else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (error) {
      return NextResponse.redirect(
        `${url.origin}/login?error=${encodeURIComponent(error.message)}`
      );
    }
  } else {
    // Neither token shape present — link was malformed or already consumed.
    return NextResponse.redirect(
      `${url.origin}/login?error=${encodeURIComponent(
        "invalid or expired link — try again"
      )}`
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      `${url.origin}/login?error=${encodeURIComponent("session not set")}`
    );
  }

  const meta = (user.user_metadata ?? {}) as {
    role?: "fund_manager" | "subscriber";
    handle?: string;
    full_name?: string;
  };

  const desiredRole: "fund_manager" | "subscriber" =
    meta.role === "fund_manager" ? "fund_manager" : "subscriber";

  // Upsert profile with role. The DB trigger creates the row on signup but
  // doesn't capture role, so we set it here.
  await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email ?? "",
      full_name: meta.full_name ?? null,
      role: desiredRole,
    },
    { onConflict: "id" }
  );

  // First-time fund_manager signup: create their fund_managers row.
  if (desiredRole === "fund_manager" && meta.handle) {
    const { data: existingFm } = await supabase
      .from("fund_managers")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!existingFm) {
      const { error: fmError } = await supabase.from("fund_managers").insert({
        id: user.id,
        handle: meta.handle,
        display_name: meta.full_name || meta.handle,
      });

      if (fmError) {
        return NextResponse.redirect(
          `${url.origin}/signup?error=${encodeURIComponent(
            "that handle is taken — try another"
          )}`
        );
      }
    }
  }

  // Figure out where to land.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role ?? desiredRole;
  const target =
    next && next.startsWith("/")
      ? next
      : role === "fund_manager"
      ? "/dashboard"
      : "/feed";

  return NextResponse.redirect(`${url.origin}${target}`);
}
