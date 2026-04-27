import { createServerSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import DoplerShell from "@/components/dopler-shell";
import { GlassCard } from "@/components/ui/glass-card";
import SignOutButton from "./sign-out-button";
import Link from "next/link";
import { BrokerPreferencePicker } from "@/components/broker-preference-picker";

type ProfileRow = {
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
  trading_broker_preference?: string | null;
};

export default async function SettingsPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profileData }, { count: activeSubs }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, email, role, trading_broker_preference")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "active"),
  ]);

  const profile = profileData as ProfileRow | null;
  if (profile?.role === "fund_manager") redirect("/dashboard/profile");

  return (
    <DoplerShell>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <Link
          href="/me"
          className="text-xs text-[color:var(--dopl-cream)]/50 hover:text-[color:var(--dopl-cream)] inline-flex items-center gap-1 mb-4"
        >
          ← back to /me
        </Link>
        <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight mb-8">
          settings
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

        <GlassCard className="p-6 mb-8">
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

        <GlassCard className="p-6 mb-8">
          <BrokerPreferencePicker
            initial={profile?.trading_broker_preference ?? null}
          />
        </GlassCard>

        <div className="mt-8">
          <SignOutButton />
        </div>
      </div>
    </DoplerShell>
  );
}
