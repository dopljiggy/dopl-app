import { createServerSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import WelcomeClient from "./welcome-client";

export default async function WelcomePage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, trading_provider, trading_connected, trading_connection_data")
    .eq("id", user.id)
    .maybeSingle();

  // Fund managers go to their own onboarding (IA cleanup lands in Sprint 4).
  if (profile?.role === "fund_manager") redirect("/onboarding");

  // Already connected: send straight to feed, no onboarding flash.
  if (profile?.trading_connected) redirect("/feed");

  const firstName = profile?.full_name?.split(" ")[0] ?? "";
  const connectionData =
    (profile?.trading_connection_data as {
      broker_name?: string;
      bank_name?: string;
      website_url?: string | null;
    } | null) ?? {};
  const tradingName =
    connectionData.broker_name ?? connectionData.bank_name ?? null;

  return (
    <WelcomeClient
      firstName={firstName}
      initial={{
        provider: (profile?.trading_provider as "snaptrade" | "saltedge" | null) ?? null,
        connected: false,
        name: tradingName,
        websiteUrl: connectionData.website_url ?? null,
      }}
    />
  );
}
