import { getCachedUser } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import NotificationsClient from "./notifications-client";
import DoplerShell from "@/components/dopler-shell";

export default async function NotificationsPage() {
  const { supabase, user } = await getCachedUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("trading_broker_preference")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <DoplerShell>
      <NotificationsClient
        brokerPreference={profile?.trading_broker_preference ?? null}
      />
    </DoplerShell>
  );
}
