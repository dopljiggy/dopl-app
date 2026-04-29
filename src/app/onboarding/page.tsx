import { getCachedUser } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import OnboardingClient from "./onboarding-client";

export default async function OnboardingPage() {
  const { supabase, user } = await getCachedUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "fund_manager") redirect("/feed");

  const { data: fm } = await supabase
    .from("fund_managers")
    .select(
      "*, stripe_account_id, stripe_onboarded, region, broker_provider, snaptrade_user_id, saltedge_customer_id"
    )
    .eq("id", user.id)
    .maybeSingle();

  const { data: portfolios } = await supabase
    .from("portfolios")
    .select("id, price_cents")
    .eq("fund_manager_id", user.id);

  const hasPaidPortfolio = (portfolios ?? []).some(
    (p) => (p.price_cents ?? 0) > 0
  );

  const initial = {
    hasBio: !!fm?.bio,
    hasBroker: !!fm?.broker_connected,
    hasPortfolio: !!portfolios?.length,
    displayName: fm?.display_name ?? "",
    handle: fm?.handle ?? "",
    bio: fm?.bio ?? "",
    avatarUrl: fm?.avatar_url ?? null,
    stripeOnboarded: !!fm?.stripe_onboarded,
    hasPaidPortfolio,
    region: (fm?.region as string | null) ?? null,
    brokerProvider:
      (fm?.broker_provider as "snaptrade" | "saltedge" | "manual" | null) ??
      null,
    hasSnaptradeUser: !!fm?.snaptrade_user_id,
    hasSaltedgeCustomer: !!fm?.saltedge_customer_id,
  };

  return <OnboardingClient initial={initial} />;
}
