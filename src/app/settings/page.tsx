import { createServerSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import DoplerShell from "@/components/dopler-shell";
import { GlassCard } from "@/components/ui/glass-card";
import SignOutButton from "./sign-out-button";
import Link from "next/link";
import { TradingConnect } from "@/components/connect/trading-connect";

type ProfileRow = {
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
  trading_provider?: "snaptrade" | "saltedge" | null;
  trading_connected?: boolean | null;
  trading_connection_data?: {
    broker_name?: string;
    bank_name?: string;
    website_url?: string | null;
  } | null;
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let profile: ProfileRow | null = null;
  const withNew = await supabase
    .from("profiles")
    .select(
      "full_name, email, role, trading_provider, trading_connected, trading_connection_data"
    )
    .eq("id", user.id)
    .maybeSingle();
  if (withNew.error) {
    const fallback = await supabase
      .from("profiles")
      .select("full_name, email, role")
      .eq("id", user.id)
      .maybeSingle();
    profile = (fallback.data as ProfileRow) ?? null;
  } else {
    profile = (withNew.data as ProfileRow) ?? null;
  }

  if (profile?.role === "fund_manager") redirect("/dashboard/profile");

  const { count: activeSubs } = await supabase
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "active");

  const params = await searchParams;
  const tradingName =
    profile?.trading_connection_data?.broker_name ??
    profile?.trading_connection_data?.bank_name ??
    null;

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

        {params.connected === "true" && (
          <GlassCard className="p-4 mb-4 border-[color:var(--dopl-lime)]/40">
            <p className="text-sm text-[color:var(--dopl-lime)]">
              trading account connected.
            </p>
          </GlassCard>
        )}
        {params.error && (
          <GlassCard className="p-4 mb-4 border-red-400/40">
            <p className="text-sm text-red-300">{params.error}</p>
          </GlassCard>
        )}

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

        <div className="mb-8">
          <TradingConnect
            initial={{
              provider: profile?.trading_provider ?? null,
              connected: !!profile?.trading_connected,
              name: tradingName,
              websiteUrl:
                profile?.trading_connection_data?.website_url ?? null,
            }}
          />
        </div>

        <div className="mt-8">
          <SignOutButton />
        </div>
      </div>
    </DoplerShell>
  );
}
