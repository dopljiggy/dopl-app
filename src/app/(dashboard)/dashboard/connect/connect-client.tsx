"use client";

import { useEffect, useState } from "react";
import { Link2, CheckCircle, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/glass-card";

type Status = "idle" | "starting" | "syncing" | "done" | "error";

export default function ConnectClient({
  alreadyConnected,
  brokerName,
  hasSnaptradeUser,
  positionCount: initialCount,
  justConnected,
  errorMessage,
}: {
  alreadyConnected: boolean;
  brokerName: string | null;
  hasSnaptradeUser: boolean;
  positionCount: number;
  justConnected: boolean;
  errorMessage: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(
    errorMessage ? "error" : alreadyConnected ? "done" : "idle"
  );
  const [positionCount, setPositionCount] = useState(initialCount);
  const [error, setError] = useState<string | null>(errorMessage);

  // If we just came back from SnapTrade, strip the query params from the URL
  // so a refresh doesn't re-trigger anything.
  useEffect(() => {
    if (justConnected || errorMessage) {
      const url = new URL(window.location.href);
      url.searchParams.delete("connected");
      url.searchParams.delete("positions");
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());
    }
  }, [justConnected, errorMessage]);

  const handleConnect = async () => {
    setError(null);
    setStatus("starting");

    // 1) Register a SnapTrade user if we don't have one yet.
    if (!hasSnaptradeUser) {
      const regRes = await fetch("/api/snaptrade/register", { method: "POST" });
      if (!regRes.ok) {
        const j = await regRes.json().catch(() => ({}));
        setError(j.error ?? "failed to register with snaptrade");
        setStatus("error");
        return;
      }
    }

    // 2) Get the Connect URL (server attaches customRedirect → our callback).
    const connRes = await fetch("/api/snaptrade/connect", { method: "POST" });
    const { redirectUrl, error: connErr } = await connRes.json();
    if (!redirectUrl) {
      setError(connErr ?? "could not start broker connection");
      setStatus("error");
      return;
    }

    // 3) Full-window redirect. SnapTrade will redirect to our callback when
    //    the user hits "Done", which then runs a sync and sends them back
    //    to /dashboard/connect?connected=true&positions=N.
    window.location.href = redirectUrl;
  };

  const runResync = async () => {
    setStatus("syncing");
    setError(null);
    const res = await fetch("/api/snaptrade/sync", { method: "POST" });
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

  return (
    <div>
      <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight mb-2">
        connect broker
      </h1>
      <p className="text-[color:var(--dopl-cream)]/50 text-sm mb-8">
        link your existing brokerage account. dopl reads your positions in real
        time.
      </p>

      <GlassCard className="p-8 md:p-10 max-w-lg">
        {/* IDLE */}
        {status === "idle" && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-[color:var(--dopl-lime)]/12 border border-[color:var(--dopl-lime)]/25 flex items-center justify-center mx-auto mb-6">
              <Link2 size={26} className="text-[color:var(--dopl-lime)]" />
            </div>
            <h2 className="font-display text-xl font-semibold mb-2">
              connect your brokerage
            </h2>
            <p className="text-[color:var(--dopl-cream)]/55 text-sm mb-5">
              securely connect via SnapTrade. read-only — we never execute trades.
            </p>
            <p className="text-xs text-[color:var(--dopl-cream)]/30 mb-6">
              supports Webull, Interactive Brokers, Robinhood, Schwab, Fidelity,
              E*Trade, and 15+ more
            </p>
            <button
              onClick={handleConnect}
              className="btn-lime w-full text-sm py-3"
            >
              connect broker
            </button>
          </div>
        )}

        {/* STARTING / SYNCING */}
        {(status === "starting" || status === "syncing") && (
          <div className="text-center py-6">
            <Loader2
              size={30}
              className="text-[color:var(--dopl-lime)] animate-spin mx-auto mb-4"
            />
            <p className="text-sm text-[color:var(--dopl-cream)]/70">
              {status === "starting" && "redirecting to snaptrade..."}
              {status === "syncing" && "syncing your positions..."}
            </p>
          </div>
        )}

        {/* DONE */}
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
          </div>
        )}

        {/* ERROR */}
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
              onClick={handleConnect}
              className="btn-lime text-sm px-6 py-2.5"
            >
              try again
            </button>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
