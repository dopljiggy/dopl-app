"use client";

import { useState } from "react";
import { ChevronDown, Check } from "lucide-react";

const BROKERS = [
  "Robinhood",
  "Fidelity",
  "Schwab",
  "Webull",
  "Interactive Brokers",
  "Coinbase",
  "Trading 212",
  "Wealthsimple",
  "Other",
] as const;

export function BrokerPreferencePicker({
  initial,
  onSaved,
}: {
  initial: string | null;
  onSaved?: (broker: string | null) => void;
}) {
  const [value, setValue] = useState(initial ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async (broker: string) => {
    setValue(broker);
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/broker-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ broker: broker || null }),
      });
      setSaved(true);
      onSaved?.(broker || null);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/40 mb-2">
        your broker
      </p>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => save(e.target.value)}
          disabled={saving}
          className="w-full appearance-none bg-[color:var(--dopl-deep)] border border-[color:var(--dopl-sage)]/30 rounded-xl px-4 py-3 text-sm text-[color:var(--dopl-cream)] pr-10 focus:outline-none focus:border-[color:var(--dopl-lime)]/50 transition-colors"
        >
          <option value="">select your broker</option>
          {BROKERS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[color:var(--dopl-cream)]/40">
          {saved ? (
            <Check size={16} className="text-[color:var(--dopl-lime)]" />
          ) : (
            <ChevronDown size={16} />
          )}
        </div>
      </div>
      <p className="text-[11px] text-[color:var(--dopl-cream)]/40 mt-2">
        used to open your broker when a fund manager trades. no account linking.
      </p>
    </div>
  );
}
