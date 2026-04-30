"use client";

import { useState } from "react";
import { Calculator } from "lucide-react";

export type CalcPosition = {
  ticker: string;
  name: string | null;
  allocation_pct: number | null;
  current_price: number | null;
};

/**
 * Reference calculator: 'if I put $X into this portfolio, here's the
 * per-ticker dollar slice and an estimated share count at the current
 * price.' Pure client-side math, no API. Used in two places: the
 * portfolio detail page (post-dopl) and the public profile tier cards
 * (pre-dopl, only when positions are already visible).
 *
 * Disclaimer copy is mandatory — dopl is a transparency platform, not
 * a brokerage. The calculator helps doplers eyeball mirror sizing in
 * their own broker; it never executes trades.
 */
export function InvestmentCalculator({
  positions,
}: {
  positions: CalcPosition[];
}) {
  const [amountInput, setAmountInput] = useState<string>("");
  const amount = Number(amountInput);
  const valid = Number.isFinite(amount) && amount > 0;

  const rows = valid
    ? positions
        .filter(
          (p) =>
            p.allocation_pct != null &&
            p.allocation_pct > 0 &&
            p.current_price != null &&
            p.current_price > 0
        )
        .map((p) => {
          const slice = (amount * (p.allocation_pct as number)) / 100;
          const shares = slice / (p.current_price as number);
          return { ...p, slice, shares };
        })
    : [];

  return (
    <div className="glass-card-light rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Calculator
          size={14}
          className="text-[color:var(--dopl-cream)]/50"
        />
        <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/50">
          allocation calculator
        </p>
      </div>

      <div className="relative mb-4">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--dopl-cream)]/40 font-mono text-sm">
          $
        </span>
        <input
          type="number"
          step="any"
          min={0}
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value)}
          placeholder="enter your amount"
          className="w-full bg-[color:var(--dopl-deep)] border border-[color:var(--dopl-sage)]/30 rounded-lg pl-7 pr-3 py-2.5 text-sm font-mono tabular-nums focus:outline-none focus:border-[color:var(--dopl-lime)]/50 placeholder:text-[color:var(--dopl-cream)]/30 placeholder:font-sans"
        />
      </div>

      {valid && rows.length > 0 && (
        <div className="overflow-x-auto mb-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] font-mono uppercase tracking-[0.18em] text-[color:var(--dopl-cream)]/40">
                <th className="text-left px-3 py-2 font-normal">ticker</th>
                <th className="text-right px-3 py-2 font-normal">alloc</th>
                <th className="text-right px-3 py-2 font-normal">your $</th>
                <th className="text-right px-3 py-2 font-normal">≈ shares</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.ticker}
                  className="border-t border-[color:var(--glass-border)]"
                >
                  <td className="px-3 py-2 font-mono font-bold text-[color:var(--dopl-cream)]">
                    {r.ticker}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-[color:var(--dopl-cream)]/70">
                    {(r.allocation_pct as number).toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-[color:var(--dopl-lime)]">
                    ${r.slice.toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-[color:var(--dopl-cream)]/70">
                    {r.shares.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {valid && rows.length === 0 && (
        <p className="text-xs text-[color:var(--dopl-cream)]/40 mb-3">
          no positions with allocation + price data — calculator needs both.
        </p>
      )}

      <p className="text-[10px] text-[color:var(--dopl-cream)]/30 font-mono">
        for reference only — dopl does not execute trades.
      </p>
    </div>
  );
}
