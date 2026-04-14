import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { redirect } from "next/navigation";
import ShareClient from "./share-client";

export default async function SharePage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Verify this is a fund manager — doplers shouldn't see this page.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "fund_manager") {
    // Not a fund manager → send them back to their home.
    redirect("/feed");
  }

  let { data: fm } = await supabase
    .from("fund_managers")
    .select("handle, display_name, subscriber_count, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  // Auto-provision a fund_managers row if it doesn't exist yet. This handles
  // the case where a fund manager signed up before the provision API ran, or
  // the provision step silently failed.
  if (!fm) {
    const metaHandle = ((user.user_metadata as { handle?: string } | null)
      ?.handle ?? "").toLowerCase().replace(/[^a-z0-9-_]/g, "");
    const metaName =
      (user.user_metadata as { full_name?: string } | null)?.full_name ??
      profile?.full_name ??
      "";

    // Fallback handle: slugify the email local-part, suffixed with a short id
    // to avoid collisions. Only used if user_metadata didn't carry a handle.
    const fallbackHandle =
      metaHandle ||
      `${(user.email ?? "user").split("@")[0].toLowerCase().replace(/[^a-z0-9-_]/g, "")}-${user.id.slice(0, 6)}`;

    const admin = createAdminClient();
    const { error } = await admin.from("fund_managers").insert({
      id: user.id,
      handle: fallbackHandle,
      display_name: metaName || fallbackHandle,
    });

    if (!error) {
      const { data: created } = await supabase
        .from("fund_managers")
        .select("handle, display_name, subscriber_count, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      fm = created ?? {
        handle: fallbackHandle,
        display_name: metaName || fallbackHandle,
        subscriber_count: 0,
        avatar_url: null,
      };
    }
  }

  const { count: portfolioCount } = await supabase
    .from("portfolios")
    .select("id", { count: "exact", head: true })
    .eq("fund_manager_id", user.id)
    .eq("is_active", true);

  return (
    <ShareClient
      handle={fm?.handle ?? ""}
      displayName={fm?.display_name ?? ""}
      avatarUrl={fm?.avatar_url ?? null}
      subscriberCount={fm?.subscriber_count ?? 0}
      portfolioCount={portfolioCount ?? 0}
    />
  );
}
