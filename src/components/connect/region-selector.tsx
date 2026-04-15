"use client";

import { useState } from "react";
import { Loader2, ArrowRight } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";

type Region = {
  key: string;
  label: string;
  flag: string;
  provider: "snaptrade" | "saltedge" | "manual";
  subtitle: string;
};

export const REGIONS: Region[] = [
  {
    key: "us_canada",
    label: "US & Canada",
    flag: "🇺🇸",
    provider: "snaptrade",
    subtitle: "Schwab, Fidelity, Robinhood, IBKR, Webull…",
  },
  {
    key: "uk",
    label: "UK",
    flag: "🇬🇧",
    provider: "saltedge",
    subtitle: "Hargreaves Lansdown, IG, Trading 212…",
  },
  {
    key: "europe",
    label: "Europe",
    flag: "🇪🇺",
    provider: "saltedge",
    subtitle: "DeGiro, Scalable, Trade Republic…",
  },
  {
    key: "uae",
    label: "UAE & Middle East",
    flag: "🇦🇪",
    provider: "saltedge",
    subtitle: "Emirates NBD, FAB, ADCB Securities…",
  },
  {
    key: "australia",
    label: "Australia",
    flag: "🇦🇺",
    provider: "snaptrade",
    subtitle: "CommSec, SelfWealth, Stake…",
  },
  {
    key: "india",
    label: "India",
    flag: "🇮🇳",
    provider: "snaptrade",
    subtitle: "Zerodha, Upstox, Groww…",
  },
  {
    key: "other",
    label: "Other / Manual Entry",
    flag: "🌐",
    provider: "manual",
    subtitle: "add positions by hand",
  },
];

export function RegionSelector({
  onSelected,
}: {
  onSelected: (region: Region) => void;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const choose = async (region: Region) => {
    setPending(region.key);
    setError(null);
    try {
      const res = await fetch("/api/fund-manager/region", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region: region.key }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "could not save region");
        setPending(null);
        return;
      }
      onSelected(region);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
      setPending(null);
    }
  };

  return (
    <div>
      <h2 className="font-display text-2xl md:text-3xl font-semibold tracking-tight mb-2">
        where do you trade?
      </h2>
      <p className="text-[color:var(--dopl-cream)]/55 text-sm mb-6">
        pick a region so we connect you to the right broker network.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {REGIONS.map((r) => {
          const busy = pending === r.key;
          return (
            <button
              key={r.key}
              onClick={() => choose(r)}
              disabled={pending !== null}
              className="group text-left"
            >
              <GlassCard className="p-5 h-full transition-all hover:border-[color:var(--dopl-lime)]/40 hover:bg-[color:var(--dopl-lime)]/[0.03] disabled:opacity-50">
                <div className="flex items-start gap-3">
                  <div className="text-3xl leading-none">{r.flag}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-base font-semibold mb-0.5">
                      {r.label}
                    </div>
                    <div className="text-xs text-[color:var(--dopl-cream)]/45 truncate">
                      {r.subtitle}
                    </div>
                  </div>
                  <div className="shrink-0 text-[color:var(--dopl-lime)] opacity-0 group-hover:opacity-100 transition-opacity">
                    {busy ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <ArrowRight size={16} />
                    )}
                  </div>
                </div>
                <div className="mt-3 text-[10px] uppercase tracking-[0.18em] font-mono text-[color:var(--dopl-cream)]/35">
                  {r.provider === "snaptrade"
                    ? "via snaptrade"
                    : r.provider === "saltedge"
                    ? "via salt edge"
                    : "manual"}
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
