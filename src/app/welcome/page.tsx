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
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role === "fund_manager") redirect("/onboarding");

  const firstName = profile?.full_name?.split(" ")[0] ?? "";
  return <WelcomeClient firstName={firstName} />;
}
