"use client";

import { useState } from "react";

export default function SubscribeButton({
  portfolioId,
  priceCents,
}: {
  portfolioId: string;
  priceCents: number;
}) {
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portfolioId }),
    });
    const { url } = await res.json();
    if (url) window.location.href = url;
    setLoading(false);
  };

  return (
    <button
      onClick={handleSubscribe}
      disabled={loading}
      className="btn-lime text-sm px-8 py-3"
    >
      {loading
        ? "redirecting..."
        : `subscribe — $${(priceCents / 100).toFixed(0)}/mo`}
    </button>
  );
}
