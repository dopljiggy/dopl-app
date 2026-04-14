"use client";

import { useState } from "react";
import { Link2, CheckCircle, Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

type Status = "idle" | "registering" | "connecting" | "syncing" | "done";

export default function ConnectClient({
  alreadyConnected,
  brokerName,
  hasSnaptradeUser,
  positionCount: initialCount,
}: {
  alreadyConnected: boolean;
  brokerName: string | null;
  hasSnaptradeUser: boolean;
  positionCount: number;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(
    alreadyConnected ? "done" : "idle"
  );
  const [positionCount, setPositionCount] = useState(initialCount);

  const handleConnect = async () => {
    if (!hasSnaptradeUser) {
      setStatus("registering");
      const regRes = await fetch("/api/snaptrade/register", { method: "POST" });
      if (!regRes.ok) {
        setStatus("idle");
        return;
      }
    }

    setStatus("connecting");
    const connRes = await fetch("/api/snaptrade/connect", { method: "POST" });
    const { redirectUrl } = await connRes.json();
    if (!redirectUrl) {
      setStatus("idle");
      return;
    }

    const popup = window.open(redirectUrl, "snaptrade", "width=500,height=700");
    const interval = setInterval(async () => {
      if (popup?.closed) {
        clearInterval(interval);
        await runSync();
      }
    }, 1000);
  };

  const runSync = async () => {
    setStatus("syncing");
    const syncRes = await fetch("/api/snaptrade/sync", { method: "POST" });
    const data = await syncRes.json();
    setPositionCount(data.count ?? 0);
    setStatus("done");
    router.refresh();
  };

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold mb-2">connect broker</h1>
      <p className="text-dopl-cream/50 text-sm mb-8">
        link your existing brokerage account. dopl reads your positions in real
        time.
      </p>

      <div className="glass-card p-10 max-w-lg">
        {status === "idle" && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-dopl-sage/30 flex items-center justify-center mx-auto mb-6">
              <Link2 size={28} className="text-dopl-lime" />
            </div>
            <h2 className="font-display text-xl font-semibold mb-2">
              connect your brokerage
            </h2>
            <p className="text-dopl-cream/50 text-sm mb-6">
              securely connect via SnapTrade. read-only — we never execute trades.
            </p>
            <p className="text-xs text-dopl-cream/30 mb-6">
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

        {(status === "registering" ||
          status === "connecting" ||
          status === "syncing") && (
          <div className="text-center py-8">
            <Loader2
              size={32}
              className="text-dopl-lime animate-spin mx-auto mb-4"
            />
            <p className="text-sm text-dopl-cream/70">
              {status === "registering" && "setting up secure connection..."}
              {status === "connecting" && "complete the login in the popup..."}
              {status === "syncing" && "syncing your positions..."}
            </p>
          </div>
        )}

        {status === "done" && (
          <div className="text-center py-4">
            <CheckCircle size={48} className="text-dopl-lime mx-auto mb-4" />
            <h2 className="font-display text-xl font-semibold mb-2">
              {brokerName ? `${brokerName} connected` : "broker connected"}
            </h2>
            <p className="text-dopl-cream/50 text-sm mb-6">
              <span className="font-mono">{positionCount}</span> positions synced
            </p>
            <div className="flex gap-3">
              <button
                onClick={runSync}
                className="flex-1 glass-card-light py-2.5 text-sm hover:bg-dopl-sage/40 transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw size={14} />
                resync
              </button>
              <a
                href="/dashboard/portfolios"
                className="flex-1 btn-lime text-sm py-2.5 inline-flex items-center justify-center"
              >
                assign positions →
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
