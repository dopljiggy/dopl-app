import { createServerSupabase } from "@/lib/supabase-server";
import Link from "next/link";

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
        <Link href="/" className="font-display text-2xl font-semibold">dopl</Link>
        <Link href="/login" className="text-sm text-dopl-cream/60 hover:text-dopl-cream">log in</Link>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="font-display text-4xl font-semibold text-center mb-2">leaderboard</h1>
        <p className="text-dopl-cream/50 text-center mb-12">top fund managers by subscriber count</p>

        <div className="space-y-3">
          {managers?.map((fm, index) => (
            <Link
              key={fm.id}
              href={`/${fm.handle}`}
              className="glass-card p-5 flex items-center gap-5 hover:border-dopl-lime/30 transition-colors block"
            >
              <span className={`font-mono text-lg font-bold w-8 ${
                index < 3 ? "text-dopl-lime" : "text-dopl-cream/30"
              }`}>
                {index + 1}
              </span>
              <div className="w-12 h-12 rounded-xl bg-dopl-sage flex items-center justify-center flex-shrink-0">
                {fm.avatar_url ? (
                  <img src={fm.avatar_url} alt="" className="w-full h-full rounded-xl object-cover" />
                ) : (
                  <span className="font-display text-lg text-dopl-lime">{fm.display_name[0]}</span>
                )}
              </div>
              <div className="flex-grow">
                <p className="font-semibold">{fm.display_name}</p>
                <p className="text-xs text-dopl-cream/40">@{fm.handle}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-xl font-bold text-dopl-lime">{fm.subscriber_count}</p>
                <p className="text-xs text-dopl-cream/30">subscribers</p>
              </div>
            </Link>
          ))}

          {(!managers || managers.length === 0) && (
            <div className="glass-card p-12 text-center">
              <p className="text-dopl-cream/50 mb-4">no fund managers yet</p>
              <Link href="/signup" className="btn-lime text-sm px-6 py-2.5 inline-block">
                be the first
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
