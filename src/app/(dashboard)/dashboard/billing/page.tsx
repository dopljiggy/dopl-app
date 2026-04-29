import { getCachedUser } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import BillingClient from "./billing-client";

export default async function BillingPage() {
  const { supabase, user } = await getCachedUser();
  if (!user) redirect("/login");

  const { data: fm } = await supabase
    .from("fund_managers")
    .select("stripe_account_id, stripe_onboarded, subscriber_count")
    .eq("id", user.id)
    .maybeSingle();

  // Sum MRR from subscriptions
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("price_cents")
    .eq("fund_manager_id", user.id)
    .eq("status", "active");

  const mrrCents = (subs ?? []).reduce(
    (a, s) => a + (s.price_cents ?? 0),
    0
  );

  return (
    <BillingClient
      onboarded={!!fm?.stripe_onboarded}
      hasAccount={!!fm?.stripe_account_id}
      subscriberCount={fm?.subscriber_count ?? 0}
      mrrCents={mrrCents}
    />
  );
}
