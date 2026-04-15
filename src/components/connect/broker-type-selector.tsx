"use client";

import { useState } from "react";
import { Loader2, ArrowRight, Building2, Landmark, Globe } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";

export type BrokerProvider = "snaptrade" | "saltedge" | "manual";

export type BrokerChoice = {
  key: BrokerProvider;
  title: string;
  subtitle: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

export const BROKER_CHOICES: BrokerChoice[] = [
  {
    key: "snaptrade",
    title: "my brokerage",
    subtitle:
      "Robinhood, Fidelity, Schwab, Webull, Interactive Brokers, Coinbase, Trading 212, and more.",
    label: "via snaptrade",
    icon: Building2,
  },
  {
    key: "saltedge",
    title: "my bank",
    subtitle: "Emirates NBD, HSBC, Barclays, and 5000+ banks worldwide.",
    label: "via salt edge",
    icon: Landmark,
  },
  {
    key: "manual",
    title: "my broker isn't listed",
    subtitle: "add your positions by hand. update them whenever you trade.",
    label: "manual entry",
    icon: Globe,
  },
];

export function BrokerTypeSelector({
  heading = "where is your portfolio?",
  subheading = "dopl reads your positions — read-only, never executes trades.",
  onSelected,
  persist = true,
}: {
  heading?: string;
  subheading?: string;
  onSelected: (choice: BrokerChoice) => void;
  persist?: boolean;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const choose = async (choice: BrokerChoice) => {
    setPending(choice.key);
    setError(null);
    try {
      if (persist) {
        const res = await fetch("/api/fund-manager/region", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Region is retained only for DB persistence. broker_provider is
          // what actually drives flow.
          body: JSON.stringify({
            region:
              choice.key === "manual"
                ? "other"
                : choice.key === "saltedge"
                ? "europe"
                : "us_canada",
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setError(j.error ?? "could not save choice");
          setPending(null);
          return;
        }
      }
      onSelected(choice);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
      setPending(null);
    }
  };

  return (
    <div>
      <h2 className="font-display text-2xl md:text-3xl font-semibold tracking-tight mb-2">
        {heading}
      </h2>
      <p className="text-[color:var(--dopl-cream)]/55 text-sm mb-6">
        {subheading}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {BROKER_CHOICES.map((c) => {
          const busy = pending === c.key;
          const Icon = c.icon;
          return (
            <button
              key={c.key}
              onClick={() => choose(c)}
              disabled={pending !== null}
              className="group text-left"
            >
              <GlassCard className="p-5 h-full transition-all hover:border-[color:var(--dopl-lime)]/40 hover:bg-[color:var(--dopl-lime)]/[0.03] disabled:opacity-50">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[color:var(--dopl-lime)]/12 border border-[color:var(--dopl-lime)]/25 flex items-center justify-center text-[color:var(--dopl-lime)] shrink-0">
                    <Icon size={18} />
                  </div>
                  <div className="shrink-0 ml-auto text-[color:var(--dopl-lime)] opacity-0 group-hover:opacity-100 transition-opacity">
                    {busy ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <ArrowRight size={16} />
                    )}
                  </div>
                </div>
                <div className="font-display text-base font-semibold mb-1">
                  {c.title}
                </div>
                <div className="text-xs text-[color:var(--dopl-cream)]/50 leading-relaxed mb-4">
                  {c.subtitle}
                </div>
                <div className="text-[10px] uppercase tracking-[0.18em] font-mono text-[color:var(--dopl-cream)]/35">
                  {c.label}
                </div>
              </GlassCard>
            </button>
          );
        })}
      </div>

      {error && (
        <p className="mt-4 text-xs text-red-400 font-mono">{error}</p>
      )}
    </div>
  );
}
