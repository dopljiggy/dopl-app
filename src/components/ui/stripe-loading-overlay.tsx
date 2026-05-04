"use client";

import { motion, AnimatePresence } from "framer-motion";

/**
 * Full-screen branded loading overlay shown between a 'connect to
 * Stripe' action and the actual window.location.href redirect.
 *
 * Why: the bare `window.location.href = stripeUrl` line produces a
 * disorienting white flash on every Stripe entry point — paid
 * subscribe (portfolio detail + tier card) and FM Connect onboarding.
 * The overlay holds the brand frame for the ~200-600ms before the
 * navigation kicks in and dopl drops out.
 *
 * Uses framer's <AnimatePresence> for a clean fade so the overlay
 * doesn't pop in on the first paint of the next page if the redirect
 * happens to be near-instant.
 */
export function StripeLoadingOverlay({ open }: { open: boolean }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.2, 0.7, 0.2, 1] }}
          className="fixed inset-0 z-[90] flex items-center justify-center"
          aria-hidden
          style={{
            background:
              "radial-gradient(700px 400px at 50% 0%, rgba(197,214,52,0.12), transparent 60%), rgba(13,38,31,0.96)",
          }}
        >
          <div className="relative flex flex-col items-center gap-5">
            <div
              className="absolute -inset-12 rounded-full blur-3xl"
              style={{
                background: "rgba(197,214,52,0.28)",
                animation: "stripe-overlay-pulse 1.6s ease-in-out infinite",
              }}
              aria-hidden
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/dopl-logo.svg"
              alt=""
              width={64}
              height={64}
              className="relative rounded-2xl"
            />
            <p className="relative text-sm font-mono text-[color:var(--dopl-cream)]/80">
              connecting to Stripe...
            </p>
            <style>{`
              @keyframes stripe-overlay-pulse {
                0%, 100% { opacity: 0.45; transform: scale(1); }
                50% { opacity: 0.9; transform: scale(1.08); }
              }
            `}</style>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
