import { redirect } from "next/navigation";
import { getCachedUser } from "@/lib/supabase-server";

export default async function LandingPage() {
  const { supabase, user } = await getCachedUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role =
    profile?.role === "fund_manager" ? "fund_manager" : "subscriber";

  if (role === "fund_manager") {
    redirect("/dashboard");
  } else {
    redirect("/feed");
  }
}
