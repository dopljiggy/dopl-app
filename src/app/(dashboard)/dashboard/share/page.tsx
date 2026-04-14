import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import ShareClient from "./share-client";

export default async function SharePage() {
  // Get current user via cookie-based auth
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return <div>not logged in</div>;

  // Use service role to bypass RLS and guarantee we get the data
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: fm } = await admin
    .from("fund_managers")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const { data: portfolios } = await admin
    .from("portfolios")
    .select("name")
    .eq("fund_manager_id", user.id);

  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  // Build share data with fallbacks — NEVER show "set handle first"
  const handle =
    fm?.handle ||
    (user.user_metadata as { handle?: string } | null)?.handle ||
    user.email?.split("@")[0] ||
    "user";
  const displayName =
    fm?.display_name ||
    profile?.full_name ||
    (user.user_metadata as { full_name?: string } | null)?.full_name ||
    "fund manager";
  const subscriberCount = fm?.subscriber_count || 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const portfolioNames = (portfolios || []).map((p: any) => p.name);
  const origin = process.env.NEXT_PUBLIC_APP_URL || "https://dopl-app.vercel.app";

  return (
    <ShareClient
      handle={handle}
      displayName={displayName}
      subscriberCount={subscriberCount}
      portfolioNames={portfolioNames}
      origin={origin}
    />
  );
}
