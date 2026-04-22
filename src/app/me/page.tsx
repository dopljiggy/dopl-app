import { createServerSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import DoplerShell from "@/components/dopler-shell";
import MeClient, { type MeSubscription } from "./me-client";

type SubRow = {
  id: string;
  price_cents: number | null;
  created_at: string;
  portfolio_id: string;
  fund_manager_id: string;
};
type PortfolioRow = {
  id: string;
  name: string;
  tier: string;
  price_cents: number;
};
type FmRow = { id: string; handle: string; display_name: string };

export default async function MePage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rawSubs } = await supabase
    .from("subscriptions")
    .select("id, price_cents, created_at, portfolio_id, fund_manager_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const subs = (rawSubs ?? []) as SubRow[];
  const portfolioIds = Array.from(new Set(subs.map((s) => s.portfolio_id)));
  const fmIds = Array.from(new Set(subs.map((s) => s.fund_manager_id)));

  const [portfoliosRes, fmsRes] = await Promise.all([
    portfolioIds.length
      ? supabase
          .from("portfolios")
          .select("id, name, tier, price_cents")
          .in("id", portfolioIds)
      : Promise.resolve({ data: [] as PortfolioRow[] }),
    fmIds.length
      ? supabase
          .from("fund_managers")
          .select("id, handle, display_name")
          .in("id", fmIds)
      : Promise.resolve({ data: [] as FmRow[] }),
  ]);

  const portfolioMap = new Map(
    ((portfoliosRes.data as PortfolioRow[] | null) ?? []).map((p) => [p.id, p])
  );
  const fmMap = new Map(
    ((fmsRes.data as FmRow[] | null) ?? []).map((f) => [f.id, f])
  );

  const rows: MeSubscription[] = subs.map((s) => ({
    id: s.id,
    price_cents: s.price_cents,
    created_at: s.created_at,
    portfolio: portfolioMap.get(s.portfolio_id) ?? null,
    fund_manager: fmMap.get(s.fund_manager_id) ?? null,
  }));

  return (
    <DoplerShell>
      <MeClient userId={user.id} subscriptions={rows} />
    </DoplerShell>
  );
}
