"use client";

import Link from "next/link";
import { X } from "lucide-react";

type Props = {
  message: string;
  nextHref?: string;
  nextLabel?: string;
  onDismiss?: () => void;
  variant?: "error" | "warning";
};

/**
 * Consistent inline error/warning banner. Replaces scattered alert()
 * calls and ad-hoc red/amber divs across forms + modals.
 */
export function InlineError({
  message,
  nextHref,
  nextLabel = "go set it up →",
  onDismiss,
  variant = "error",
}: Props) {
  const palette =
    variant === "warning"
      ? "border-amber-400/30 bg-amber-400/5 text-amber-200/80"
      : "border-red-400/30 bg-red-500/5 text-red-200/80";

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-xs ${palette}`}
    >
      <div className="flex-1">
        <p>{message}</p>
        {nextHref && (
          <Link
            href={nextHref}
            className="underline underline-offset-2 mt-1 inline-block hover:opacity-80"
          >
            {nextLabel}
          </Link>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="dismiss"
          className="shrink-0 opacity-50 hover:opacity-100"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
