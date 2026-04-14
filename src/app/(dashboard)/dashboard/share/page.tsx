import { createServerSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import ShareClient from "./share-client";

export default async function SharePage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: fm } = await supabase
    .from("fund_managers")
    .select("handle, display_name, subscriber_count, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

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
