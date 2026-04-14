"use client";

import { useState } from "react";
import { CreditCard, CheckCircle, ExternalLink } from "lucide-react";

export default function BillingClient({
  onboarded,
  hasAccount,
  subscriberCount,
  mrrCents,
}: {
  onboarded: boolean;
  hasAccount: boolean;
  subscriberCount: number;
  mrrCents: number;
}) {
  const [loading, setLoading] = useState(false);

  const handleSetupStripe = async () => {
    setLoading(true);
    const res = await fetch("/api/stripe/connect", { method: "POST" });
    const { url } = await res.json();
    if (url) window.location.href = url;
    setLoading(false);
  };

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold mb-2">billing</h1>
      <p className="text-dopl-cream/50 text-sm mb-8">
        set up payments to receive subscription revenue
      </p>

      {onboarded && (
        <div className="grid md:grid-cols-3 gap-4 mb-8 max-w-2xl">
          <div className="glass-card p-5">
            <p className="text-xs text-dopl-cream/40 mb-1">MRR</p>
            <p className="font-mono text-2xl font-bold text-dopl-lime">
              ${(mrrCents / 100).toFixed(0)}
            </p>
          </div>
          <div className="glass-card p-5">
            <p className="text-xs text-dopl-cream/40 mb-1">doplers</p>
            <p className="font-mono text-2xl font-bold">{subscriberCount}</p>
          </div>
          <div className="glass-card p-5">
            <p className="text-xs text-dopl-cream/40 mb-1">your cut</p>
            <p className="font-mono text-2xl font-bold">
              ${((mrrCents * 0.9) / 100).toFixed(0)}
            </p>
          </div>
        </div>
      )}

      <div className="max-w-lg">
        {!onboarded ? (
          <div className="glass-card p-10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-dopl-sage/30 flex items-center justify-center mx-auto mb-6">
              <CreditCard size={28} className="text-dopl-lime" />
            </div>
            <h2 className="font-display text-xl font-semibold mb-2">
              {hasAccount ? "finish Stripe setup" : "set up Stripe"}
            </h2>
            <p className="text-dopl-cream/50 text-sm mb-2">
              connect your bank account to receive subscription payments.
            </p>
            <p className="text-xs text-dopl-cream/30 mb-6">
              dopl takes 10% of each subscription. you keep 90%.
            </p>
            <button
              onClick={handleSetupStripe}
              disabled={loading}
              className="btn-lime w-full text-sm py-3"
            >
              {loading
                ? "redirecting to Stripe..."
                : hasAccount
                ? "continue onboarding"
                : "set up payments"}
            </button>
          </div>
        ) : (
          <div className="glass-card p-10 text-center">
            <CheckCircle size={48} className="text-dopl-lime mx-auto mb-4" />
            <h2 className="font-display text-xl font-semibold mb-2">
              payments active
            </h2>
            <p className="text-dopl-cream/50 text-sm mb-6">
              payouts go directly to your bank via Stripe.
            </p>
            <a
              href="https://dashboard.stripe.com"
              target="_blank"
              rel="noopener noreferrer"
              className="glass-card-light px-6 py-2.5 text-sm inline-flex items-center gap-2 hover:bg-dopl-sage/40 transition-colors"
            >
              <ExternalLink size={14} />
              open Stripe dashboard
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
