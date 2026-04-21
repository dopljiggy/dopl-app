"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle } from "lucide-react";

export default function OAuthReturnPage() {
  const params = useSearchParams();
  const provider = params?.get("provider") ?? null;
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    try {
      window.close();
    } catch {
      /* ignore */
    }
    const t = setTimeout(() => setShowFallback(true), 300);
    return () => clearTimeout(t);
  }, []);

  const providerLabel =
    provider === "snaptrade"
      ? "SnapTrade"
      : provider === "saltedge"
      ? "Salt Edge"
      : provider === "stripe"
      ? "Stripe"
      : "your broker";

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="glass-card p-10 text-center max-w-sm">
        <CheckCircle
          size={48}
          className="text-[color:var(--dopl-lime)] mx-auto mb-4"
        />
        <h1 className="font-display text-2xl font-semibold mb-2">
          connected via {providerLabel}
        </h1>
        <p className="text-sm text-[color:var(--dopl-cream)]/60 mb-6">
          return to dopl to continue onboarding.
        </p>
        {showFallback && (
          <button
            onClick={() => {
              try {
                window.close();
              } catch {
                /* ignore */
              }
              window.location.href = "/onboarding?connected=true";
            }}
            className="btn-lime w-full text-sm py-3"
          >
            return to dopl
          </button>
        )}
      </div>
    </main>
  );
}
