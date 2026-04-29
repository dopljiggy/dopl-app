import { getCachedUser } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import ActivityClient from "./activity-client";
import type { Notification } from "@/types/database";

export default async function FmActivityPage() {
  const { supabase, user } = await getCachedUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "fund_manager") redirect("/feed");

  const { data: initial } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .in("change_type", ["subscription_added", "subscription_cancelled"])
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <ActivityClient
      userId={user.id}
      initial={(initial as Notification[] | null) ?? []}
    />
  );
}
