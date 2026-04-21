"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { InlineError } from "@/components/ui/inline-error";

type Direction = "buy" | "sell" | "rebalance";

export function SendManualUpdateModal({
  open,
  portfolioId,
  portfolioName,
  onClose,
}: {
  open: boolean;
  portfolioId: string;
  portfolioName: string;
  onClose: () => void;
}) {
  const [direction, setDirection] = useState<Direction>("buy");
  const [ticker, setTicker] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const needsTicker = direction !== "rebalance";

  const submit = async () => {
    setPending(true);
    setError(null);
    try {
      const changes =
        direction === "rebalance"
          ? [
              {
                type: "rebalance",
                ticker: ticker || "portfolio",
                prevShares: 0,
                shares: 0,
              },
            ]
          : [
              {
                type: direction,
                ticker: ticker.trim().toUpperCase(),
                ...(direction === "buy"
                  ? { shares: 0 }
                  : { prevShares: 0 }),
              },
            ];
      const body: Record<string, unknown> = {
        portfolio_id: portfolioId,
        changes,
        meta: { manual: true },
      };
      if (note.trim()) body.description = note.trim();
      const res = await fetch("/api/portfolios/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Send failed");
      } else {
        setSent(true);
        setTimeout(() => {
          setSent(false);
          setTicker("");
          setNote("");
          onClose();
        }, 1500);
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-[color:var(--dopl-deep)] border border-[color:var(--dopl-sage)]/30 rounded-2xl p-8"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-[color:var(--dopl-cream)]/50 hover:text-[color:var(--dopl-cream)]"
            >
              <X size={18} />
            </button>
            <h2 className="font-display text-xl font-semibold mb-1">
              send manual update
            </h2>
            <p className="text-[color:var(--dopl-cream)]/60 text-xs mb-5">
              to doplers of {portfolioName}
            </p>

            <div className="flex gap-2 mb-4">
              {(["buy", "sell", "rebalance"] as Direction[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDirection(d)}
                  className={`flex-1 py-2 text-xs rounded-lg transition-colors ${
                    direction === d
                      ? "bg-[color:var(--dopl-lime)]/15 border border-[color:var(--dopl-lime)]/40 text-[color:var(--dopl-lime)]"
                      : "glass-card-light"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>

            {needsTicker && (
              <input
                type="text"
                value={ticker}
                onChange={(e) =>
                  setTicker(e.target.value.toUpperCase().slice(0, 10))
                }
                placeholder="ticker (e.g. AAPL)"
                className="w-full bg-[color:var(--dopl-deep)] border border-[color:var(--dopl-sage)]/30 rounded-xl px-4 py-3 text-sm mb-3 font-mono"
              />
            )}

            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 280))}
              rows={3}
              placeholder="optional thesis note"
              className="w-full bg-[color:var(--dopl-deep)] border border-[color:var(--dopl-sage)]/30 rounded-xl px-4 py-3 text-sm resize-none"
            />

            {error && (
              <div className="mt-2">
                <InlineError message={error} />
              </div>
            )}

            <div className="flex gap-2 mt-5 items-center justify-end">
              <button
                onClick={onClose}
                className="text-xs text-[color:var(--dopl-cream)]/50 hover:text-[color:var(--dopl-cream)] px-4 py-2"
              >
                cancel
              </button>
              {sent ? (
                <span className="btn-lime text-xs px-5 py-2 opacity-80">
                  sent ✓
                </span>
              ) : (
                <SubmitButton
                  onClick={submit}
                  isPending={pending}
                  pendingLabel="sending…"
                  disabled={needsTicker && !ticker.trim()}
                  className="text-xs px-5 py-2"
                >
                  send to doplers
                </SubmitButton>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
