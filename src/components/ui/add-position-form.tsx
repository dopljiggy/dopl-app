"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, X } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { InlineError } from "@/components/ui/inline-error";

interface AddPositionFormProps {
  portfolioId: string;
  onDone: () => void;
}

/**
 * Inline "add position" form that mounts on a portfolio card. Writes the
 * row via POST /api/positions/manual with the portfolio_id set — the
 * route's Sprint 6 path fires fanOutPortfolioUpdate, so every active
 * dopler gets a buy notification on success. Auto-fetches current price
 * from /api/positions/price if the FM didn't enter one. Uses the Sprint
 * 4 <SubmitButton> + <InlineError> primitives for pending + error
 * surfaces.
 */
export function AddPositionForm({ portfolioId, onDone }: AddPositionFormProps) {
  const router = useRouter();
  const [ticker, setTicker] = useState("");
  const [shares, setShares] = useState("");
  const [price, setPrice] = useState("");
  const [priceLoading, setPriceLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookupPrice = async () => {
    const t = ticker.trim();
    if (!t) return;
    setPriceLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/positions/price?ticker=${encodeURIComponent(t)}`
      );
      const data = (await res.json()) as { price?: number; error?: string };
      if (!res.ok) {
        setError(data.error ?? "price lookup failed");
        return;
      }
      if (data.price != null) setPrice(String(data.price));
    } catch (err) {
      setError(err instanceof Error ? err.message : "price lookup failed");
    } finally {
      setPriceLoading(false);
    }
  };

  const submit = async () => {
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    setError(null);

    // Auto-fetch current price + name if the FM didn't set one manually.
    // Same pattern as src/components/connect/manual-entry.tsx.
    let currentPrice: number | null = price.trim()
      ? Number(price)
      : null;
    let fetchedName: string | null = null;
    if (currentPrice == null) {
      try {
        const p = await fetch(
          `/api/positions/price?ticker=${encodeURIComponent(t)}`
        );
        if (p.ok) {
          const j = (await p.json()) as { price?: number; name?: string };
          currentPrice = j.price ?? null;
          fetchedName = j.name ?? null;
        }
      } catch {
        /* price lookup is optional; ignore */
      }
    }

    const res = await fetch("/api/positions/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        portfolio_id: portfolioId,
        ticker: t,
        shares: shares ? Number(shares) : null,
        current_price: currentPrice,
        name: fetchedName,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(json.error ?? "could not add position");
      return;
    }
    setTicker("");
    setShares("");
    setPrice("");
    router.refresh();
    onDone();
  };

  return (
    <div className="glass-card-light p-4 rounded-xl">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[color:var(--dopl-cream)]/50">
          add position
        </p>
        <button
          onClick={onDone}
          className="text-[color:var(--dopl-cream)]/40 hover:text-[color:var(--dopl-cream)]"
          aria-label="close"
        >
          <X size={14} />
        </button>
      </div>
      <div className="grid grid-cols-[1fr_80px_110px_auto] gap-2 items-center">
        <input
          type="text"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="ticker"
          className="bg-[color:var(--dopl-deep)] border border-[color:var(--dopl-sage)]/30 rounded-lg px-3 py-2 text-sm font-mono uppercase tracking-wider"
        />
        <input
          type="number"
          step="any"
          value={shares}
          onChange={(e) => setShares(e.target.value)}
          placeholder="shares"
          className="bg-[color:var(--dopl-deep)] border border-[color:var(--dopl-sage)]/30 rounded-lg px-3 py-2 text-sm font-mono"
        />
        <input
          type="number"
          step="any"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="price $"
          className="bg-[color:var(--dopl-deep)] border border-[color:var(--dopl-sage)]/30 rounded-lg px-3 py-2 text-sm font-mono"
        />
        <button
          onClick={lookupPrice}
          disabled={!ticker.trim() || priceLoading}
          title="look up current price"
          className="p-2 rounded-lg glass-card-light hover:bg-[color:var(--dopl-sage)]/40 text-[color:var(--dopl-cream)]/70 disabled:opacity-40"
          aria-label="look up current price"
        >
          {priceLoading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Search size={14} />
          )}
        </button>
      </div>
      <div className="flex items-center justify-end mt-3">
        <SubmitButton
          onClick={submit}
          disabled={!ticker.trim()}
          pendingLabel="adding..."
          className="text-xs px-4 py-2"
          data-testid="add-position-submit"
        >
          add
        </SubmitButton>
      </div>
      {error && (
        <div className="mt-3">
          <InlineError message={error} onDismiss={() => setError(null)} />
        </div>
      )}
    </div>
  );
}
