"use client";

import { useEffect, useRef, useState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { InlineError } from "@/components/ui/inline-error";

type Props = {
  subscriptionId: string;
  onCancelled?: () => void;
};

/**
 * Two-click confirm cancel built on `<SubmitButton>`. First click arms
 * the button into a red "confirm cancel" state for 3 seconds; a second
 * click within that window fires DELETE /api/subscriptions and returns
 * a Promise so SubmitButton manages the pending spinner automatically.
 * Failures surface via `<InlineError>`, matching the Sprint 4
 * error-surface standard — no alert(), no toast.
 */
export function CancelSubscriptionButton({
  subscriptionId,
  onCancelled,
}: Props) {
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!armed) return;
    timerRef.current = setTimeout(() => setArmed(false), 3000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [armed]);

  const cancel = async () => {
    const res = await fetch("/api/subscriptions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription_id: subscriptionId }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setError(j.error ?? "could not cancel subscription");
      setArmed(false);
      return;
    }
    onCancelled?.();
    setArmed(false);
  };

  const handleClick = () => {
    if (!armed) {
      // First click — arm the confirm, no Promise returned so SubmitButton
      // stays idle (no pending spinner flash on the arming tap).
      setArmed(true);
      setError(null);
      return;
    }
    // Second click — return the Promise for SubmitButton to manage the
    // pending state through the fetch lifecycle.
    return cancel();
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <SubmitButton
        onClick={handleClick}
        variant="secondary"
        pendingLabel="cancelling..."
        className={`px-4 py-2 text-xs rounded-lg transition-colors ${
          armed
            ? "text-red-300 border border-red-400/40 hover:bg-red-500/10"
            : "text-[color:var(--dopl-cream)]/60 hover:text-[color:var(--dopl-cream)]"
        }`}
      >
        {armed ? "confirm cancel" : "cancel"}
      </SubmitButton>
      {error && (
        <InlineError message={error} onDismiss={() => setError(null)} />
      )}
    </div>
  );
}
