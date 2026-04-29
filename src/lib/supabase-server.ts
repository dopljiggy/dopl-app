import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}

/**
 * Cached server-side auth helper. Returns BOTH the supabase client and the
 * authenticated user — callers can re-use the client for follow-up reads
 * without paying for a second `createServerSupabase()` + `getUser()` round
 * trip. React's `cache()` deduplicates within a single server request, so
 * a page + its layout share one auth call.
 */
export const getCachedUser = cache(async () => {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
});
