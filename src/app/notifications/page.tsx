import { createServerSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import NotificationsClient from "./notifications-client";
import DoplerShell from "@/components/dopler-shell";

type ProfileRow = {
  trading_provider?: "snaptrade" | "saltedge" | null;
  trading_connected?: boolean | null;
  trading_connection_data?: {
    broker_name?: string;
    bank_name?: string;
    website_url?: string | null;
  } | null;
};

export default async function NotificationsPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let profile: ProfileRow | null = null;
  const withNew = await supabase
    .from("profiles")
    .select("trading_provider, trading_connected, trading_connection_data")
    .eq("id", user.id)
    .maybeSingle();
  if (!withNew.error) profile = (withNew.data as ProfileRow) ?? null;

  const tradingName =
    profile?.trading_connection_data?.broker_name ??
    profile?.trading_connection_data?.bank_name ??
    null;

  return (
    <DoplerShell>
      <NotificationsClient
        tradingConnected={!!profile?.trading_connected}
        tradingName={tradingName}
        tradingWebsite={profile?.trading_connection_data?.website_url ?? null}
      />
    </DoplerShell>
  );
}
