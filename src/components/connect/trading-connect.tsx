"use client";

import { useState } from "react";
import {
  Building2,
  Landmark,
  ArrowRight,
  Loader2,
  CheckCircle,
  Unplug,
  ExternalLink,
} from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";

type Connection = {
  provider: "snaptrade" | "saltedge" | null;
  connected: boolean;
  name: string | null;
  websiteUrl: string | null;
};

export function TradingConnect({
  initial,
}: {
  initial: Connection;
}) {
  const [connection, setConnection] = useState(initial);
  const [pending, setPending] = useState<"snaptrade" | "saltedge" | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectSnaptrade = async () => {
    setError(null);
    setPending("snaptrade");
    try {
      const reg = await fetch("/api/trading/snaptrade/register", {
        method: "POST",
      });
      if (!reg.ok) {
        const j = await reg.json().catch(() => ({}));
        setError(j.error ?? "registration failed");
        setPending(null);
        return;
      }
      const conn = await fetch("/api/trading/snaptrade/connect", {
        method: "POST",
      });
      const { redirectUrl, error: err } = await conn.json();
      if (!redirectUrl) {
        setError(err ?? "connect failed");
        setPending(null);
        return;
      }
      window.location.href = redirectUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
      setPending(null);
    }
  };

  const connectSaltedge = async () => {
    setError(null);
    setPending("saltedge");
    try {
      const reg = await fetch("/api/trading/saltedge/register", {
        method: "POST",
      });
      const regJson = await reg.json().catch(() => ({}));
      if (!reg.ok || !regJson.customer_id) {
        setError(regJson.error ?? "registration failed");
        setPending(null);
        return;
      }
      const conn = await fetch("/api/trading/saltedge/connect", {
        method: "POST",
      });
      const { redirectUrl, error: err } = await conn.json();
      if (!redirectUrl) {
        setError(err ?? "connect failed");
        setPending(null);
        return;
      }
      window.location.href = redirectUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
      setPending(null);
    }
  };

  const disconnect = async () => {
    setDisconnecting(true);
    try {
      await fetch("/api/trading/disconnect", { method: "DELETE" });
      setConnection({
        provider: null,
        connected: false,
        name: null,
        websiteUrl: null,
      });
    } finally {
      setDisconnecting(false);
    }
  };

  if (connection.connected) {
    return (
      <GlassCard className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[color:var(--dopl-lime)]/12 border border-[color:var(--dopl-lime)]/25 flex items-center justify-center text-[color:var(--dopl-lime)]">
            <CheckCircle size={18} />
          </div>
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/40">
              where you trade
            </p>
            <p className="text-base font-semibold">
              {connection.name ?? "connected"}
            </p>
          </div>
        </div>
        <p className="text-xs text-[color:var(--dopl-cream)]/50 leading-relaxed mb-4">
          when a fund manager updates their portfolio, we&apos;ll take you
          straight here to place the trade.
        </p>
        <div className="flex flex-wrap gap-2">
          {connection.websiteUrl && (
            <a
              href={connection.websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="glass-card-light px-4 py-2 text-xs rounded-xl hover:bg-[color:var(--dopl-sage)]/40 transition-colors inline-flex items-center gap-1.5"
            >
              <ExternalLink size={12} />
              open {connection.name}
            </a>
          )}
          <button
            onClick={disconnect}
            disabled={disconnecting}
            className="text-xs text-[color:var(--dopl-cream)]/40 hover:text-red-300 transition-colors inline-flex items-center gap-1.5 px-3 py-2"
          >
            <Unplug size={12} />
            {disconnecting ? "disconnecting…" : "disconnect"}
          </button>
        </div>
      </GlassCard>
    );
  }

  return (
    <div>
      <h2 className="font-display text-xl font-semibold mb-1">
        connect where you trade
      </h2>
      <p className="text-sm text-[color:var(--dopl-cream)]/55 mb-5">
        when a fund manager updates their portfolio, we&apos;ll send you there
        to take the trade.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card
          icon={<Building2 size={18} />}
          title="i trade through a brokerage"
          subtitle="Robinhood, Fidelity, Schwab, Webull, IBKR, Coinbase…"
          label="via snaptrade"
          busy={pending === "snaptrade"}
          onClick={connectSnaptrade}
          disabled={pending !== null}
        />
        <Card
          icon={<Landmark size={18} />}
          title="i trade through my bank"
          subtitle="Emirates NBD, HSBC, Barclays, and 5000+ banks."
          label="via salt edge"
          busy={pending === "saltedge"}
          onClick={connectSaltedge}
          disabled={pending !== null}
        />
      </div>

      {error && (
        <p className="mt-4 text-xs text-red-400 font-mono">{error}</p>
      )}
    </div>
  );
}

function Card({
  icon,
  title,
  subtitle,
  label,
  busy,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  label: string;
  busy: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="text-left"
    >
      <GlassCard className="p-5 h-full transition-all hover:border-[color:var(--dopl-lime)]/40 hover:bg-[color:var(--dopl-lime)]/[0.03] disabled:opacity-50">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-[color:var(--dopl-lime)]/12 border border-[color:var(--dopl-lime)]/25 flex items-center justify-center text-[color:var(--dopl-lime)] shrink-0">
            {icon}
          </div>
          <div className="shrink-0 ml-auto text-[color:var(--dopl-lime)]">
            {busy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <ArrowRight size={16} />
            )}
          </div>
        </div>
        <div className="font-display text-base font-semibold mb-1">
          {title}
        </div>
        <div className="text-xs text-[color:var(--dopl-cream)]/50 leading-relaxed mb-4">
          {subtitle}
        </div>
        <div className="text-[10px] uppercase tracking-[0.18em] font-mono text-[color:var(--dopl-cream)]/35">
          {label}
        </div>
      </GlassCard>
    </button>
  );
}
