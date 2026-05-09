"use client";

import { useState } from "react";
import {
  Loader2,
  RefreshCw,
  Unplug,
  Building2,
  Landmark,
  PencilLine,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/glass-card";
import { fireToast } from "@/components/ui/toast";

export type ConnectionCardData = {
  id: string;
  provider: "snaptrade" | "saltedge" | "manual";
  broker_name: string;
  is_active: boolean;
  last_synced: string | null;
  position_count: number;
  pool_count: number;
  assigned_count: number;
};

const PROVIDER_ICON = {
  snaptrade: Building2,
  saltedge: Landmark,
  manual: PencilLine,
} as const;

/**
 * One broker connection card. Sprint 15.
 *
 * Per-card actions:
 *   - sync: hits /api/{provider}/sync with this connection_id
 *   - disconnect: hits /api/broker/disconnect with this connection_id
 *
 * Manual connections don't expose a sync button (no upstream to sync).
 */
export function BrokerConnectionCard({
  connection,
  onSynced,
  onDisconnected,
}: {
  connection: ConnectionCardData;
  onSynced: () => void;
  onDisconnected: () => void;
}) {
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<"idle" | "ok" | "warn">("idle");

  const Icon = PROVIDER_ICON[connection.provider];

  const sync = async () => {
    if (connection.provider === "manual") return;
    setSyncing(true);
    setError(null);
    setSyncStatus("idle");
    try {
      const endpoint =
        connection.provider === "saltedge"
          ? "/api/saltedge/sync"
          : "/api/snaptrade/sync";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connection_id: connection.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "sync failed");
      // Sync engine returns per-connection results; if any errored we warn
      // but don't block the UI — partial syncs still upserted what they could.
      const errored =
        Array.isArray(data.results) &&
        data.results.some((r: { errored?: boolean }) => r.errored);
      setSyncStatus(errored ? "warn" : "ok");
      onSynced();
    } catch (e) {
      setError(e instanceof Error ? e.message : "sync failed");
      setSyncStatus("warn");
    } finally {
      setSyncing(false);
    }
  };

  const disconnect = async () => {
    if (
      !confirm(
        `Disconnect ${connection.broker_name}? Positions stay assigned to your portfolios; sync will stop.`
      )
    )
      return;
    setDisconnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/broker/disconnect", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connection_id: connection.id }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        warning?: string;
      };
      if (!res.ok) {
        throw new Error(j.error ?? "disconnect failed");
      }
      // Sprint 17: surface upstream-revoke failures so FMs know to run
      // the cleanup tool instead of assuming the SnapTrade slot is free.
      if (j.warning) {
        fireToast({
          title: "disconnected — upstream cleanup pending",
          body: j.warning,
        });
      }
      onDisconnected();
    } catch (e) {
      setError(e instanceof Error ? e.message : "disconnect failed");
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <GlassCard className="p-5" hover={false} tilt={false}>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-[color:var(--dopl-lime)]/12 border border-[color:var(--dopl-lime)]/25 flex items-center justify-center text-[color:var(--dopl-lime)] flex-shrink-0">
            <Icon size={20} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="font-display text-base font-semibold truncate">
                {connection.broker_name}
              </h3>
              {syncStatus === "ok" && (
                <CheckCircle
                  size={12}
                  className="text-[color:var(--dopl-lime)]"
                />
              )}
              {syncStatus === "warn" && (
                <AlertCircle size={12} className="text-amber-400" />
              )}
            </div>
            <div className="flex items-center gap-4 text-xs text-[color:var(--dopl-cream)]/55 font-mono">
              <span>
                <span className="text-[color:var(--dopl-cream)]/85 font-semibold">
                  {connection.position_count}
                </span>{" "}
                position{connection.position_count === 1 ? "" : "s"}
              </span>
              {connection.assigned_count > 0 && (
                <span className="text-[color:var(--dopl-cream)]/40">
                  ({connection.assigned_count} assigned)
                </span>
              )}
              {connection.last_synced && (
                <span>
                  synced {formatRelative(connection.last_synced)}
                </span>
              )}
            </div>
          </div>
        </div>

        {error && (
          <p className="mt-3 text-xs font-mono text-red-400 break-words">
            {error}
          </p>
        )}

        <div className="mt-4 flex items-center gap-2">
          {connection.provider !== "manual" && (
            <button
              onClick={sync}
              disabled={syncing || disconnecting}
              className="glass-card-light rounded-lg px-3 py-1.5 text-xs flex items-center gap-1.5 hover:bg-[color:var(--dopl-sage)]/40 transition-colors disabled:opacity-50"
            >
              {syncing ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <RefreshCw size={12} />
              )}
              {syncing ? "syncing…" : "sync"}
            </button>
          )}
          <button
            onClick={disconnect}
            disabled={syncing || disconnecting}
            className="ml-auto rounded-lg px-3 py-1.5 text-xs flex items-center gap-1.5 border border-red-500/40 text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-50"
          >
            {disconnecting ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Unplug size={12} />
            )}
            {disconnecting ? "disconnecting…" : "disconnect"}
          </button>
        </div>
      </GlassCard>
    </motion.div>
  );
}

/**
 * Compact relative time for "synced X ago" labels. We avoid pulling in
 * a date-fns dependency for one place that needs it.
 */
function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  return `${mo}mo ago`;
}
