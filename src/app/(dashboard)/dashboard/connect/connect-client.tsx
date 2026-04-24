"use client";

import { useEffect, useState } from "react";
import { Link2, CheckCircle, Loader2, RefreshCw, AlertCircle, Unplug, X, AlertTriangle, ArrowLeft, Repeat } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/glass-card";
import { BrokerTypeSelector } from "@/components/connect/broker-type-selector";
import { ManualEntry } from "@/components/connect/manual-entry";

type Status = "idle" | "starting" | "syncing" | "done" | "error";
type Provider = "snaptrade" | "saltedge" | "manual" | null;

export default function ConnectClient({
  alreadyConnected,
  brokerName,
  hasSnaptradeUser,
  hasSaltedgeCustomer,
  region: initialRegion,
  provider: initialProvider,
  positionCount: initialCount,
  subscriberCount,
  justConnected,
  errorMessage,
}: {
  alreadyConnected: boolean;
  brokerName: string | null;
  hasSnaptradeUser: boolean;
  hasSaltedgeCustomer: boolean;
  region: string | null;
  provider: Provider;
  positionCount: number;
  subscriberCount: number;
  justConnected: boolean;
  errorMessage: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(
    errorMessage ? "error" : alreadyConnected ? "done" : "idle"
  );
  // `activeChoice` is session-only: starts null every page load so the
  // three-card selector is always the first thing a non-connected fund
  // manager sees, regardless of any persisted region from a prior visit.
  const [activeChoice, setActiveChoice] = useState<Provider>(null);
  const [positionCount, setPositionCount] = useState(initialCount);
  const [error, setError] = useState<string | null>(errorMessage);
  const [isConnected, setIsConnected] = useState(alreadyConnected);
  const [showDisconnect, setShowDisconnect] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Unused but retained to satisfy the server-provided props without
  // cluttering the consumer site.
  void initialRegion;
  void initialProvider;

  const disconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/broker/disconnect", { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "could not disconnect");
        setShowDisconnect(false);
        setDisconnecting(false);
        return;
      }
      setShowDisconnect(false);
      setDisconnecting(false);
      setIsConnected(false);
      setStatus("idle");
      // Back to the three-card selector.
      setActiveChoice(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "disconnect failed");
      setDisconnecting(false);
    }
  };

  useEffect(() => {
    if (justConnected || errorMessage) {
      const url = new URL(window.location.href);
      url.searchParams.delete("connected");
      url.searchParams.delete("positions");
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());
    }
  }, [justConnected, errorMessage]);

  const handleSnaptradeConnect = async () => {
    setError(null);
    setStatus("starting");

    if (!hasSnaptradeUser) {
      const regRes = await fetch("/api/snaptrade/register", { method: "POST" });
      if (!regRes.ok) {
        const j = await regRes.json().catch(() => ({}));
        setError(j.error ?? "failed to register with snaptrade");
        setStatus("error");
        return;
      }
    }

    const connRes = await fetch("/api/snaptrade/connect", { method: "POST" });
    const { redirectUrl, error: connErr } = await connRes.json();
    if (!redirectUrl) {
      setError(connErr ?? "could not start broker connection");
      setStatus("error");
      return;
    }
    window.location.href = redirectUrl;
  };

  const handleSaltedgeConnect = async () => {
    setError(null);
    setStatus("starting");

    // Register is idempotent — safe to call every time. It will either
    // return the existing customer_id from the DB, match it from
    // Salt Edge's customers list, or create a new one.
    const regRes = await fetch("/api/saltedge/register", { method: "POST" });
    const regJson = await regRes.json().catch(() => ({}));
    if (!regRes.ok || !regJson.customer_id) {
      setError(regJson.error ?? "failed to register with salt edge");
      setStatus("error");
      return;
    }

    const connRes = await fetch("/api/saltedge/connect", { method: "POST" });
    const connJson = await connRes.json().catch(() => ({}));
    if (!connRes.ok || !connJson.redirectUrl) {
      setError(connJson.error ?? "could not start salt edge connection");
      setStatus("error");
      return;
    }
    window.location.href = connJson.redirectUrl;
  };

  const runResync = async () => {
    setStatus("syncing");
    setError(null);
    const endpoint =
      activeChoice === "saltedge"
        ? "/api/saltedge/sync"
        : "/api/snaptrade/sync";
    const res = await fetch(endpoint, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "sync failed");
      setStatus("error");
      return;
    }
    setPositionCount(data.count ?? 0);
    setStatus("done");
    router.refresh();
  };

  // SELECTOR — shown whenever the fund manager has NOT connected yet and
  // hasn't clicked into a provider on this visit. This is the default
  // landing view every time they open the page.
  if (!isConnected && !activeChoice) {
    return (
      <div>
        <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight mb-2">
          connect broker
        </h1>
        <p className="text-[color:var(--dopl-cream)]/50 text-sm mb-8">
          pick how you want to link your portfolio. dopl reads positions —
          read-only, never executes trades.
        </p>
        <BrokerTypeSelector
          persist={false}
          onSelected={(c) => setActiveChoice(c.key)}
        />
      </div>
    );
  }

  // CONNECTED — show the success state with disconnect + change provider.
  if (isConnected) {
    return (
      <div>
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight mb-2">
              connect broker
            </h1>
            <p className="text-[color:var(--dopl-cream)]/50 text-sm">
              your portfolio is linked.
            </p>
          </div>
        </div>

        <GlassCard className="p-8 md:p-10 max-w-lg">
          <div className="text-center py-2">
            <CheckCircle
              size={48}
              className="text-[color:var(--dopl-lime)] mx-auto mb-4"
            />
            <h2 className="font-display text-xl font-semibold mb-2">
              {brokerName ? `${brokerName} connected` : "broker connected"}
            </h2>
            <p className="text-[color:var(--dopl-cream)]/55 text-sm mb-6">
              <span className="font-mono text-[color:var(--dopl-lime)] font-semibold">
                {positionCount}
              </span>{" "}
              position{positionCount === 1 ? "" : "s"} synced
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={runResync}
                className="flex-1 glass-card-light py-2.5 text-sm hover:bg-[color:var(--dopl-sage)]/40 transition-colors flex items-center justify-center gap-2 rounded-xl"
              >
                <RefreshCw size={14} />
                resync
              </button>
              <a
                href="/dashboard/positions"
                className="flex-1 btn-lime text-sm py-2.5 inline-flex items-center justify-center"
              >
                assign positions →
              </a>
            </div>
            <div className="mt-6 pt-5 border-t border-[color:var(--glass-border)] flex flex-col sm:flex-row gap-2 justify-center">
              <button
                onClick={() => setShowDisconnect(true)}
                className="text-xs text-[color:var(--dopl-cream)]/50 hover:text-[color:var(--dopl-cream)] transition-colors inline-flex items-center justify-center gap-1.5 px-3 py-2"
              >
                <Repeat size={12} />
                change provider
              </button>
              <button
                onClick={() => setShowDisconnect(true)}
                className="text-xs text-[color:var(--dopl-cream)]/40 hover:text-red-300 transition-colors inline-flex items-center justify-center gap-1.5 px-3 py-2"
              >
                <Unplug size={12} />
                disconnect broker
              </button>
            </div>
          </div>
        </GlassCard>

        <DisconnectModal
          open={showDisconnect}
          subscriberCount={subscriberCount}
          disconnecting={disconnecting}
          onClose={() => !disconnecting && setShowDisconnect(false)}
          onConfirm={disconnect}
        />
      </div>
    );
  }

  // PROVIDER-SPECIFIC SCREEN — the fund manager has picked a card.
  const activeProvider: Provider = activeChoice;

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight mb-2">
            connect broker
          </h1>
          <p className="text-[color:var(--dopl-cream)]/50 text-sm">
            {activeProvider === "manual"
              ? "manual entry — your positions, your rules."
              : activeProvider === "saltedge"
              ? "secure bank/broker linking via salt edge. read-only."
              : "secure connect via snaptrade. read-only — we never execute trades."}
          </p>
        </div>
        <button
          onClick={() => {
            setActiveChoice(null);
            setStatus("idle");
            setError(null);
          }}
          className="text-xs text-[color:var(--dopl-cream)]/50 hover:text-[color:var(--dopl-cream)] shrink-0 inline-flex items-center gap-1.5"
        >
          <ArrowLeft size={12} />
          change provider
        </button>
      </div>

      {activeProvider === "manual" && <ManualEntry />}

      {activeProvider !== "manual" && (
        <GlassCard className="p-8 md:p-10 max-w-lg">
          {status === "idle" && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-[color:var(--dopl-lime)]/12 border border-[color:var(--dopl-lime)]/25 flex items-center justify-center mx-auto mb-6">
                <Link2 size={26} className="text-[color:var(--dopl-lime)]" />
              </div>
              <h2 className="font-display text-xl font-semibold mb-2">
                connect your brokerage
              </h2>
              <p className="text-[color:var(--dopl-cream)]/55 text-sm mb-5">
                {activeProvider === "saltedge"
                  ? "securely connect via salt edge. read-only — we never execute trades."
                  : "securely connect via snaptrade. read-only — we never execute trades."}
              </p>
              <p className="text-xs text-[color:var(--dopl-cream)]/30 mb-6">
                {activeProvider === "saltedge"
                  ? "supports 5,000+ banks and brokers across UK, EU and the middle east"
                  : "supports Webull, Interactive Brokers, Robinhood, Schwab, Fidelity, E*Trade, and 15+ more"}
              </p>
              <button
                onClick={
                  activeProvider === "saltedge"
                    ? handleSaltedgeConnect
                    : handleSnaptradeConnect
                }
                className="btn-lime w-full text-sm py-3"
              >
                connect broker
              </button>
            </div>
          )}

          {(status === "starting" || status === "syncing") && (
            <div className="text-center py-6">
              <Loader2
                size={30}
                className="text-[color:var(--dopl-lime)] animate-spin mx-auto mb-4"
              />
              <p className="text-sm text-[color:var(--dopl-cream)]/70">
                {status === "starting" &&
                  (activeProvider === "saltedge"
                    ? "redirecting to salt edge..."
                    : "redirecting to snaptrade...")}
                {status === "syncing" && "syncing your positions..."}
              </p>
            </div>
          )}

          {status === "done" && (
            <div className="text-center py-2">
              <CheckCircle
                size={48}
                className="text-[color:var(--dopl-lime)] mx-auto mb-4"
              />
              <h2 className="font-display text-xl font-semibold mb-2">
                {brokerName ? `${brokerName} connected` : "broker connected"}
              </h2>
              <p className="text-[color:var(--dopl-cream)]/55 text-sm mb-6">
                <span className="font-mono text-[color:var(--dopl-lime)] font-semibold">
                  {positionCount}
                </span>{" "}
                position{positionCount === 1 ? "" : "s"} synced
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={runResync}
                  className="flex-1 glass-card-light py-2.5 text-sm hover:bg-[color:var(--dopl-sage)]/40 transition-colors flex items-center justify-center gap-2 rounded-xl"
                >
                  <RefreshCw size={14} />
                  resync
                </button>
                <a
                  href="/dashboard/positions"
                  className="flex-1 btn-lime text-sm py-2.5 inline-flex items-center justify-center"
                >
                  assign positions →
                </a>
              </div>
              <button
                onClick={() => setShowDisconnect(true)}
                className="mt-5 text-xs text-[color:var(--dopl-cream)]/40 hover:text-red-300 transition-colors inline-flex items-center gap-1.5"
              >
                <Unplug size={12} />
                disconnect broker
              </button>
            </div>
          )}

          {status === "error" && (
            <div className="text-center py-2">
              <AlertCircle size={40} className="text-red-400 mx-auto mb-4" />
              <h2 className="font-display text-lg font-semibold mb-2">
                something went wrong
              </h2>
              <p className="text-xs text-[color:var(--dopl-cream)]/50 font-mono mb-6 break-words">
                {error ?? "unknown error"}
              </p>
              <button
                onClick={
                  activeProvider === "saltedge"
                    ? handleSaltedgeConnect
                    : handleSnaptradeConnect
                }
                className="btn-lime text-sm px-6 py-2.5"
              >
                try again
              </button>
            </div>
          )}
        </GlassCard>
      )}

      <DisconnectModal
        open={showDisconnect}
        subscriberCount={subscriberCount}
        disconnecting={disconnecting}
        onClose={() => !disconnecting && setShowDisconnect(false)}
        onConfirm={disconnect}
      />
    </div>
  );
}

