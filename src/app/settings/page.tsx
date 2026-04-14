import { createServerSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import DoplerShell from "@/components/dopler-shell";
import { GlassCard } from "@/components/ui/glass-card";
import SignOutButton from "./sign-out-button";
import Link from "next/link";

export default async function SettingsPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role === "fund_manager") redirect("/dashboard/profile");

  const { count: activeSubs } = await supabase
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "active");

  return (
    <DoplerShell>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight mb-8">
          profile
        </h1>

        <GlassCard className="p-6 mb-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/40 mb-1">
            name
          </p>
          <p className="text-base">{profile?.full_name ?? "—"}</p>
        </GlassCard>

        <GlassCard className="p-6 mb-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/40 mb-1">
            email
          </p>
          <p className="text-base font-mono">{profile?.email}</p>
        </GlassCard>

        <GlassCard className="p-6 mb-4">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/40 mb-1">
            currently dopling
          </p>
          <p className="text-base font-mono">
            {activeSubs ?? 0} portfolio{(activeSubs ?? 0) === 1 ? "" : "s"}
          </p>
          <Link
            href="/feed"
            className="text-xs text-[color:var(--dopl-lime)] mt-2 inline-block hover:underline"
          >
            see feed →
          </Link>
        </GlassCard>

        <div className="mt-8">
          <SignOutButton />
        </div>
      </div>
    </DoplerShell>
  );
}
