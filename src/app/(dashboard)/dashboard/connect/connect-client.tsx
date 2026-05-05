"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  RefreshCw,
  X,
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/glass-card";
import { fireToast } from "@/components/ui/toast";
import {
  BrokerConnectionCard,
  type ConnectionCardData,
} from "@/components/connect/broker-connection-card";
import {
  BrokerTypeSelector,
  type BrokerChoice,
} from "@/components/connect/broker-type-selector";

/**
 * Sprint 15: multi-broker connect page.
 *
 * Renders a list of active broker_connections plus an "Add Broker" button
 * that opens BrokerTypeSelector in a modal. SnapTrade / SaltEdge picks
 * fire the existing register + connect flow; manual entry routes to
 * /dashboard/portfolios where the inline AddPositionForm covers it.
 *
 * Per-connection sync + disconnect lives on each card. The "Sync All"
 * button hits /api/broker/sync-all for a single multi-provider sweep.
 */
export default function ConnectClient({
  connections,
  hasSnaptradeUser,
  hasSaltedgeCustomer,
  subscriberCount,
  justConnected,
  errorMessage,
}: {
  connections: ConnectionCardData[];
  hasSnaptradeUser: boolean;
  hasSaltedgeCustomer: boolean;
  subscriberCount: number;
  justConnected: boolean;
  errorMessage: string | null;
}) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(connections.length === 0 && !errorMessage);
  const [adding, setAdding] = useState<"snaptrade" | "saltedge" | null>(null);
  const [error, setError] = useState<string | null>(errorMessage);
  const [syncingAll, setSyncingAll] = useState(false);

  // Suppress unused props — Sprint 15 doesn't need them but keeping the
  // signature lets future flows (e.g. pre-checking customer existence
  // before showing the SaltEdge connect button) plug in cleanly.
  void hasSnaptradeUser;
  void hasSaltedgeCustomer;
  void subscriberCount;

  // Strip success/error query params after mount so a refresh doesn't
  // re-fire the toast / alert.
  useEffect(() => {
    if (justConnected || errorMessage) {
      const url = new URL(window.location.href);
      url.searchParams.delete("connected");
      url.searchParams.delete("positions");
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());
      if (justConnected) {
        fireToast({ title: "broker connected" });
      }
    }
  }, [justConnected, errorMessage]);

  const handlePicked = async (choice: BrokerChoice) => {
    setError(null);

    if (choice.key === "manual") {
      // BrokerTypeSelector navigates manual to /dashboard/portfolios for
      // inline entry; we don't need a connection row here. The selector
      // already calls router.push.
      setShowAdd(false);
      return;
    }

    setAdding(choice.key);
    try {
      if (choice.key === "snaptrade") {
        if (!hasSnaptradeUser) {
          const reg = await fetch("/api/snaptrade/register", { method: "POST" });
          if (!reg.ok) {
            const j = await reg.json().catch(() => ({}));
            throw new Error(j.error ?? "snaptrade register failed");
          }
        }
        const conn = await fetch("/api/snaptrade/connect", { method: "POST" });
        const { redirectUrl, error: connErr } = await conn.json();
        if (!redirectUrl)
          throw new Error(connErr ?? "could not start broker connection");
        window.location.href = redirectUrl;
      } else if (choice.key === "saltedge") {
        const reg = await fetch("/api/saltedge/register", { method: "POST" });
        if (!reg.ok) {
          const j = await reg.json().catch(() => ({}));
          throw new Error(j.error ?? "salt edge register failed");
        }
        const conn = await fetch("/api/saltedge/connect", { method: "POST" });
        const j = await conn.json().catch(() => ({}));
        if (!conn.ok || !j.redirectUrl)
          throw new Error(j.error ?? "could not start salt edge connection");
        window.location.href = j.redirectUrl;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not start connection");
      setAdding(null);
    }
  };

  const syncAll = async () => {
    setSyncingAll(true);
    setError(null);
    try {
      const res = await fetch("/api/broker/sync-all", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "sync failed");
      const upserted = data.count ?? 0;
      const sold = data.sold ?? 0;
      fireToast({
        title: "synced all brokers",
        body: `${upserted} positions updated${
          sold > 0 ? ` · ${sold} removed` : ""
        }`,
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "sync failed");
    } finally {
      setSyncingAll(false);
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-2 flex-wrap">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight mb-2">
            Connected Brokers
          </h1>
          <p className="text-[color:var(--dopl-cream)]/50 text-sm">
            link as many brokers as you trade with — read-only, never
            executes trades.
          </p>
        </div>
        {connections.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={syncAll}
              disabled={syncingAll}
              className="glass-card-light rounded-xl px-3 py-2 text-xs flex items-center gap-2 hover:bg-[color:var(--dopl-sage)]/40 transition-colors disabled:opacity-50"
            >
              {syncingAll ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <RefreshCw size={13} />
              )}
              {syncingAll ? "syncing…" : "sync all"}
            </button>
            <button
              onClick={() => {
                setShowAdd(true);
                setError(null);
              }}
              className="btn-lime text-xs px-4 py-2 inline-flex items-center gap-2"
            >
              <Plus size={13} />
              add broker
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="glass-card-light rounded-xl p-3 mb-4 mt-4 border border-red-500/30 text-xs font-mono text-red-300 flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {/* Empty state — no connections yet. Show selector inline. */}
      {connections.length === 0 ? (
        <div className="mt-6">
          <BrokerTypeSelector
            persist={false}
            onSelected={handlePicked}
          />
          {adding && (
            <div className="mt-4 text-xs text-[color:var(--dopl-cream)]/50 font-mono inline-flex items-center gap-2">
              <Loader2 size={12} className="animate-spin" />
              redirecting to {adding === "saltedge" ? "salt edge" : "snaptrade"}…
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3 mt-6">
          {connections.map((c) => (
            <BrokerConnectionCard
              key={c.id}
              connection={c}
              onSynced={() => router.refresh()}
              onDisconnected={() => router.refresh()}
            />
          ))}
        </div>
      )}

      {/* Add-broker modal — shown when FM clicks "Add Broker" with at
          least one connection already present. Empty-state path renders
          the selector inline above instead. */}
      <AnimatePresence>
        {showAdd && connections.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center p-5"
            onClick={() => !adding && setShowAdd(false)}
          >
            <div
              aria-hidden
              className="absolute inset-0 bg-[color:var(--dopl-deep)]/70 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.97 }}
              transition={{ duration: 0.25, ease: [0.2, 0.7, 0.2, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card glass-card-strong relative w-full max-w-2xl rounded-2xl p-6 md:p-7 z-[81] max-h-[88vh] overflow-y-auto"
            >
              <button
                type="button"
                onClick={() => !adding && setShowAdd(false)}
                disabled={!!adding}
                className="absolute top-5 right-5 p-1 rounded-lg text-[color:var(--dopl-cream)]/40 hover:text-[color:var(--dopl-cream)] hover:bg-[color:var(--dopl-sage)]/30 transition-colors"
                aria-label="close"
              >
                <X size={16} />
              </button>
              <BrokerTypeSelector
                heading="add another broker"
                subheading="connect each brokerage you want positions synced from."
                persist={false}
                onSelected={handlePicked}
              />
              {adding && (
                <p className="mt-4 text-xs text-[color:var(--dopl-cream)]/50 font-mono inline-flex items-center gap-2">
                  <Loader2 size={12} className="animate-spin" />
                  redirecting to {adding === "saltedge" ? "salt edge" : "snaptrade"}…
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
