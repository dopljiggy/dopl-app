import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Routing rules (profile-based, with user_metadata as fallback for race
 * conditions right after signup where the profile row may not yet be
 * readable via RLS):
 *
 *   /dashboard/*   → fund_manager only (else → /feed)
 *   /feed/*        → subscriber only (else → /dashboard)
 *   /signup, /login — when authed, redirect by role
 *   All others — no gating here
 */
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isDashboard = path.startsWith("/dashboard");
  const isFeed = path === "/feed" || path.startsWith("/feed/");
  const isAuthPage = path === "/login" || path === "/signup";

  // Unauthed users trying to access gated routes → login.
  if ((isDashboard || isFeed) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  if (!user) return supabaseResponse;

  // Resolve role: prefer profiles.role, fall back to auth metadata so we
  // don't bounce new users just because their profile row is stale or was
  // created without a role.
  let role: "fund_manager" | "subscriber" | null = null;
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.role === "fund_manager" || profile?.role === "subscriber") {
      role = profile.role;
    }
  } catch {
    // Ignore — fall through to metadata.
  }
  if (!role) {
    const metaRole = (user.user_metadata as { role?: string } | null)?.role;
    if (metaRole === "fund_manager") role = "fund_manager";
    else role = "subscriber";
  }

  // Authed users visiting /login or /signup get bounced to their home.
  if (isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = role === "fund_manager" ? "/dashboard" : "/feed";
    return NextResponse.redirect(url);
  }

  // Role-based routing.
  if (isDashboard && role === "subscriber") {
    const url = request.nextUrl.clone();
    url.pathname = "/feed";
    return NextResponse.redirect(url);
  }
  if (isFeed && role === "fund_manager") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/dashboard/:path*", "/feed/:path*", "/login", "/signup"],
};
