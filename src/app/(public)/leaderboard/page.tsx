import { getCachedUser } from "@/lib/supabase-server";
import Link from "next/link";
import LeaderboardList from "./leaderboard-list";
import DoplerShell from "@/components/dopler-shell";

export default async function LeaderboardPage() {
  const { supabase, user } = await getCachedUser();

  const { data: managers } = await supabase
    .from("fund_managers")
    .select("*, portfolios(id)")
    .order("created_at", { ascending: false })
    .limit(60);

  const managersWithCount = (managers ?? []).map((fm: any) => ({
    ...fm,
    portfolio_count: Array.isArray(fm.portfolios) ? fm.portfolios.length : 0,
    portfolios: undefined,
  }));

  // Decide chrome: authed users get the DoplerShell (consistent nav);
  // visitors get a minimal public header.
  const body = (
    <div className="max-w-5xl mx-auto px-6 py-12 md:py-16">
      <div className="mb-10">
        <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight">
          Discover Fund Managers
        </h1>
      </div>
      <LeaderboardList managers={managersWithCount} />
    </div>
  );

  if (user) {
    return <DoplerShell>{body}</DoplerShell>;
  }

  return (
    <main className="min-h-screen">
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <Link href="/" className="font-display text-2xl font-semibold">
          dopl
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link
            href="/login"
            className="text-[color:var(--dopl-cream)]/60 hover:text-[color:var(--dopl-cream)] link-underline"
          >
            log in
          </Link>
          <Link href="/signup" className="btn-lime text-sm px-4 py-2">
            get started
          </Link>
        </div>
      </nav>
      {body}
    </main>
  );
}
