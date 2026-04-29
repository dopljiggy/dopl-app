import { getCachedUser } from "@/lib/supabase-server";
import MarketingLanding, { type Viewer } from "./marketing-landing";

export default async function LandingPage() {
  const { supabase, user } = await getCachedUser();

  let viewer: Viewer = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .maybeSingle();

    const role =
      profile?.role === "fund_manager" ? "fund_manager" : "subscriber";

    let handle: string | null = null;
    if (role === "fund_manager") {
      const { data: fm } = await supabase
        .from("fund_managers")
        .select("handle")
        .eq("id", user.id)
        .maybeSingle();
      handle = (fm as { handle?: string } | null)?.handle ?? null;
    }

    viewer = {
      handle,
      displayName:
        (profile as { full_name?: string | null } | null)?.full_name ?? null,
      role,
    };
  }

  return <MarketingLanding viewer={viewer} />;
}
