import { createServerSupabase } from "@/lib/supabase-server";
import Link from "next/link";
import LeaderboardList from "./leaderboard-list";
import DoplerShell from "@/components/dopler-shell";

export default async function LeaderboardPage() {
  const supabase = await createServerSupabase();

  const { data: managers } = await supabase
    .from("fund_managers")
    .select("*")
    .order("subscriber_count", { ascending: false })
    .limit(50);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Decide chrome: authed users get the DoplerShell (consistent nav);
  // visitors get a minimal public header.
  const body = (
    <div className="max-w-4xl mx-auto px-6 py-12 md:py-16">
      <div className="text-center mb-12">
        <h1 className="font-display text-4xl md:text-5xl font-semibold tracking-tight">
          leaderboard
        </h1>
        <p className="text-[color:var(--dopl-cream)]/50 mt-2">
          top fund managers by dopler count
        </p>
      </div>
      <LeaderboardList managers={managers ?? []} />
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
