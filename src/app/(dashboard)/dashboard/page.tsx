import { createServerSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import CountUp from "@/components/ui/count-up";
import Sparkline from "@/components/ui/sparkline";
import { GlassCard } from "@/components/ui/glass-card";
import {
  FinishSetupChecklist,
  type FinishSetupItem,
} from "@/components/ui/finish-setup-checklist";

export default async function DashboardPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: fm } = await supabase
    .from("fund_managers")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const { data: portfolios } = await supabase
    .from("portfolios")
    .select("id, price_cents, subscriber_count, is_active")
    .eq("fund_manager_id", user.id);

  const portfolioIds = (portfolios ?? []).map((p) => p.id);
  const { count: positionCount } = portfolioIds.length
    ? await supabase
        .from("positions")
        .select("id", { count: "exact", head: true })
        .in("portfolio_id", portfolioIds)
    : { count: 0 };

  const activePortfolios = (portfolios ?? []).filter((p) => p.is_active);
  const mrrCents = (portfolios ?? []).reduce(
    (acc, p) => acc + (p.price_cents ?? 0) * (p.subscriber_count ?? 0),
    0
  );

  // Light placeholder sparkline data — real historic data would come from
  // periodic snapshots we don't collect yet.
  const makeSpark = (seed: number, trend = 1) => {
    const out: number[] = [];
    let v = Math.max(1, seed * 0.6);
    for (let i = 0; i < 14; i++) {
      v += (Math.sin(i * 0.8 + seed) * seed) / 12 + trend * (seed / 30);
      out.push(Math.max(0, v));
    }
    out[out.length - 1] = seed;
    return out;
  };

  const stats = [
    {
      label: "doplers",
      numeric: fm?.subscriber_count ?? 0,
      sub: "across all portfolios",
      spark: makeSpark(fm?.subscriber_count ?? 10, 1),
    },
    {
      label: "MRR",
      prefix: "$",
      numeric: mrrCents / 100,
      sub: "monthly recurring revenue",
      spark: makeSpark(Math.max(10, mrrCents / 100), 1.2),
      delay: 0.6,
    },
    {
      label: "portfolios",
      numeric: activePortfolios.length,
      sub: "active",
      spark: makeSpark(Math.max(3, activePortfolios.length), 0.4),
    },
  ];

  const checklistItems: FinishSetupItem[] = [
    {
      label: "broker connected",
      done: !!fm?.broker_connected,
      href: "/dashboard/connect",
    },
    {
      label: "first portfolio created",
      done: (portfolios ?? []).length > 0,
      href: "/dashboard/portfolios",
    },
    {
      label: "positions assigned",
      done: (positionCount ?? 0) > 0,
      href: "/dashboard/positions",
    },
    {
      label: "share your dopl link",
      done: (fm?.subscriber_count ?? 0) > 0,
      href: "/dashboard/share",
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight">
          welcome back
          {fm?.display_name ? `, ${fm.display_name.split(" ")[0]}` : ""}
        </h1>
        {fm?.handle && (
          <p className="text-[color:var(--dopl-cream)]/40 text-sm font-mono mt-1">
            dopl.com/{fm.handle}
          </p>
        )}
      </div>

      <FinishSetupChecklist items={checklistItems} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {stats.map((stat) => (
          <GlassCard key={stat.label} className="p-6 relative overflow-hidden">
            <div className="absolute inset-0 opacity-70 pointer-events-none">
              <div className="absolute bottom-0 right-0">
                <Sparkline
                  data={stat.spark}
                  width={180}
                  height={54}
                  color="var(--dopl-lime)"
                />
              </div>
            </div>
            <div className="relative">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/40 mb-2">
                {stat.label}
              </p>
              <p className="font-mono text-4xl font-bold text-[color:var(--dopl-lime)] leading-none">
                <CountUp
                  value={stat.numeric}
                  prefix={stat.prefix ?? ""}
                  decimals={stat.prefix === "$" ? 0 : 0}
                  duration={1.3}
                />
              </p>
              <p className="text-xs text-[color:var(--dopl-cream)]/30 mt-2">
                {stat.sub}
              </p>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
