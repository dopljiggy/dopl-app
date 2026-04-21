"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

type Props = {
  isPending?: boolean;
  onClick?: () => void | Promise<unknown>;
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
};

/**
 * Standard submit button with pending + disabled feedback. When `onClick`
 * returns a Promise, the button auto-flips to a pending state until the
 * promise settles (resolve OR reject). Synchronous handlers never flip.
 * Consumers may also pass `isPending` to control pending state externally.
 */
export function SubmitButton({
  isPending,
  onClick,
  children,
  pendingLabel = "loading...",
  variant = "primary",
  disabled,
  className = "",
  type = "button",
}: Props) {
  const [internalPending, setInternalPending] = useState(false);
  const pending = isPending || internalPending;
  const isDisabled = !!(disabled || pending);

  const base =
    variant === "primary" ? "btn-lime" : "glass-card-light";

  const handleClick = () => {
    if (!onClick) return;
    let result: void | Promise<unknown>;
    try {
      result = onClick();
    } catch (err) {
      // Synchronous throw — nothing to wait on; surface to caller.
      throw err;
    }
    if (result && typeof (result as Promise<unknown>).then === "function") {
      setInternalPending(true);
      Promise.resolve(result).finally(() => setInternalPending(false));
    }
  };

  return (
    <button
      type={type}
      onClick={handleClick}
      disabled={isDisabled}
      className={`${base} disabled:opacity-50 ${className}`.trim()}
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" />
          {pendingLabel}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
