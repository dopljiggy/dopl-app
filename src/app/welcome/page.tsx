import { createServerSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";

export default async function WelcomePage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role === "fund_manager") redirect("/onboarding");

  const firstName = profile?.full_name?.split(" ")[0] ?? "";

  return (
    <main className="min-h-screen relative overflow-hidden flex items-center justify-center px-6 py-10">
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(800px 400px at 50% -10%, rgba(197,214,52,0.1), transparent 60%), radial-gradient(700px 400px at 100% 100%, rgba(45,74,62,0.5), transparent 60%)",
        }}
      />
      <div className="relative w-full max-w-xl">
        <GlassCard className="p-10 md:p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[color:var(--dopl-lime)]/12 border border-[color:var(--dopl-lime)]/25 flex items-center justify-center text-[color:var(--dopl-lime)] mx-auto mb-6">
            <Sparkles size={22} />
          </div>

          <h1 className="font-display text-4xl md:text-5xl font-semibold leading-tight tracking-tight">
            welcome to dopl
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="text-[color:var(--dopl-cream)]/60 text-sm md:text-base mt-4 mb-8 max-w-md mx-auto">
            find a fund manager worth dopling. when they trade, you&apos;ll see
            it live.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/leaderboard"
              className="btn-lime text-sm px-7 py-3 inline-flex items-center justify-center"
            >
              find a fund manager →
            </Link>
            <Link
              href="/feed"
              className="glass-card-light px-7 py-3 text-sm rounded-xl hover:bg-[color:var(--dopl-sage)]/30 transition-colors"
            >
              skip for now
            </Link>
          </div>

          <p className="text-[10px] text-[color:var(--dopl-cream)]/30 mt-10 font-mono uppercase tracking-[0.2em]">
            you&apos;re now dopling
          </p>
        </GlassCard>
      </div>
    </main>
  );
}
