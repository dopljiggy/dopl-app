import { createServerSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function FeedPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: subs } = await supabase
    .from("subscriptions")
    .select(
      "id, status, price_cents, portfolio:portfolios(id, name, description, tier, fund_manager_id), fund_manager:fund_managers(handle, display_name, avatar_url)"
    )
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const { data: recentUpdates } = await supabase
    .from("portfolio_updates")
    .select(
      "id, update_type, description, created_at, portfolio:portfolios(id, name), fund_manager:fund_managers(handle, display_name)"
    )
    .in(
      "portfolio_id",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (subs ?? []).map((s: any) => s.portfolio?.id).filter(Boolean).length
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (subs ?? []).map((s: any) => s.portfolio?.id).filter(Boolean)
        : ["00000000-0000-0000-0000-000000000000"]
    )
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <main className="min-h-screen">
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <Link href="/" className="font-display text-2xl font-semibold">
          dopl
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/leaderboard" className="text-dopl-cream/60 hover:text-dopl-cream">
            discover
          </Link>
          <Link href="/notifications" className="text-dopl-cream/60 hover:text-dopl-cream">
            notifications
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="font-display text-3xl font-semibold mb-8">your feed</h1>

        {(!subs || subs.length === 0) ? (
          <div className="glass-card p-12 text-center">
            <p className="text-dopl-cream/50 mb-4">
              you haven&apos;t subscribed to any portfolios yet
            </p>
            <Link
              href="/leaderboard"
              className="btn-lime text-sm px-6 py-2.5 inline-block"
            >
              discover fund managers
            </Link>
          </div>
        ) : (
          <>
            <h2 className="font-display text-lg font-semibold mb-4">
              your portfolios
            </h2>
            <div className="grid md:grid-cols-2 gap-4 mb-12">
              {subs.map((s) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const p = (s as any).portfolio;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const fm = (s as any).fund_manager;
                if (!p) return null;
                return (
                  <Link
                    key={s.id}
                    href={`/feed/${p.id}`}
                    className="glass-card p-5 hover:border-dopl-lime/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-lg bg-dopl-sage flex items-center justify-center font-display text-dopl-lime text-sm">
                        {(fm?.display_name ?? "?")[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {fm?.display_name}
                        </p>
                        <p className="text-xs text-dopl-cream/40 font-mono">
                          @{fm?.handle}
                        </p>
                      </div>
                      <span className="ml-auto text-xs font-mono px-2 py-1 rounded bg-dopl-lime/10 text-dopl-lime">
                        {p.tier}
                      </span>
                    </div>
                    <p className="font-display text-base font-semibold">
                      {p.name}
                    </p>
                    {p.description && (
                      <p className="text-xs text-dopl-cream/40 line-clamp-2 mt-1">
                        {p.description}
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>

            <h2 className="font-display text-lg font-semibold mb-4">
              recent activity
            </h2>
            <div className="space-y-2">
              {recentUpdates && recentUpdates.length > 0 ? (
                recentUpdates.map((u) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const p = (u as any).portfolio;
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const fm = (u as any).fund_manager;
                  return (
                    <Link
                      key={u.id}
                      href={p ? `/feed/${p.id}` : "#"}
                      className="glass-card-light p-4 flex items-center gap-3 hover:bg-dopl-sage/30 transition-colors"
                    >
                      <span className="w-2 h-2 rounded-full bg-dopl-lime flex-shrink-0" />
                      <div className="text-sm flex-1 min-w-0">
                        <span className="font-semibold">{fm?.display_name}</span>
                        <span className="text-dopl-cream/60"> · </span>
                        <span className="text-dopl-cream/60">
                          {u.description ?? u.update_type.replace("_", " ")}
                        </span>
                        <span className="text-dopl-cream/30"> in </span>
                        <span className="text-dopl-cream/80">{p?.name}</span>
                      </div>
                      <span className="text-xs text-dopl-cream/30 font-mono flex-shrink-0">
                        {timeAgo(u.created_at)}
                      </span>
                    </Link>
                  );
                })
              ) : (
                <div className="glass-card p-8 text-center text-sm text-dopl-cream/40">
                  no updates yet — you&apos;ll see fund manager moves here
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
