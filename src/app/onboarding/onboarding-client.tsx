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
import { SubmitButton } from "@/components/ui/submit-button";
import { InlineError } from "@/components/ui/inline-error";

type BrokerProvider = "snaptrade" | "saltedge" | "manual";

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
  region: string | null;
  brokerProvider: BrokerProvider | null;
  hasSnaptradeUser: boolean;
  hasSaltedgeCustomer: boolean;
};

const ALL_STEPS = [
  "profile",
  "region",
  "broker",
  "portfolio",
  "stripe",
  "share",
] as const;

// Regions with meaningful SnapTrade free-tier broker coverage. Other
// regions (uae, india, other, or unknown) would see a US/Canada-heavy
// broker catalog they can't use — guaranteeing a failed connect — so
// we route them to Salt Edge regardless of the server-selected provider.
// The SnapTrade SDK's login call accepts no country/region filter
// (confirmed against `SnapTradeLoginUserRequestBody` on 2026-04-21),
// so this has to be a client-side routing gate, not a widget param.
const SNAPTRADE_REGIONS = new Set(["us_canada", "australia"]);

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

  // Persist current step in sessionStorage so a visibilitychange refresh
  // (user returns from external OAuth tab) doesn't yank the wizard back
  // to a lower step. initialStep is used on first load; sessionStorage
  // wins on subsequent renders. Max() guard ensures OAuth-success param
  // can still advance the user forward past a lower saved step.
  const SESSION_KEY = "dopl_onboarding_step";
  const [step, setStep] = useState(() => {
    if (typeof window === "undefined") return initialStep;
    const saved = window.sessionStorage.getItem(SESSION_KEY);
    if (!saved) return initialStep;
    const parsed = parseInt(saved, 10);
    if (Number.isNaN(parsed)) return initialStep;
    return Math.min(Math.max(parsed, initialStep), steps.length - 1);
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(SESSION_KEY, String(step));
  }, [step]);
  const [bio, setBio] = useState(initial.bio);
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [handle, setHandle] = useState(initial.handle);
  const [saving, setSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<{
    message: string;
    next?: string;
  } | null>(null);

  const [region, setRegion] = useState<string | null>(initial.region);
  const [regionSaving, setRegionSaving] = useState<string | null>(null);
  const [brokerProvider, setBrokerProvider] = useState<BrokerProvider | null>(
    initial.brokerProvider
  );
  // Override `brokerProvider` for regions where SnapTrade's free tier
  // has no meaningful broker coverage. The server may have stored
  // broker_provider='snaptrade' (the region API's legacy mapping for
  // india), but we still want the wizard to route the FM to Salt Edge
  // so they don't hit a US-centric broker list they can't use.
  const snaptradeAllowed = !!region && SNAPTRADE_REGIONS.has(region);
  const effectiveBrokerProvider: BrokerProvider | null =
    brokerProvider === "manual"
      ? "manual"
      : brokerProvider === "snaptrade" && snaptradeAllowed
      ? "snaptrade"
      : brokerProvider === "saltedge" || !snaptradeAllowed
      ? "saltedge"
      : brokerProvider;
  const showManualEntryHint =
    !initial.hasBroker &&
    !snaptradeAllowed &&
    effectiveBrokerProvider !== "manual";
  const [brokerStarting, setBrokerStarting] = useState<BrokerProvider | null>(
    null
  );
  // Tracks whether the FM launched the broker popup at least once, so
  // we can render a "check status" re-check button after they return
  // from the OAuth tab. Parallels stripeLaunched.
  const [brokerLaunched, setBrokerLaunched] = useState<BrokerProvider | null>(
    null
  );
  const [brokerError, setBrokerError] = useState<string | null>(null);
  const [stripeChecking, setStripeChecking] = useState(false);
  const [stripeLaunched, setStripeLaunched] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);

  const [portfolioName, setPortfolioName] = useState("");
  const [portfolioTier, setPortfolioTier] = useState<"free" | "basic" | "premium" | "vip">("basic");
  const [portfolioPrice, setPortfolioPrice] = useState("29");
  // Prevent duplicate portfolio rows when the FM clicks back → next again.
  // Seeded from sessionStorage (survives router.refresh on OAuth return)
  // or from initial.hasPortfolio (server render is authoritative on mount).
  const PORTFOLIO_FLAG = "dopl_onboarding_portfolio_created";
  const [portfolioCreated, setPortfolioCreated] = useState(() => {
    if (typeof window === "undefined") return initial.hasPortfolio;
    return (
      initial.hasPortfolio ||
      window.sessionStorage.getItem(PORTFOLIO_FLAG) === "1"
    );
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (portfolioCreated) {
      window.sessionStorage.setItem(PORTFOLIO_FLAG, "1");
    }
  }, [portfolioCreated]);

  useEffect(() => {
    if (searchParams?.get("connected") === "true") {
      const url = new URL(window.location.href);
      url.searchParams.delete("connected");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams]);

  // Refresh server state when the user returns from an external OAuth tab.
  // Only fires if the user was actually away > 500ms so rapid alt-tabs
  // don't trigger refresh spam. Also clears any transient "redirecting to…"
  // state so the launcher button un-dims and the FM can retry or move on.
  useEffect(() => {
    let lastHiddenAt = 0;
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        lastHiddenAt = Date.now();
        return;
      }
      if (Date.now() - lastHiddenAt > 500) {
        setBrokerStarting(null);
        setStripeChecking(false);
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [router]);

  const saveProfile = async () => {
    setSaving(true);
    setProfileError(null);
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
      setProfileError(j.error ?? "could not save profile");
      return;
    }
    next();
  };

  const chooseRegion = async (key: string) => {
    setRegionSaving(key);
    try {
      const res = await fetch("/api/fund-manager/region", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region: key }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        provider?: BrokerProvider;
      };
      setRegion(key);
      if (j.provider) setBrokerProvider(j.provider);
      next();
    } finally {
      setRegionSaving(null);
    }
  };

  const startSnaptrade = async () => {
    // Gesture-preserving pattern: pre-open an about:blank tab synchronously
    // so Safari iOS doesn't lose the user-gesture context during the
    // `await fetch(...)` below. DO NOT pass "noopener,noreferrer" in the
    // features string — per WHATWG spec, window.open returns null with
    // noopener set, which would silently break the whole pattern and leave
    // an orphan about:blank tab on every click.
    const newTab = window.open("about:blank", "_blank");
    // Cookie must be set synchronously BEFORE any async work so the callback
    // route sees it. Secure is required for production HTTPS hygiene; dev
    // (http://localhost) browsers still accept Secure per spec.
    document.cookie =
      "dopl_onboarding_flow=1; path=/; max-age=1800; SameSite=Lax; Secure";
    setBrokerStarting("snaptrade");
    setBrokerError(null);
    try {
      if (!initial.hasSnaptradeUser) {
        const regRes = await fetch("/api/snaptrade/register", {
          method: "POST",
        });
        if (!regRes.ok) {
          if (newTab) newTab.close();
          const j = (await regRes.json().catch(() => ({}))) as {
            error?: string;
          };
          setBrokerError(j.error ?? "failed to register with snaptrade");
          setBrokerStarting(null);
          return;
        }
      }
      const connRes = await fetch("/api/snaptrade/connect", { method: "POST" });
      const { redirectUrl, error } = (await connRes.json()) as {
        redirectUrl?: string;
        error?: string;
      };
      if (!redirectUrl) {
        if (newTab) newTab.close();
        setBrokerError(error ?? "could not start broker connection");
        setBrokerStarting(null);
        return;
      }
      setBrokerLaunched("snaptrade");
      if (newTab) {
        newTab.location.href = redirectUrl;
        // Defense-in-depth: sever opener link now that we've navigated.
        try {
          newTab.opener = null;
        } catch {
          /* cross-origin — ignore */
        }
      } else {
        // Popup blocked before pre-open; fall back to same-tab redirect.
        window.location.href = redirectUrl;
      }
    } catch (err) {
      if (newTab) newTab.close();
      setBrokerError(err instanceof Error ? err.message : "unexpected error");
      setBrokerStarting(null);
    }
  };

  const startSaltedge = async () => {
    // Same gesture-preserving pattern as startSnaptrade — see notes there
    // about why we can't pass "noopener,noreferrer" to window.open.
    const newTab = window.open("about:blank", "_blank");
    document.cookie =
      "dopl_onboarding_flow=1; path=/; max-age=1800; SameSite=Lax; Secure";
    setBrokerStarting("saltedge");
    setBrokerError(null);
    try {
      const regRes = await fetch("/api/saltedge/register", { method: "POST" });
      const regJson = (await regRes.json().catch(() => ({}))) as {
        customer_id?: string;
        error?: string;
      };
      if (!regRes.ok || !regJson.customer_id) {
        if (newTab) newTab.close();
        setBrokerError(regJson.error ?? "failed to register with salt edge");
        setBrokerStarting(null);
        return;
      }
      const connRes = await fetch("/api/saltedge/connect", { method: "POST" });
      const connJson = (await connRes.json().catch(() => ({}))) as {
        redirectUrl?: string;
        error?: string;
      };
      if (!connRes.ok || !connJson.redirectUrl) {
        if (newTab) newTab.close();
        setBrokerError(connJson.error ?? "could not start salt edge connection");
        setBrokerStarting(null);
        return;
      }
      setBrokerLaunched("saltedge");
      if (newTab) {
        newTab.location.href = connJson.redirectUrl;
        try {
          newTab.opener = null;
        } catch {
          /* cross-origin — ignore */
        }
      } else {
        window.location.href = connJson.redirectUrl;
      }
    } catch (err) {
      if (newTab) newTab.close();
      setBrokerError(err instanceof Error ? err.message : "unexpected error");
      setBrokerStarting(null);
    }
  };

  const recheckBroker = () => {
    setBrokerStarting(null);
    router.refresh();
  };

  const launchStripe = async () => {
    // Same gesture-preserving pattern as the broker launchers.
    const newTab = window.open("about:blank", "_blank");
    document.cookie =
      "dopl_onboarding_flow=1; path=/; max-age=1800; SameSite=Lax; Secure";
    setStripeChecking(true);
    setStripeError(null);
    try {
      const res = await fetch("/api/stripe/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: "onboarding" }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !json.url) {
        if (newTab) newTab.close();
        // Surface the actual reason so users (and we) can diagnose.
        // Previously this silently closed the tab with no explanation,
        // leaving the user back on /onboarding with no feedback.
        setStripeError(
          json.error ?? `stripe setup failed (${res.status})`
        );
        return;
      }
      setStripeLaunched(true);
      if (newTab) {
        newTab.location.href = json.url;
        try {
          newTab.opener = null;
        } catch {
          /* cross-origin — ignore */
        }
      } else {
        window.location.href = json.url;
      }
    } catch (err) {
      if (newTab) newTab.close();
      setStripeError(
        err instanceof Error ? err.message : "unexpected error"
      );
    } finally {
      setStripeChecking(false);
    }
  };

  const recheckStripe = () => {
    setStripeChecking(true);
    router.refresh();
    setTimeout(() => setStripeChecking(false), 800);
  };

  const createPortfolio = async () => {
    // Idempotent within the onboarding wizard: if a portfolio was already
    // created in this session (back→next→create would otherwise insert a
    // duplicate "Main Portfolio" row), skip the POST and just advance.
    if (portfolioCreated) {
      next();
      return;
    }
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
    setPortfolioCreated(true);
    next();
  };


  const next = () => setStep((s) => Math.min(s + 1, steps.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const finish = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(SESSION_KEY);
      window.sessionStorage.removeItem(PORTFOLIO_FLAG);
      window.location.href = "/dashboard";
    }
  };

  const copyLink = async () => {
    // Use the live `handle` state, not `initial.handle` — initial is from
    // page-load server render, which has the OLD handle if the user
    // changed it during the profile step (Sprint 4 hotfix R1 bug: share
    // page showed the signup handle instead of the onboarding handle).
    await navigator.clipboard.writeText(
      `${window.location.origin}/${handle}`
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
                title="Tell Your Audience Who You Are"
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
                {profileError && (
                  <div className="mt-3">
                    <InlineError
                      message={profileError}
                      onDismiss={() => setProfileError(null)}
                    />
                  </div>
                )}

                <ActionRow
                  onBack={undefined}
                  primary={
                    <SubmitButton
                      onClick={saveProfile}
                      isPending={saving}
                      pendingLabel="saving..."
                      disabled={!displayName.trim() || handle.length < 2}
                      className="text-sm px-6 py-2.5 inline-flex items-center gap-2"
                    >
                      <span className="inline-flex items-center gap-2">
                        continue
                        <ArrowRight size={14} />
                      </span>
                    </SubmitButton>
                  }
                />
              </StepCard>
            )}

            {steps[step] === "region" && (
              <StepCard
                icon={<Globe size={22} />}
                title="Where Do You Trade?"
              >
                <p className="text-[11px] text-[color:var(--dopl-cream)]/45 mb-3">
                  regions group broker networks — pick the closest match. you
                  can always use manual entry.
                </p>
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
                subtitle={
                  effectiveBrokerProvider === "saltedge"
                    ? "secure read-only link to your bank/broker via salt edge."
                    : effectiveBrokerProvider === "manual"
                    ? "you'll enter positions by hand from the positions page after onboarding."
                    : "dopl reads your positions in real time — read-only, never executes."
                }
              >
                {initial.hasBroker ? (
                  <div className="text-sm text-[color:var(--dopl-lime)] flex items-center gap-2">
                    <CheckCircle size={16} /> broker connected
                  </div>
                ) : effectiveBrokerProvider === "manual" ? (
                  <div className="rounded-xl border border-[color:var(--dopl-sage)]/30 bg-[color:var(--dopl-deep)] p-4 text-sm text-[color:var(--dopl-cream)]/65">
                    you can add positions manually any time from the
                    positions page. continue to set up your portfolio.
                  </div>
                ) : effectiveBrokerProvider === "saltedge" ? (
                  <button
                    onClick={startSaltedge}
                    disabled={brokerStarting !== null}
                    className="btn-lime text-sm px-6 py-3 inline-flex items-center gap-2 disabled:opacity-60"
                  >
                    {brokerStarting === "saltedge"
                      ? "redirecting to salt edge..."
                      : "connect via salt edge"}
                    <ArrowRight size={14} />
                  </button>
                ) : (
                  <button
                    onClick={startSnaptrade}
                    disabled={brokerStarting !== null}
                    className="btn-lime text-sm px-6 py-3 inline-flex items-center gap-2 disabled:opacity-60"
                  >
                    {brokerStarting === "snaptrade"
                      ? "redirecting to snaptrade..."
                      : "connect via snaptrade"}
                    <ArrowRight size={14} />
                  </button>
                )}
                {brokerError && (
                  <div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/5 px-3 py-2.5 text-xs text-red-200/80">
                    {brokerError}
                  </div>
                )}
                {!initial.hasBroker &&
                  effectiveBrokerProvider !== "manual" &&
                  brokerLaunched && (
                    <div className="mt-3">
                      <SubmitButton
                        onClick={recheckBroker}
                        isPending={false}
                        variant="secondary"
                        className="px-5 py-2.5 text-sm rounded-xl inline-flex items-center gap-2 hover:bg-[color:var(--dopl-sage)]/40"
                      >
                        i&apos;m done — check status
                      </SubmitButton>
                    </div>
                  )}
                {!initial.hasBroker && effectiveBrokerProvider !== "manual" && (
                  <p className="text-xs text-[color:var(--dopl-cream)]/40 mt-3">
                    read-only. we never execute trades. you&apos;ll return here
                    automatically after connecting.
                  </p>
                )}
                {showManualEntryHint && (
                  <p className="text-xs text-[color:var(--dopl-cream)]/45 mt-3">
                    manual entry is always available from your dashboard —
                    head to the positions page after onboarding.
                  </p>
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
                title={
                  portfolioCreated
                    ? "Your First Portfolio Is Live"
                    : "Create Your First Portfolio"
                }
                subtitle={
                  portfolioCreated
                    ? "you can tweak the name, tier, and price anytime from the portfolios page."
                    : "a portfolio is a subset of your positions at a tier + price. you can add more later."
                }
              >
                {portfolioCreated && (
                  <div className="mb-4 rounded-xl border border-[color:var(--dopl-lime)]/30 bg-[color:var(--dopl-lime)]/5 px-4 py-3 text-sm text-[color:var(--dopl-lime)] flex items-center gap-2">
                    <CheckCircle size={16} />
                    <span>
                      {portfolioName} created — continue to set up payments.
                    </span>
                  </div>
                )}
                <input
                  type="text"
                  value={portfolioName}
                  onChange={(e) => setPortfolioName(e.target.value)}
                  disabled={portfolioCreated}
                  placeholder="e.g. Growth Portfolio"
                  className="w-full bg-[color:var(--dopl-deep)] border border-[color:var(--dopl-sage)]/30 rounded-xl px-4 py-3 text-sm mb-3 placeholder:text-[color:var(--dopl-cream)]/30 disabled:opacity-50"
                />
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {(["free", "basic", "premium", "vip"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setPortfolioTier(t)}
                      disabled={portfolioCreated}
                      className={`py-2 text-xs rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
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
                  <div className="inline-flex items-center mb-3">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--dopl-cream)]/40 text-sm font-mono">
                        $
                      </span>
                      <input
                        type="number"
                        value={portfolioPrice}
                        onChange={(e) => setPortfolioPrice(e.target.value)}
                        disabled={portfolioCreated}
                        className="w-28 bg-[color:var(--dopl-deep)] border border-[color:var(--dopl-sage)]/30 rounded-xl pl-7 pr-2 py-3 text-sm font-mono tabular-nums disabled:opacity-50"
                      />
                    </div>
                    <span className="ml-2 text-sm text-[color:var(--dopl-cream)]/55 font-mono">
                      /mo
                    </span>
                  </div>
                )}
                {portfolioTier !== "free" && !initial.stripeOnboarded && (
                  <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/5 px-3 py-2.5 text-xs text-amber-200/80">
                    paid tiers go live after Stripe setup.
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
                  onSkip={portfolioCreated ? next : next}
                  onBack={prev}
                  primary={
                    <SubmitButton
                      onClick={createPortfolio}
                      isPending={saving}
                      pendingLabel="creating..."
                      disabled={!portfolioName}
                      className="text-sm px-6 py-2.5 inline-flex items-center gap-2"
                    >
                      <span className="inline-flex items-center gap-2">
                        {portfolioCreated ? "continue" : "create"}
                        <ArrowRight size={14} />
                      </span>
                    </SubmitButton>
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
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <SubmitButton
                        onClick={launchStripe}
                        isPending={stripeChecking}
                        pendingLabel="opening stripe..."
                        className="text-sm px-6 py-3 inline-flex items-center gap-2"
                      >
                        <span className="inline-flex items-center gap-2">
                          {stripeLaunched ? "Re-open Stripe" : "Set Up Stripe"}
                          <ArrowRight size={14} />
                        </span>
                      </SubmitButton>
                      <SubmitButton
                        onClick={recheckStripe}
                        isPending={stripeChecking}
                        pendingLabel="checking..."
                        variant="secondary"
                        className="px-5 py-3 text-sm rounded-xl inline-flex items-center gap-2 hover:bg-[color:var(--dopl-sage)]/40"
                      >
                        I&apos;m Done — Check Status
                      </SubmitButton>
                    </div>
                    {stripeError && (
                      <div className="mt-3">
                        <InlineError
                          message={stripeError}
                          onDismiss={() => setStripeError(null)}
                        />
                      </div>
                    )}
                    {stripeLaunched && !stripeError && (
                      <div className="mt-4 rounded-xl border border-[color:var(--dopl-sage)]/30 bg-[color:var(--dopl-deep)] p-4 text-xs text-[color:var(--dopl-cream)]/65 leading-relaxed">
                        finish stripe in the new tab, then come back here and
                        click <span className="text-[color:var(--dopl-lime)]">I&apos;m Done</span>.
                        stripe sometimes takes a few seconds to confirm — if
                        it&apos;s not green yet, try again shortly.
                      </div>
                    )}
                    <p className="text-[11px] text-[color:var(--dopl-cream)]/35 mt-3">
                      you can also skip this and come back later — paid-tier
                      portfolios stay unpublished until stripe is done.
                    </p>
                  </>
                )}
                <ActionRow
                  onSkip={initial.stripeOnboarded ? undefined : next}
                  onBack={prev}
                  primary={
                    <button
                      onClick={next}
                      disabled={false}
                      className="btn-lime text-sm px-6 py-2.5 flex items-center gap-2"
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
                      ? `${window.location.origin}/${handle}`
                      : `dopl.com/${handle}`}
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
  subtitle?: string;
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
      {subtitle && (
        <p className="text-[color:var(--dopl-cream)]/55 text-sm mt-2 mb-6">
          {subtitle}
        </p>
      )}
      {!subtitle && <div className="mt-6" />}
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
    <>
      <div className="sm:hidden text-[11px] uppercase tracking-[0.2em] font-mono text-[color:var(--dopl-cream)]/60">
        step {step + 1} of {steps.length} — {steps[step]}
      </div>
      <div className="hidden sm:flex items-center gap-2">
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
    </>
  );
}
