"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Search, Loader2, Check } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";

type Position = {
  id: string;
  ticker: string;
  name: string | null;
  shares: number | null;
  entry_price: number | null;
  current_price: number | null;
};

type DraftPosition = {
  key: string;
  ticker: string;
  shares: string;
  entry_price: string;
};

function newDraft(): DraftPosition {
  return {
    key: Math.random().toString(36).slice(2, 10),
    ticker: "",
    shares: "",
    entry_price: "",
  };
}

export function ManualEntry() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [drafts, setDrafts] = useState<DraftPosition[]>([newDraft()]);
  const [loading, setLoading] = useState(true);
  const [priceLoadingKey, setPriceLoadingKey] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/positions/manual");
      const data = await res.json();
      setPositions(data.positions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const updateDraft = (key: string, patch: Partial<DraftPosition>) => {
    setDrafts((ds) =>
      ds.map((d) => (d.key === key ? { ...d, ...patch } : d))
    );
  };

  const addDraft = () => setDrafts((ds) => [...ds, newDraft()]);
  const removeDraft = (key: string) =>
    setDrafts((ds) => (ds.length === 1 ? [newDraft()] : ds.filter((d) => d.key !== key)));

  const lookupPrice = async (key: string, ticker: string) => {
    if (!ticker.trim()) return;
    setPriceLoadingKey(key);
    setError(null);
    try {
      const res = await fetch(
        `/api/positions/price?ticker=${encodeURIComponent(ticker.trim())}`
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "price lookup failed");
        return;
      }
      updateDraft(key, { entry_price: String(data.price) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "price lookup failed");
    } finally {
      setPriceLoadingKey(null);
    }
  };

  const saveDraft = async (d: DraftPosition) => {
    const ticker = d.ticker.trim().toUpperCase();
    if (!ticker) return;
    setSavingKey(d.key);
    setError(null);
    try {
      // Fetch current price alongside save (free, optional).
      let currentPrice: number | null = null;
      let name: string | null = null;
      try {
        const p = await fetch(
          `/api/positions/price?ticker=${encodeURIComponent(ticker)}`
        );
        if (p.ok) {
          const j = await p.json();
          currentPrice = j.price ?? null;
          name = j.name ?? null;
        }
      } catch {
        // ignore — price is optional
      }

      const res = await fetch("/api/positions/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker,
          shares: d.shares ? Number(d.shares) : null,
          entry_price: d.entry_price ? Number(d.entry_price) : null,
          current_price: currentPrice,
          name,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "save failed");
        return;
      }
      // Reset this draft and reload.
      updateDraft(d.key, { ticker: "", shares: "", entry_price: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "save failed");
    } finally {
      setSavingKey(null);
    }
  };

  const removePosition = async (id: string) => {
    setError(null);
    try {
      const res = await fetch("/api/positions/manual", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "delete failed");
        return;
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "delete failed");
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <p className="text-[color:var(--dopl-cream)]/55 text-sm">
          add your positions by hand. we&apos;ll pull the live price from yahoo
          finance — you can edit anytime.
        </p>
      </div>

      <GlassCard className="p-6 md:p-8 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-semibold">add positions</h3>
          <button
            onClick={addDraft}
            className="text-xs text-[color:var(--dopl-lime)] hover:text-[color:var(--dopl-cream)] transition-colors flex items-center gap-1.5"
          >
            <Plus size={14} /> another row
          </button>
        </div>

        <div className="space-y-3">
          {drafts.map((d) => {
            const busy = savingKey === d.key;
            return (
              <div
                key={d.key}
                className="grid grid-cols-[1fr_80px_110px_auto_auto] gap-2 items-center"
              >
                <input
                  type="text"
                  value={d.ticker}
                  onChange={(e) =>
                    updateDraft(d.key, { ticker: e.target.value.toUpperCase() })
                  }
                  placeholder="ticker"
                  className="bg-[color:var(--dopl-deep)] border border-[color:var(--dopl-sage)]/30 rounded-lg px-3 py-2 text-sm font-mono uppercase tracking-wider"
                />
                <input
                  type="number"
                  step="any"
                  value={d.shares}
                  onChange={(e) =>
                    updateDraft(d.key, { shares: e.target.value })
                  }
                  placeholder="shares"
                  className="bg-[color:var(--dopl-deep)] border border-[color:var(--dopl-sage)]/30 rounded-lg px-3 py-2 text-sm font-mono"
                />
                <input
                  type="number"
                  step="any"
                  value={d.entry_price}
                  onChange={(e) =>
                    updateDraft(d.key, { entry_price: e.target.value })
                  }
                  placeholder="entry $"
                  className="bg-[color:var(--dopl-deep)] border border-[color:var(--dopl-sage)]/30 rounded-lg px-3 py-2 text-sm font-mono"
                />
                <button
                  onClick={() => lookupPrice(d.key, d.ticker)}
                  disabled={!d.ticker || priceLoadingKey === d.key}
                  title="look up current price"
                  className="p-2 rounded-lg glass-card-light hover:bg-[color:var(--dopl-sage)]/40 text-[color:var(--dopl-cream)]/70 disabled:opacity-40"
                >
                  {priceLoadingKey === d.key ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Search size={14} />
                  )}
                </button>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => saveDraft(d)}
                    disabled={!d.ticker || busy}
                    className="btn-lime text-xs px-3 py-2 flex items-center gap-1"
                  >
                    {busy ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Check size={12} />
                    )}
                    save
                  </button>
                  {drafts.length > 1 && (
                    <button
                      onClick={() => removeDraft(d.key)}
                      className="p-2 text-[color:var(--dopl-cream)]/40 hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <p className="mt-4 text-xs text-red-400 font-mono">{error}</p>
        )}
      </GlassCard>

      <GlassCard className="p-6 md:p-8">
        <h3 className="font-display text-lg font-semibold mb-4">
          your positions
          {positions.length > 0 && (
            <span className="ml-2 text-xs font-mono text-[color:var(--dopl-cream)]/40">
              ({positions.length})
            </span>
          )}
        </h3>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-[color:var(--dopl-cream)]/50">
            <Loader2 size={14} className="animate-spin" /> loading…
          </div>
        ) : positions.length === 0 ? (
          <p className="text-sm text-[color:var(--dopl-cream)]/40">
            no positions yet. add your first above.
          </p>
        ) : (
          <div className="divide-y divide-[color:var(--dopl-sage)]/20">
            {positions.map((p) => (
              <div
                key={p.id}
                className="py-3 flex items-center gap-4 text-sm"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-mono font-semibold">{p.ticker}</div>
                  {p.name && (
                    <div className="text-xs text-[color:var(--dopl-cream)]/40 truncate">
                      {p.name}
                    </div>
                  )}
                </div>
                <div className="font-mono text-xs text-[color:var(--dopl-cream)]/70 w-20 text-right">
                  {p.shares ?? "—"} sh
                </div>
                <div className="font-mono text-xs text-[color:var(--dopl-cream)]/70 w-24 text-right">
                  {p.current_price != null
                    ? `$${p.current_price.toFixed(2)}`
                    : p.entry_price != null
                    ? `$${p.entry_price.toFixed(2)}`
                    : "—"}
                </div>
                <button
                  onClick={() => removePosition(p.id)}
                  className="text-[color:var(--dopl-cream)]/40 hover:text-red-400 p-1"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
