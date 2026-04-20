import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import { fmNeedsOnboarding } from "@/lib/onboarding-gates";
import DashboardChrome from "./dashboard-chrome";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: fm }, { count: portfolioCount }] = await Promise.all([
    supabase
      .from("fund_managers")
      .select("bio, broker_connected")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("portfolios")
      .select("id", { count: "exact", head: true })
      .eq("fund_manager_id", user.id),
  ]);

  if (fmNeedsOnboarding(fm, portfolioCount ?? 0)) {
    redirect("/onboarding");
  }

  return <DashboardChrome>{children}</DashboardChrome>;
}
