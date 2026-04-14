import { createServerSupabase } from "@/lib/supabase-server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import SubscribeButton from "./subscribe-button";
import LiveUpdates from "./live-updates";

export default async function PortfolioDetail({
  params,
}: {
  params: Promise<{ portfolioId: string }>;
}) {
  const { portfolioId } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: portfolio } = await supabase
    .from("portfolios")
    .select(
      "*, fund_manager:fund_managers!inner(handle, display_name, avatar_url, bio, subscriber_count)"
    )
    .eq("id", portfolioId)
    .maybeSingle();

  if (!portfolio) return notFound();

  const isOwner = portfolio.fund_manager_id === user.id;
  const isFree = portfolio.tier === "free";

  // Active subscription?
  let subscribed = false;
  if (!isOwner && !isFree) {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .eq("portfolio_id", portfolioId)
      .eq("status", "active")
      .maybeSingle();
    subscribed = !!sub;
  }

  const canView = isOwner || isFree || subscribed;

  // Even if not subscribed, we can fetch positions because RLS will filter.
  // For UI purposes when not allowed, we still show synthetic blurred rows.
  const { data: positions } = await supabase
    .from("positions")
    .select("*")
    .eq("portfolio_id", portfolioId)
    .order("market_value", { ascending: false });

  const displayPositions = canView
    ? positions ?? []
    : Array.from({ length: 6 }).map((_, i) => ({
        id: `blur-${i}`,
        ticker: "ABCD",
        name: "Hidden Holding",
        allocation_pct: 20 - i * 2,
        current_price: 100,
        gain_loss_pct: 5,
        shares: 10,
        market_value: 1000,
      }));

  // Recent updates
  const { data: updates } = await supabase
    .from("portfolio_updates")
    .select("*")
    .eq("portfolio_id", portfolioId)
    .order("created_at", { ascending: false })
    .limit(10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fm = (portfolio as any).fund_manager;

  return (
    <main className="min-h-screen">
      <LiveUpdates portfolioId={portfolioId} canView={canView} />
      <nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto">
        <Link href="/feed" className="text-sm text-dopl-cream/60 hover:text-dopl-cream">
          ← back to feed
        </Link>
        <Link href="/" className="font-display text-xl font-semibold">
          dopl
        </Link>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="glass-card p-6 md:p-8 mb-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <Link
              href={`/${fm.handle}`}
              className="flex items-center gap-4 group"
            >
              <div className="w-14 h-14 rounded-2xl bg-dopl-sage flex items-center justify-center overflow-hidden">
                {fm.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={fm.avatar_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="font-display text-xl text-dopl-lime">
                    {fm.display_name?.[0]}
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm text-dopl-cream/40 group-hover:text-dopl-cream/70">
                  {fm.display_name}
                </p>
                <p className="text-xs text-dopl-cream/40 font-mono">
                  @{fm.handle}
                </p>
              </div>
            </Link>
            <div className="md:ml-auto">
              <div className="flex items-baseline gap-3">
                <span
                  className={`text-xs font-mono font-semibold px-2 py-1 rounded ${
                    portfolio.tier === "free"
                      ? "bg-dopl-sage/50 text-dopl-cream/70"
                      : portfolio.tier === "vip"
                      ? "bg-dopl-lime/20 text-dopl-lime"
                      : "bg-dopl-sage/30 text-dopl-cream/70"
                  }`}
                >
                  {portfolio.tier}
                </span>
                <span className="font-mono text-xl font-bold text-dopl-lime">
                  {portfolio.price_cents === 0
                    ? "free"
                    : `$${(portfolio.price_cents / 100).toFixed(0)}/mo`}
                </span>
              </div>
            </div>
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-semibold mt-6">
            {portfolio.name}
          </h1>
          {portfolio.description && (
            <p className="text-dopl-cream/60 text-sm mt-3 max-w-2xl">
              {portfolio.description}
            </p>
          )}
        </div>

        {/* Subscribe gate */}
        {!canView && (
          <div className="glass-card p-8 mb-6 text-center border border-dopl-lime/20">
            <p className="font-display text-xl font-semibold mb-2">
              subscribe to see live positions
            </p>
            <p className="text-dopl-cream/50 text-sm mb-6">
              real-time tickers, allocations, and notifications when{" "}
              {fm.display_name} trades.
            </p>
            <SubscribeButton portfolioId={portfolioId} priceCents={portfolio.price_cents} />
          </div>
        )}

        {/* Positions */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold">positions</h2>
            <span className="text-xs text-dopl-cream/40 font-mono">
              {canView ? displayPositions.length : "—"} holdings
            </span>
          </div>

          {displayPositions.length === 0 ? (
            <div className="glass-card p-8 text-center text-sm text-dopl-cream/40">
              no positions yet
            </div>
          ) : (
            <div className="glass-card overflow-hidden">
              <div className="hidden sm:grid grid-cols-12 gap-2 px-5 py-3 text-xs text-dopl-cream/40 border-b border-dopl-sage/20">
                <div className="col-span-4">ticker</div>
                <div className="col-span-3 text-right">allocation</div>
                <div className="col-span-3 text-right">price</div>
                <div className="col-span-2 text-right">P/L</div>
              </div>
              <div className={canView ? "" : "blurred-content"}>
                {displayPositions.map((p) => (
                  <div
                    key={p.id}
                    className="grid grid-cols-2 sm:grid-cols-12 gap-2 px-5 py-4 items-center border-b border-dopl-sage/10 last:border-0"
                  >
                    <div className="sm:col-span-4">
                      <p className="font-mono font-semibold text-sm">
                        {p.ticker}
                      </p>
                      <p className="text-xs text-dopl-cream/40 truncate">
                        {p.name}
                      </p>
                    </div>
                    <div className="sm:col-span-3 text-right order-3 sm:order-none col-span-2">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-dopl-sage/30 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-dopl-lime"
                            style={{
                              width: `${Math.min(100, p.allocation_pct ?? 0)}%`,
                            }}
                          />
                        </div>
                        <span className="font-mono text-sm tabular-nums">
                          {p.allocation_pct?.toFixed(1) ?? "—"}%
                        </span>
                      </div>
                    </div>
                    <div className="sm:col-span-3 text-right font-mono text-sm tabular-nums">
                      {p.current_price != null
                        ? `$${Number(p.current_price).toFixed(2)}`
                        : "—"}
                    </div>
                    <div
                      className={`sm:col-span-2 text-right font-mono text-sm tabular-nums ${
                        (p.gain_loss_pct ?? 0) >= 0
                          ? "text-dopl-lime"
                          : "text-red-400"
                      }`}
                    >
                      {p.gain_loss_pct != null
                        ? `${p.gain_loss_pct >= 0 ? "+" : ""}${p.gain_loss_pct.toFixed(1)}%`
                        : "—"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Recent updates */}
        {updates && updates.length > 0 && (
          <section>
            <h2 className="font-display text-lg font-semibold mb-4">activity</h2>
            <div className="space-y-2">
              {updates.map((u) => (
                <div
                  key={u.id}
                  className="glass-card-light p-4 flex items-start gap-3"
                >
                  <span className="w-2 h-2 rounded-full bg-dopl-lime mt-1.5 flex-shrink-0" />
                  <div className="flex-1 text-sm">
                    <p className="text-dopl-cream/80">{u.description}</p>
                    {u.thesis_note && (
                      <p className="text-xs text-dopl-cream/50 mt-1 italic">
                        “{u.thesis_note}”
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-dopl-cream/30 font-mono">
                    {new Date(u.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
