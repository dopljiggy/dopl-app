"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  X,
  Pencil,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { InlineError } from "@/components/ui/inline-error";
import {
  TickerSearch,
  type TickerSearchSelection,
} from "@/components/ui/ticker-search";

interface AddPositionFormProps {
  portfolioId: string;
  onDone: () => void;
}

type Quote = {
  price: number | null;
  change: number | null;
  changePercent: number | null;
  name?: string | null;
};

const THESIS_MAX = 280;

/**
 * FM trading terminal. Replaces the legacy 4-column grid with a vertical
 * flow: ticker search → live quote card → buy-mode toggle (shares vs.
 * dollars) → thesis note → submit. Submits POST /api/positions/manual
 * with the same shape as before plus `thesis_note`.
 *
 * Graceful degradation: if Finnhub + Yahoo both fail, the quote route
 * returns `price: null` (200, not 502) — we surface a manual-price input
 * so the FM can still add the position with their own pricing.
 */
export function AddPositionForm({ portfolioId, onDone }: AddPositionFormProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<TickerSearchSelection | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [marketOpen, setMarketOpen] = useState<boolean | null>(null);
  const [buyMode, setBuyMode] = useState<"shares" | "amount">("shares");
  const [shares, setShares] = useState("");
  const [amount, setAmount] = useState("");
  const [manualPrice, setManualPrice] = useState("");
  const [thesis, setThesis] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Fetch quote + market status in parallel on selection.
  useEffect(() => {
    if (!selected) {
      setQuote(null);
      setMarketOpen(null);
      return;
    }
    let cancelled = false;
    setQuoteLoading(true);
    Promise.all([
      fetch(`/api/market/quote?ticker=${encodeURIComponent(selected.symbol)}`)
        .then((r) => r.json())
        .catch(() => ({
          price: null,
          change: null,
          changePercent: null,
        })),
      fetch("/api/market/status")
        .then((r) => r.json())
        .catch(() => ({ isOpen: false })),
    ]).then(([q, s]) => {
      if (cancelled) return;
      setQuote({
        price: q?.price ?? null,
        change: q?.change ?? null,
        changePercent: q?.changePercent ?? null,
        name: q?.name ?? null,
      });
      setMarketOpen(!!s?.isOpen);
      setQuoteLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const reset = () => {
    setSelected(null);
    setQuote(null);
    setMarketOpen(null);
    setShares("");
    setAmount("");
    setManualPrice("");
    setThesis("");
    setError(null);
  };

  const effectivePrice = (() => {
    if (quote?.price != null) return quote.price;
    const m = Number(manualPrice);
    return Number.isFinite(m) && m > 0 ? m : null;
  })();

  const computedShares =
    buyMode === "shares"
      ? Number(shares) || 0
      : effectivePrice && Number(amount)
        ? Number(amount) / effectivePrice
        : 0;
  const computedTotal =
    buyMode === "shares"
      ? (Number(shares) || 0) * (effectivePrice ?? 0)
      : Number(amount) || 0;

  const submit = async () => {
    if (!selected) return;
    if (computedShares <= 0) {
      setError("enter shares or amount");
      return;
    }
    setError(null);
    const res = await fetch("/api/positions/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        portfolio_id: portfolioId,
        ticker: selected.symbol,
        shares: computedShares,
        current_price: effectivePrice,
        name: quote?.name ?? selected.description,
        thesis_note: thesis.trim() || null,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(json.error ?? "could not add position");
      return;
    }
    reset();
    router.refresh();
    onDone();
  };

  const submitDisabled = !selected || computedShares <= 0 || !effectivePrice;

  return (
    <div className="glass-card-light p-4 rounded-xl space-y-4">
      <div className="flex items-center justify-between">
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

      {!selected ? (
        <TickerSearch onSelect={setSelected} autoFocus />
      ) : (
        <>
          {/* Selected ticker header — change link sends back to search */}
          <div className="flex items-baseline justify-between">
            <div className="min-w-0">
              <p className="font-mono text-2xl font-bold tracking-tight text-[color:var(--dopl-lime)]">
                {selected.symbol}
              </p>
              <p className="text-xs text-[color:var(--dopl-cream)]/50 truncate">
                {quote?.name ?? selected.description}
              </p>
            </div>
            <button
              type="button"
              onClick={reset}
              className="text-xs text-[color:var(--dopl-cream)]/50 hover:text-[color:var(--dopl-cream)] inline-flex items-center gap-1"
              aria-label="change ticker"
            >
              <Pencil size={11} />
              change
            </button>
          </div>

          {/* Quote card OR manual-price fallback */}
          {quoteLoading ? (
            <div className="flex items-center gap-2 text-xs text-[color:var(--dopl-cream)]/40 py-2">
              <Loader2 size={12} className="animate-spin" />
              fetching live quote…
            </div>
          ) : quote?.price != null ? (
            <div className="rounded-xl p-3 bg-[color:var(--dopl-deep)] border border-[color:var(--dopl-sage)]/25 flex items-center justify-between">
              <div>
                <p className="font-mono text-2xl font-bold tabular-nums">
                  ${quote.price.toFixed(2)}
                </p>
                {quote.change != null && quote.changePercent != null && (
                  <p
                    className={`text-xs font-mono inline-flex items-center gap-1 mt-0.5 ${
                      quote.change >= 0
                        ? "text-[color:var(--dopl-lime)]"
                        : "text-red-400"
                    }`}
                  >
                    {quote.change >= 0 ? (
                      <TrendingUp size={11} />
                    ) : (
                      <TrendingDown size={11} />
                    )}
                    {quote.change >= 0 ? "+" : ""}
                    {quote.change.toFixed(2)} (
                    {quote.changePercent >= 0 ? "+" : ""}
                    {quote.changePercent.toFixed(2)}%)
                  </p>
                )}
              </div>
              <span
                className={`text-[10px] font-mono uppercase tracking-[0.18em] px-2 py-1 rounded ${
                  marketOpen
                    ? "bg-[color:var(--dopl-lime)]/15 text-[color:var(--dopl-lime)]"
                    : "bg-[color:var(--dopl-sage)]/40 text-[color:var(--dopl-cream)]/60"
                }`}
              >
                {marketOpen ? "open" : "closed"}
              </span>
            </div>
          ) : (
            <div className="rounded-xl p-3 bg-[color:var(--dopl-deep)] border border-amber-500/25 space-y-2">
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-amber-300/80">
                price unavailable — enter manually
              </p>
              <input
                type="number"
                step="any"
                value={manualPrice}
                onChange={(e) => setManualPrice(e.target.value)}
                placeholder="price per share $"
                className="w-full bg-[color:var(--dopl-deep-2)] border border-[color:var(--dopl-sage)]/30 rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>
          )}

          {/* Buy mode pills */}
          <div className="flex items-center gap-2">
            {(["shares", "amount"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setBuyMode(mode)}
                className={`text-xs px-3 py-1.5 rounded-full font-mono uppercase tracking-wider transition-colors ${
                  buyMode === mode
                    ? "bg-[color:var(--dopl-lime)]/15 text-[color:var(--dopl-lime)] border border-[color:var(--dopl-lime)]/30"
                    : "text-[color:var(--dopl-cream)]/50 border border-[color:var(--dopl-sage)]/30 hover:text-[color:var(--dopl-cream)]"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          {/* Quantity input + computed counterpart */}
          {buyMode === "shares" ? (
            <div>
              <input
                type="number"
                step="any"
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                placeholder="shares"
                className="w-full bg-[color:var(--dopl-deep)] border border-[color:var(--dopl-sage)]/30 rounded-lg px-3 py-2.5 text-sm font-mono"
              />
              {Number(shares) > 0 && effectivePrice && (
                <p className="text-[11px] font-mono text-[color:var(--dopl-cream)]/40 mt-1.5">
                  {Number(shares)} sh × ${effectivePrice.toFixed(2)} = $
                  {computedTotal.toFixed(2)}
                </p>
              )}
            </div>
          ) : (
            <div>
              <input
                type="number"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="$ amount"
                className="w-full bg-[color:var(--dopl-deep)] border border-[color:var(--dopl-sage)]/30 rounded-lg px-3 py-2.5 text-sm font-mono"
              />
              {Number(amount) > 0 && effectivePrice && (
                <p className="text-[11px] font-mono text-[color:var(--dopl-cream)]/40 mt-1.5">
                  ${Number(amount).toFixed(2)} / ${effectivePrice.toFixed(2)} ≈{" "}
                  {computedShares.toFixed(2)} sh
                </p>
              )}
            </div>
          )}

          {/* Thesis note */}
          <div>
            <input
              type="text"
              value={thesis}
              onChange={(e) =>
                setThesis(e.target.value.slice(0, THESIS_MAX))
              }
              placeholder="why this trade? (optional)"
              maxLength={THESIS_MAX}
              className="w-full bg-[color:var(--dopl-deep)] border border-[color:var(--dopl-sage)]/30 rounded-lg px-3 py-2.5 text-sm placeholder:text-[color:var(--dopl-cream)]/30"
            />
            <p className="text-[10px] font-mono text-[color:var(--dopl-cream)]/30 mt-1 text-right">
              {thesis.length}/{THESIS_MAX}
            </p>
          </div>

          <div className="flex items-center justify-end pt-1">
            <SubmitButton
              onClick={submit}
              disabled={submitDisabled}
              pendingLabel="adding..."
              className="text-xs px-5 py-2.5"
              data-testid="add-position-submit"
            >
              add to portfolio
            </SubmitButton>
          </div>
        </>
      )}

      {error && (
        <InlineError message={error} onDismiss={() => setError(null)} />
      )}
    </div>
  );
}