function DisconnectModal({
  open,
  subscriberCount,
  disconnecting,
  onClose,
  onConfirm,
}: {
  open: boolean;
  subscriberCount: number;
  disconnecting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const hasDoplers = subscriberCount > 0;
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-5"
          onClick={onClose}
        >
          <div
            className="absolute inset-0 bg-[color:var(--dopl-deep)]/70 backdrop-blur-md"
            aria-hidden
          />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.2, 0.7, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="glass-card glass-card-strong relative w-full max-w-md rounded-2xl p-6 md:p-7"
          >
            <button
              onClick={onClose}
              disabled={disconnecting}
              className="absolute top-4 right-4 text-[color:var(--dopl-cream)]/40 hover:text-[color:var(--dopl-cream)]"
              aria-label="close"
            >
              <X size={16} />
            </button>

            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 ${
                hasDoplers
                  ? "bg-red-500/15 border border-red-400/30 text-red-300"
                  : "bg-[color:var(--dopl-lime)]/12 border border-[color:var(--dopl-lime)]/25 text-[color:var(--dopl-lime)]"
              }`}
            >
              {hasDoplers ? (
                <AlertTriangle size={20} />
              ) : (
                <Unplug size={20} />
              )}
            </div>

            <h3 className="font-display text-xl font-semibold mb-2">
              disconnect broker?
            </h3>

            {hasDoplers ? (
              <>
                <p className="text-sm text-[color:var(--dopl-cream)]/65 leading-relaxed mb-4">
                  you have{" "}
                  <span className="font-mono font-semibold text-red-300">
                    {subscriberCount}
                  </span>{" "}
                  dopler{subscriberCount === 1 ? "" : "s"} following your
                  portfolios. disconnecting your broker will stop position
                  updates for all of them.
                </p>
                <p className="text-xs text-[color:var(--dopl-cream)]/45 mb-5">
                  your portfolios and last known positions stay live — only
                  sync stops. are you sure?
                </p>
              </>
            ) : (
              <p className="text-sm text-[color:var(--dopl-cream)]/65 leading-relaxed mb-5">
                disconnect your broker? your positions will stop updating.
                you can reconnect anytime.
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-3 mt-2">
              <button
                onClick={onClose}
                disabled={disconnecting}
                className="flex-1 glass-card-light py-2.5 text-sm rounded-xl hover:bg-[color:var(--dopl-sage)]/40 transition-colors"
              >
                keep connected
              </button>
              <button
                onClick={onConfirm}
                disabled={disconnecting}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 text-sm rounded-xl bg-red-500/15 border border-red-400/40 text-red-200 hover:bg-red-500/25 transition-colors disabled:opacity-50"
              >
                {disconnecting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Unplug size={14} />
                )}
                {disconnecting ? "disconnecting…" : "disconnect"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
