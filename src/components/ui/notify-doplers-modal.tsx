"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check } from "lucide-react";

type Change =
  | { type: "buy"; ticker: string; shares: number }
  | { type: "sell"; ticker: string; prevShares: number; positionId?: string }
  | {
      type: "rebalance";
      ticker: string;
      prevShares: number;
      shares: number;
      positionId?: string;
    };

export type PortfolioChangeset = {
  portfolio_id: string;
  portfolio_name: string;
  changes: Change[];
};

export function NotifyDoplersModal({
  open,
  changesets,
  onClose,
  onNotify,
}: {
  open: boolean;
  changesets: PortfolioChangeset[];
  onClose: () => void;
  onNotify: (portfolioId: string) => Promise<void>;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [notified, setNotified] = useState<Set<string>>(new Set());

  const withChanges = changesets.filter((c) => c.changes.length > 0);

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
            className="relative w-full max-w-lg bg-[color:var(--dopl-deep)] border border-[color:var(--dopl-sage)]/30 rounded-2xl p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-[color:var(--dopl-cream)]/50 hover:text-[color:var(--dopl-cream)]"
              aria-label="close"
            >
              <X size={18} />
            </button>

            <h2 className="font-display text-2xl font-semibold mb-4">
              portfolio{withChanges.length > 1 ? "s" : ""} updated
            </h2>

            {withChanges.length === 0 ? (
              <p className="text-[color:var(--dopl-cream)]/60 text-sm">
                sync complete — no changes to notify about.
              </p>
            ) : (
              <div className="space-y-4">
                {withChanges.map((cs) => {
                  const sells = cs.changes.filter((c) => c.type === "sell").length;
                  const rebalances = cs.changes.filter(
                    (c) => c.type === "rebalance"
                  ).length;
                  const summary = [
                    sells && `${sells} removed`,
                    rebalances && `${rebalances} rebalanced`,
                  ]
                    .filter(Boolean)
                    .join(", ");
                  const isPending = pending === cs.portfolio_id;
                  const isDone = notified.has(cs.portfolio_id);
                  return (
                    <div
                      key={cs.portfolio_id}
                      className="border border-[color:var(--dopl-sage)]/30 rounded-xl p-4"
                    >
                      <div className="font-display text-sm font-semibold mb-1">
                        {cs.portfolio_name}
                      </div>
                      <div className="text-[color:var(--dopl-cream)]/60 text-xs mb-3">
                        {summary}
                      </div>
                      {isDone ? (
                        <div className="text-xs text-[color:var(--dopl-lime)] flex items-center gap-1">
                          <Check size={12} /> notified
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            disabled={isPending}
                            onClick={async () => {
                              setPending(cs.portfolio_id);
                              try {
                                await onNotify(cs.portfolio_id);
                                setNotified(
                                  (prev) => new Set(prev).add(cs.portfolio_id)
                                );
                              } finally {
                                setPending(null);
                              }
                            }}
                            className="btn-lime text-xs px-4 py-2 disabled:opacity-50"
                          >
                            {isPending ? "notifying…" : "notify doplers"}
                          </button>
                          <button
                            onClick={() =>
                              setNotified(
                                (prev) => new Set(prev).add(cs.portfolio_id)
                              )
                            }
                            className="text-xs text-[color:var(--dopl-cream)]/50 hover:text-[color:var(--dopl-cream)] px-4 py-2"
                          >
                            save without notifying
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {notified.size === withChanges.length && (
                  <div className="pt-2">
                    <button
                      onClick={onClose}
                      className="text-xs text-[color:var(--dopl-lime)] hover:underline"
                    >
                      done
                    </button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
