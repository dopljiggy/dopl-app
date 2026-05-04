"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { fireToast } from "@/components/ui/toast";

type Variant = "icon" | "chip";

/**
 * Reusable "undopl" confirmation button. Variants:
 *   - icon  : subtle X in the corner of a feed section
 *   - chip  : "dopling ✓" pill that flips to "undopl?" on hover
 */
export default function UndoplButton({
  subscriptionId,
  portfolioName,
  fundManagerName,
  variant = "icon",
  onSuccess,
}: {
  subscriptionId: string;
  portfolioName: string;
  fundManagerName: string;
  variant?: Variant;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const undopl = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription_id: subscriptionId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        fireToast({ title: "couldn't undopl", body: j.error ?? "" });
        return;
      }
      fireToast({ title: `you've undopled ${portfolioName}` });
      setConfirming(false);
      onSuccess?.();
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  const modal = (
    <AnimatePresence>
      {confirming && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !busy && setConfirming(false)}
          className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
        >
          <motion.div
            initial={{ scale: 0.96, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-card glass-card-strong p-6 w-full max-w-md"
          >
            <h2 className="font-display text-xl font-semibold mb-2">
              Stop Dopling?
            </h2>
            <p className="text-sm text-[color:var(--dopl-cream)]/60 mb-6">
              you&apos;ll stop seeing{" "}
              <span className="text-[color:var(--dopl-cream)]">
                {fundManagerName}&apos;s
              </span>{" "}
              <span className="text-[color:var(--dopl-cream)]">
                {portfolioName}
              </span>{" "}
              in your feed. you can dopl again anytime.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={busy}
                className="btn-lime flex-1 py-2.5 text-sm disabled:opacity-50"
              >
                Keep Dopling
              </button>
              <button
                type="button"
                onClick={undopl}
                disabled={busy}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 text-sm rounded-xl font-semibold transition-colors disabled:opacity-50"
                style={{
                  background: "transparent",
                  border: "1px solid rgba(239, 68, 68, 0.55)",
                  color: "#fca5a5",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    "rgba(239, 68, 68, 0.12)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                {busy ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : null}
                {busy ? "Undopling..." : "Undopl"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {variant === "icon" ? (
        <button
          onClick={() => setConfirming(true)}
          aria-label={`undopl ${portfolioName}`}
          className="p-2 rounded-lg text-[color:var(--dopl-cream)]/40 hover:text-red-300 hover:bg-red-500/10 transition-colors"
        >
          <X size={16} />
        </button>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          className="group inline-flex w-full items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          style={{
            background: "rgba(197, 214, 52, 0.14)",
            border: "1px solid rgba(197, 214, 52, 0.35)",
            color: "#C5D634",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(239, 68, 68, 0.12)";
            e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.4)";
            e.currentTarget.style.color = "#fca5a5";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(197, 214, 52, 0.14)";
            e.currentTarget.style.borderColor = "rgba(197, 214, 52, 0.35)";
            e.currentTarget.style.color = "#C5D634";
          }}
        >
          <Check
            size={14}
            strokeWidth={2.6}
            className="group-hover:hidden"
          />
          <span className="group-hover:hidden">dopling</span>
          <span className="hidden group-hover:inline">undopl?</span>
        </button>
      )}

      {portalTarget && createPortal(modal, portalTarget)}
    </>
  );
}
