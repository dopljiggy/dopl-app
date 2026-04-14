import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import CountUp from "@/components/ui/count-up";

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

  const fmt = (cents: number) =>
    cents >= 100_000
      ? `$${(cents / 100_000).toFixed(1)}k`
      : `$${(cents / 100).toFixed(0)}`;

  const stats: {
    label: string;
    sub: string;
    numeric: number;
    prefix?: string;
    suffix?: string;
  }[] = [
    {
      label: "subscribers",
      numeric: fm?.subscriber_count ?? 0,
      sub: "across all portfolios",
    },
    {
      label: "MRR",
      numeric: mrrCents / 100,
      prefix: "$",
      sub: "monthly recurring revenue",
    },
    {
      label: "portfolios",
      numeric: activePortfolios.length,
      sub: "active",
    },
  ];
  void fmt;

  const needsBroker = !fm?.broker_connected;
  const needsStripe = !fm?.stripe_onboarded;
  const needsPortfolio = activePortfolios.length === 0;

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold">
          welcome back{fm?.display_name ? `, ${fm.display_name.split(" ")[0]}` : ""}
        </h1>
        {fm?.handle && (
          <p className="text-dopl-cream/40 text-sm font-mono mt-1">
            dopl.com/{fm.handle}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="glass-card p-6">
            <p className="text-xs text-dopl-cream/40 mb-1">{stat.label}</p>
            <CountUp
              value={stat.numeric}
              prefix={stat.prefix ?? ""}
              suffix={stat.suffix ?? ""}
              className="font-mono text-3xl font-bold text-dopl-lime"
            />
            <p className="text-xs text-dopl-cream/30 mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      {(needsBroker || needsStripe || needsPortfolio) && (
        <div className="glass-card p-8">
          <h2 className="font-display text-xl font-semibold mb-4">
            finish setting up
          </h2>
          <div className="space-y-3">
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
        </div>
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
      className="flex items-center gap-4 p-4 glass-card-light hover:bg-dopl-sage/30 transition-colors"
    >
      <span
        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
          done
            ? "bg-dopl-lime text-dopl-deep"
            : "bg-dopl-sage/50 text-dopl-cream/40"
        }`}
      >
        {done ? "✓" : ""}
      </span>
      <span
        className={`text-sm flex-1 ${
          done ? "text-dopl-cream/40 line-through" : "text-dopl-cream"
        }`}
      >
        {label}
      </span>
      {!done && <span className="text-dopl-lime text-sm">→</span>}
    </Link>
  );
}
