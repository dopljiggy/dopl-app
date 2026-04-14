import { createServerSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import NotificationsClient from "./notifications-client";

export default async function NotificationsPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <NotificationsClient userId={user.id} />;
}
