"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  ArrowRight,
  Copy,
  Link2,
  Briefcase,
  User,
  Globe,
  DollarSign,
  CheckCircle,
} from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { REGIONS } from "@/components/connect/region-selector";

type Initial = {
  hasBio: boolean;
  hasBroker: boolean;
  hasPortfolio: boolean;
  displayName: string;
  handle: string;
  bio: string;
  avatarUrl: string | null;
  stripeOnboarded: boolean;
  hasPaidPortfolio: boolean;
};

const ALL_STEPS = [
  "profile",
  "region",
  "broker",
  "portfolio",
  "stripe",
  "share",
] as const;

export default function OnboardingClient({ initial }: { initial: Initial }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Stripe step is unconditional — every FM sees it during onboarding.
  // Previously gated on `hasPaidPortfolio`, but that created a circular
  // dependency: paid portfolio creation is blocked until stripe_onboarded,
  // so a new FM could never reach the state where the step would appear.
  const steps = ALL_STEPS;

  const initialStep = (() => {
    if (searchParams?.get("connected") === "true" && initial.hasBroker) {
      return steps.indexOf("portfolio");
    }
    if (initial.hasBio && !initial.hasBroker) return steps.indexOf("region");
    if (initial.hasBroker && !initial.hasPortfolio) return steps.indexOf("portfolio");
    return 0;
  })();

  const [step, setStep] = useState(initialStep);
  const [bio, setBio] = useState(initial.bio);
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [handle, setHandle] = useState(initial.handle);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<{
    message: string;
    next?: string;
  } | null>(null);

  const [region, setRegion] = useState<string | null>(null);
  const [regionSaving, setRegionSaving] = useState<string | null>(null);

  const [portfolioName, setPortfolioName] = useState("Main Portfolio");
  const [portfolioTier, setPortfolioTier] = useState<"free" | "basic" | "premium" | "vip">("basic");
  const [portfolioPrice, setPortfolioPrice] = useState("29");

  useEffect(() => {
    if (searchParams?.get("connected") === "true") {
      const url = new URL(window.location.href);
      url.searchParams.delete("connected");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams]);

  const saveProfile = async () => {
    setSaving(true);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: displayName.trim(),
        handle,
        bio: bio.trim(),
        links: [],
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "could not save profile");
      return;
    }
    next();
  };

  const chooseRegion = async (key: string) => {
    setRegionSaving(key);
    try {
      await fetch("/api/fund-manager/region", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region: key }),
      });
      setRegion(key);
      next();
    } finally {
      setRegionSaving(null);
    }
  };

  const createPortfolio = async () => {
    setSaving(true);
    setCreateError(null);
    const res = await fetch("/api/portfolios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: portfolioName,
        description: "",
        tier: portfolioTier,
        price_cents:
          portfolioTier === "free"
            ? 0
            : Math.round(parseFloat(portfolioPrice || "0") * 100),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        next?: string;
      };
      setCreateError({
        message: j.error ?? "could not create portfolio",
        next: j.next,
      });
      return;
    }
    next();
  };

  const launchBrokerConnect = () => {
    document.cookie = "dopl_onboarding_flow=1; path=/; max-age=1800; SameSite=Lax";
    window.location.href = "/dashboard/connect?from=onboarding";
  };

  const next = () => setStep((s) => Math.min(s + 1, steps.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const finish = () => {
    router.replace("/dashboard");
    router.refresh();
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(
      `${window.location.origin}/${initial.handle}`
    );
  };

  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* Ambient background */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(800px 400px at 50% -10%, rgba(197,214,52,0.08), transparent 60%), radial-gradient(700px 400px at 100% 100%, rgba(45,74,62,0.4), transparent 60%)",
        }}
      />

      <div className="relative max-w-2xl mx-auto px-6 py-10 md:py-14">
        <Progress step={step} steps={steps} />

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
            className="mt-10"
          >
            {steps[step] === "profile" && (
              <StepCard
                icon={<User size={22} />}
                title="tell your audience who you are"
                subtitle="display name + handle are required. bio + avatar can come later from profile settings."
              >
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="display name"
                  className="w-full bg-[color:var(--dopl-deep)] border border-[color:var(--dopl-sage)]/30 rounded-xl px-4 py-3 text-sm mb-3"
                />
                <div className="relative mb-3">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--dopl-cream)]/40 text-sm">
                    dopl.com/
                  </span>
                  <input
                    type="text"
                    value={handle}
                    onChange={(e) =>
                      setHandle(
                        e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "")
                      )
                    }
                    placeholder="handle"
                    className="w-full bg-[color:var(--dopl-deep)] border border-[color:var(--dopl-sage)]/30 rounded-xl pl-[5.5rem] pr-4 py-3 text-sm"
                  />
                </div>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, 280))}
                  rows={4}
                  placeholder="what do you trade and why should they follow? (optional)"
                  className="w-full bg-[color:var(--dopl-deep)] border border-[color:var(--dopl-sage)]/30 rounded-xl px-4 py-3 text-sm resize-none"
                />
                <p className="text-[10px] text-[color:var(--dopl-cream)]/30 text-right mt-1 font-mono">
                  {bio.length}/280
                </p>

                <ActionRow
                  onBack={undefined}
                  primary={
                    <button
                      onClick={saveProfile}
                      disabled={saving || !displayName.trim() || handle.length < 2}
                      className="btn-lime text-sm px-6 py-2.5 flex items-center gap-2"
                    >
                      {saving ? "saving..." : "continue"}
                      <ArrowRight size={14} />
                    </button>
                  }
                />
              </StepCard>
            )}

            {steps[step] === "region" && (
              <StepCard
                icon={<Globe size={22} />}
                title="where do you trade?"
                subtitle="we route you to the right broker network for your region."
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {REGIONS.map((r) => {
                    const busy = regionSaving === r.key;
                    const selected = region === r.key;
                    return (
                      <button
                        key={r.key}
                        onClick={() => chooseRegion(r.key)}
                        disabled={regionSaving !== null}
                        className={`text-left p-3 rounded-xl border transition-all ${
                          selected
                            ? "border-[color:var(--dopl-lime)]/60 bg-[color:var(--dopl-lime)]/10"
                            : "border-[color:var(--dopl-sage)]/30 bg-[color:var(--dopl-deep)] hover:border-[color:var(--dopl-lime)]/40"
                        } disabled:opacity-50`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="text-2xl leading-none">{r.flag}</div>
                          <div className="flex-1 min-w-0">
                            <div className="font-display text-sm font-semibold">
                              {r.label}
                            </div>
                            <div className="text-[11px] text-[color:var(--dopl-cream)]/45 truncate">
                              {busy ? "saving…" : r.subtitle}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <ActionRow onSkip={next} onBack={prev} primary={<span />} />
              </StepCard>
            )}

            {steps[step] === "broker" && (
              <StepCard
                icon={<Link2 size={22} />}
                title="connect your broker"
                subtitle="dopl reads your positions in real time — read-only, never executes."
              >
                {initial.hasBroker ? (
                  <div className="text-sm text-[color:var(--dopl-lime)] flex items-center gap-2">
                    <CheckCircle size={16} /> broker connected
                  </div>
                ) : (
                  <>
                    <button
                      onClick={launchBrokerConnect}
                      className="btn-lime text-sm px-6 py-3 inline-flex items-center gap-2"
                    >
                      open broker connect
                      <ArrowRight size={14} />
                    </button>
                    <p className="text-xs text-[color:var(--dopl-cream)]/40 mt-3">
                      you&apos;ll come back here automatically once connected. skip if you want to explore first.
                    </p>
                  </>
                )}
                <ActionRow
                  onSkip={next}
                  onBack={prev}
                  primary={
                    <button
                      onClick={next}
                      className="glass-card-light px-6 py-2.5 text-sm hover:bg-[color:var(--dopl-sage)]/40"
                    >
                      next →
                    </button>
                  }
                />
              </StepCard>
            )}

            {steps[step] === "portfolio" && (
              <StepCard
                icon={<Briefcase size={22} />}
                title="create your first portfolio"
                subtitle="a portfolio is a subset of your positions at a tier + price. you can add more later."
              >
                <input
                  type="text"
                  value={portfolioName}
                  onChange={(e) => setPortfolioName(e.target.value)}
                  className="w-full bg-[color:var(--dopl-deep)] border border-[color:var(--dopl-sage)]/30 rounded-xl px-4 py-3 text-sm mb-3"
                />
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {(["free", "basic", "premium", "vip"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setPortfolioTier(t)}
                      className={`py-2 text-xs rounded-lg transition-all ${
                        portfolioTier === t
                          ? "bg-[color:var(--dopl-lime)]/15 border border-[color:var(--dopl-lime)]/40 text-[color:var(--dopl-lime)]"
                          : "glass-card-light"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {portfolioTier !== "free" && (
                  <div className="relative mb-3">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--dopl-cream)]/40 text-sm">
                      $
                    </span>
                    <input
                      type="number"
                      value={portfolioPrice}
                      onChange={(e) => setPortfolioPrice(e.target.value)}
                      className="w-full bg-[color:var(--dopl-deep)] border border-[color:var(--dopl-sage)]/30 rounded-xl pl-8 pr-16 py-3 text-sm"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[color:var(--dopl-cream)]/40 text-sm">
                      /mo
                    </span>
                  </div>
                )}
                {portfolioTier !== "free" && !initial.stripeOnboarded && (
                  <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/5 px-3 py-2.5 text-xs text-amber-200/80">
                    paid tiers need stripe connected. you&apos;ll set that up in the next step.
                  </div>
                )}
                {createError && (
                  <div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/5 px-3 py-2.5 text-xs text-red-200/80">
                    {createError.message}
                    {createError.next && (
                      <a
                        href={createError.next}
                        className="ml-2 underline text-[color:var(--dopl-lime)]"
                      >
                        go set it up →
                      </a>
                    )}
                  </div>
                )}
                <ActionRow
                  onSkip={next}
                  onBack={prev}
                  primary={
                    <button
                      onClick={createPortfolio}
                      disabled={saving || !portfolioName}
                      className="btn-lime text-sm px-6 py-2.5 flex items-center gap-2"
                    >
                      {saving ? "creating..." : "create"}
                      <ArrowRight size={14} />
                    </button>
                  }
                />
              </StepCard>
            )}

            {steps[step] === "stripe" && (
              <StepCard
                icon={<DollarSign size={22} />}
                title="set up payments"
                subtitle="stripe connect handles payouts. dopl takes a 10% platform fee; the rest goes straight to your bank."
              >
                {initial.stripeOnboarded ? (
                  <div className="text-sm text-[color:var(--dopl-lime)] flex items-center gap-2">
                    <CheckCircle size={16} /> stripe connected
                  </div>
                ) : (
                  <button
                    onClick={async () => {
                      const res = await fetch("/api/stripe/connect", {
                        method: "POST",
                      });
                      const { url } = await res.json();
                      if (url) window.location.href = url;
                    }}
                    className="btn-lime text-sm px-6 py-3 inline-flex items-center gap-2"
                  >
                    set up stripe
                    <ArrowRight size={14} />
                  </button>
                )}
                <ActionRow
                  onBack={prev}
                  primary={
                    <button
                      onClick={next}
                      disabled={!initial.stripeOnboarded}
                      className="btn-lime text-sm px-6 py-2.5 flex items-center gap-2 disabled:opacity-40"
                    >
                      continue
                      <ArrowRight size={14} />
                    </button>
                  }
                />
              </StepCard>
            )}

            {steps[step] === "share" && (
              <StepCard
                icon={<Check size={22} />}
                title="you're live."
                subtitle="share your dopl link anywhere — bio, tweet, discord."
              >
                <div className="glass-card-light p-4 flex items-center gap-3 mb-6">
                  <p className="font-mono text-sm flex-1 truncate">
                    {typeof window !== "undefined"
                      ? `${window.location.origin}/${initial.handle}`
                      : `dopl.com/${initial.handle}`}
                  </p>
                  <button
                    onClick={copyLink}
                    className="text-[color:var(--dopl-lime)] hover:text-[color:var(--dopl-cream)] transition-colors"
                    aria-label="copy"
                  >
                    <Copy size={16} />
                  </button>
                </div>
                <button
                  onClick={finish}
                  className="btn-lime text-sm px-8 py-3 inline-flex items-center gap-2"
                >
                  go to dashboard
                  <ArrowRight size={14} />
                </button>
              </StepCard>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
}

function StepCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <GlassCard className="p-8 md:p-10">
      <div className="w-12 h-12 rounded-2xl bg-[color:var(--dopl-lime)]/12 border border-[color:var(--dopl-lime)]/25 flex items-center justify-center text-[color:var(--dopl-lime)] mb-5">
        {icon}
      </div>
      <h2 className="font-display text-2xl md:text-3xl font-semibold leading-tight tracking-tight">
        {title}
      </h2>
      <p className="text-[color:var(--dopl-cream)]/55 text-sm mt-2 mb-6">
        {subtitle}
      </p>
      {children}
    </GlassCard>
  );
}

function ActionRow({
  onSkip,
  onBack,
  primary,
}: {
  onSkip?: () => void;
  onBack?: () => void;
  primary: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 mt-6">
      <div className="flex items-center gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="text-xs text-[color:var(--dopl-cream)]/50 hover:text-[color:var(--dopl-cream)]"
          >
            ← back
          </button>
        )}
        {onSkip && (
          <button
            onClick={onSkip}
            className="text-xs text-[color:var(--dopl-cream)]/50 hover:text-[color:var(--dopl-cream)]"
          >
            skip
          </button>
        )}
      </div>
      {primary}
    </div>
  );
}

function Progress({
  step,
  steps,
}: {
  step: number;
  steps: readonly string[];
}) {
  return (
    <div className="flex items-center gap-2">
      {steps.map((name, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <div key={name} className="flex items-center gap-2 flex-1">
            <div className="flex items-center gap-2">
              <motion.div
                animate={{
                  scale: active ? 1.15 : 1,
                  boxShadow: active
                    ? "0 0 0 6px rgba(197,214,52,0.18), 0 0 20px rgba(197,214,52,0.35)"
                    : done
                    ? "0 0 12px rgba(197,214,52,0.3)"
                    : "none",
                }}
                transition={{ duration: 0.3 }}
                className={`w-2.5 h-2.5 rounded-full ${
                  done || active
                    ? "bg-[color:var(--dopl-lime)]"
                    : "bg-[color:var(--dopl-sage)]/60"
                }`}
              />
              <span
                className={`text-[10px] uppercase tracking-[0.2em] font-mono hidden sm:inline ${
                  active || done
                    ? "text-[color:var(--dopl-cream)]/80"
                    : "text-[color:var(--dopl-cream)]/30"
                }`}
              >
                {name}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="flex-1 h-px bg-[color:var(--dopl-sage)]/30 relative overflow-hidden">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-[color:var(--dopl-lime)]"
                  initial={false}
                  animate={{ width: done ? "100%" : "0%" }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
