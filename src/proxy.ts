import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { doplerNeedsOnboarding } from "@/lib/proxy-gates";

/**
 * Gated routes:
 *   /dashboard/*   — fund_manager only (others → /feed)
 *   /feed, /feed/* — subscriber only  (others → /dashboard)
 *   /welcome, /notifications, /settings, /me — any authed user
 *
 * Public (not matched):
 *   /, /login, /signup, /leaderboard, /[handle], /api/*, /_next/*, /auth/*
 */
export async function proxy(request: NextRequest) {
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

  // Unauthed users → /login with ?next={original}
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  // Resolve role: profile first, then auth metadata fallback for race
  // conditions right after signup.
  let role: "fund_manager" | "subscriber" = "subscriber";
  let tradingConnected = false;
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, trading_connected")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.role === "fund_manager") role = "fund_manager";
    else if (profile?.role === "subscriber") role = "subscriber";
    else {
      const metaRole = (user.user_metadata as { role?: string } | null)?.role;
      if (metaRole === "fund_manager") role = "fund_manager";
    }
    tradingConnected = !!profile?.trading_connected;
  } catch {
    const metaRole = (user.user_metadata as { role?: string } | null)?.role;
    if (metaRole === "fund_manager") role = "fund_manager";
  }

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

  if (doplerNeedsOnboarding({ role, tradingConnected, path })) {
    const url = request.nextUrl.clone();
    url.pathname = "/welcome";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/feed/:path*",
    "/welcome",
    "/notifications",
    "/settings",
    "/me",
  ],
};
