"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowRight, Link2 } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { BrokerPreferencePicker } from "@/components/broker-preference-picker";

// Dopler region step removed Sprint 14 — Sprint 8 stripped dopler broker
// connection for regulatory reasons, so the region question no longer
// served any routing purpose. Doplers go welcome → broker preference
// (deep-link target) → /feed.
const STEPS = ["welcome", "broker"] as const;

export default function WelcomeClient({
  firstName,
}: {
  firstName: string;
}) {
  const [step, setStep] = useState(0);
  const [brokerChosen, setBrokerChosen] = useState(false);

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <main className="min-h-screen relative overflow-hidden flex items-center justify-center px-6 py-10">
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(800px 400px at 50% -10%, rgba(197,214,52,0.1), transparent 60%), radial-gradient(700px 400px at 100% 100%, rgba(45,74,62,0.5), transparent 60%)",
        }}
      />

      <div className="relative w-full max-w-xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35 }}
          >
            {step === 0 && (
              <GlassCard className="p-10 md:p-12 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[color:var(--dopl-lime)]/12 border border-[color:var(--dopl-lime)]/25 flex items-center justify-center text-[color:var(--dopl-lime)] mx-auto mb-6">
                  <Sparkles size={22} />
                </div>
                <h1 className="font-display text-4xl md:text-5xl font-semibold leading-tight tracking-tight">
                  welcome to dopl
                  {firstName ? `, ${firstName}` : ""}
                </h1>
                <p className="text-[color:var(--dopl-cream)]/60 text-sm md:text-base mt-4 mb-6 max-w-md mx-auto">
                  find a fund manager worth dopling. when they trade, you&apos;ll
                  see it live — tap to execute in your own broker.
                </p>
                <button
                  onClick={next}
                  className="btn-lime text-sm px-7 py-3 inline-flex items-center gap-2"
                >
                  let&apos;s go
                  <ArrowRight size={14} />
                </button>
              </GlassCard>
            )}

            {step === 1 && (
              <GlassCard className="p-8 md:p-10">
                <div className="w-12 h-12 rounded-2xl bg-[color:var(--dopl-lime)]/12 border border-[color:var(--dopl-lime)]/25 flex items-center justify-center text-[color:var(--dopl-lime)] mb-5">
                  <Link2 size={22} />
                </div>
                <h2 className="font-display text-2xl md:text-3xl font-semibold leading-tight tracking-tight">
                  which broker do you use?
                </h2>
                <p className="text-[color:var(--dopl-cream)]/55 text-sm mt-2 mb-6">
                  we&apos;ll deep-link you straight to it when a fund manager
                  trades. no account linking required.
                </p>
                <BrokerPreferencePicker
                  initial={null}
                  onSaved={() => setBrokerChosen(true)}
                />
                <div className="flex items-center justify-between mt-6">
                  <button
                    onClick={prev}
                    className="text-xs text-[color:var(--dopl-cream)]/50 hover:text-[color:var(--dopl-cream)]"
                  >
                    ← back
                  </button>
                  {brokerChosen ? (
                    <button
                      onClick={() => {
                        window.location.href = "/feed";
                      }}
                      className="btn-lime text-sm px-6 py-2.5 inline-flex items-center gap-2"
                    >
                      continue
                      <ArrowRight size={14} />
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        window.location.href = "/feed";
                      }}
                      className="text-xs text-[color:var(--dopl-cream)]/50 hover:text-[color:var(--dopl-cream)]"
                    >
                      skip for now →
                    </button>
                  )}
                </div>
              </GlassCard>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
}
