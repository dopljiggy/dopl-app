import { getCachedUser } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import DoplersClient, { type DoplerRow } from "./doplers-client";

type RawSubscription = {
  id: string;
  user_id: string;
  status: string;
  price_cents: number | null;
  created_at: string;
  cancelled_at: string | null;
  profile: { full_name: string | null; email: string | null } | null;
  portfolio: { name: string; tier: string } | null;
};

export default async function DoplersPage() {
  // FM-scoped read — RLS already covers this:
  //   profiles SELECT policy: using (true)            (publicly readable)
  //   subscriptions SELECT:    auth.uid() = fund_manager_id  (FM-scoped)
  // No admin client needed.
  const { supabase, user } = await getCachedUser();
  if (!user) redirect("/login");

  const { data: subs } = await supabase
    .from("subscriptions")
    .select(
      "id, user_id, status, price_cents, created_at, cancelled_at, profile:profiles(full_name, email), portfolio:portfolios(name, tier)"
    )
    .eq("fund_manager_id", user.id)
    .order("created_at", { ascending: false });

  const rows = ((subs ?? []) as unknown as RawSubscription[]).map(
    (s): DoplerRow => ({
      id: s.id,
      userId: s.user_id,
      fullName: s.profile?.full_name ?? null,
      email: s.profile?.email ?? null,
      portfolioName: s.portfolio?.name ?? "—",
      tier: s.portfolio?.tier ?? "free",
      status: s.status,
      priceCents: s.price_cents,
      createdAt: s.created_at,
      cancelledAt: s.cancelled_at,
    })
  );

  // Summary stats. Compute server-side so the client doesn't repeat the
  // arithmetic on every render.
  const uniqueUserIds = new Set(rows.map((r) => r.userId));
  const active = rows.filter((r) => r.status === "active");
  const monthlyRevenueCents = active.reduce(
    (acc, r) => acc + (r.priceCents ?? 0),
    0
  );
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const churn30d = rows.filter(
    (r) =>
      r.status === "cancelled" &&
      r.cancelledAt != null &&
      new Date(r.cancelledAt).getTime() > thirtyDaysAgo
  ).length;

  return (
    <DoplersClient
      rows={rows}
      stats={{
        totalDoplers: uniqueUserIds.size,
        activeDoplers: active.length,
        monthlyRevenueCents,
        churn30d,
      }}
    />
  );
}
