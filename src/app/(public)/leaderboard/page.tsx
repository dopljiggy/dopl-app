import { createServerSupabase } from "@/lib/supabase-server";
import Link from "next/link";
import LeaderboardList from "./leaderboard-list";

export default async function LeaderboardPage() {
  const supabase = await createServerSupabase();

  const { data: managers } = await supabase
    .from("fund_managers")
    .select("*")
    .order("subscriber_count", { ascending: false })
    .limit(50);

  return (
    <main className="min-h-screen">
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <Link href="/" className="font-display text-2xl font-semibold">
          dopl
        </Link>
        <Link
          href="/login"
          className="text-sm text-[color:var(--dopl-cream)]/60 hover:text-[color:var(--dopl-cream)] link-underline"
        >
          log in
        </Link>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12 md:py-16">
        <div className="text-center mb-12">
          <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight">
            leaderboard
          </h1>
          <p className="text-[color:var(--dopl-cream)]/50 mt-2">
            top fund managers by subscriber count
          </p>
        </div>

        <LeaderboardList managers={managers ?? []} />
      </div>
    </main>
  );
}
