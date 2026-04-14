import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import CountUp from "@/components/ui/count-up";
import Sparkline from "@/components/ui/sparkline";
import { GlassCard } from "@/components/ui/glass-card";

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

  const needsBroker = !fm?.broker_connected;
  const needsStripe = !fm?.stripe_onboarded;
  const needsPortfolio = activePortfolios.length === 0;

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

      {(needsBroker || needsStripe || needsPortfolio) && (
        <GlassCard className="p-6 md:p-8">
          <h2 className="font-display text-xl font-semibold mb-4">
            finish setting up
          </h2>
          <div className="space-y-2">
            <SetupRow
              done={!needsBroker}
              label="connect your brokerage"
              href="/dashboard/connect"
            />
            <SetupRow
              done={!needsStripe}
              label="set up payments"
              href="/dashboard/billing"
            />
            <SetupRow
              done={!needsPortfolio}
              label="create your first portfolio"
              href="/dashboard/portfolios"
            />
          </div>
        </GlassCard>
      )}
    </div>
  );
}

function SetupRow({
  done,
  label,
  href,
}: {
  done: boolean;
  label: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 p-4 rounded-xl glass-card-light hover:bg-[color:var(--dopl-sage)]/30 transition-colors"
    >
      <span
        className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${
          done
            ? "bg-[color:var(--dopl-lime)] text-[color:var(--dopl-deep)]"
            : "bg-[color:var(--dopl-sage)]/50 text-[color:var(--dopl-cream)]/40 group-hover:bg-[color:var(--dopl-sage)]/80"
        }`}
      >
        {done ? "✓" : ""}
      </span>
      <span
        className={`text-sm flex-1 ${
          done
            ? "text-[color:var(--dopl-cream)]/40 line-through"
            : "text-[color:var(--dopl-cream)]"
        }`}
      >
        {label}
      </span>
      {!done && (
        <span className="text-[color:var(--dopl-lime)] text-sm translate-x-0 group-hover:translate-x-1 transition-transform">
          →
        </span>
      )}
    </Link>
  );
}
