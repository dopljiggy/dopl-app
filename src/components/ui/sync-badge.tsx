import { Zap, Hand } from "lucide-react";

/**
 * Tiny label that tells doplers whether a fund manager's positions sync
 * automatically from a live broker feed or whether the fund manager
 * updates them by hand.
 *
 *  - broker_provider === "manual"  → amber "manual"
 *  - anything else (snaptrade/saltedge) → lime "live"
 */
export function SyncBadge({
  provider,
  className = "",
}: {
  provider: string | null | undefined;
  className?: string;
}) {
  const isManual = provider === "manual";
  return (
    <span
      title={
        isManual
          ? "fund manager updates positions manually"
          : "positions sync live from broker"
      }
      className={
        "inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] font-mono px-2 py-0.5 rounded-full border " +
        (isManual
          ? "bg-amber-400/10 border-amber-400/40 text-amber-300 "
          : "bg-[color:var(--dopl-lime)]/10 border-[color:var(--dopl-lime)]/40 text-[color:var(--dopl-lime)] ") +
        className
      }
    >
      {isManual ? <Hand size={10} /> : <Zap size={10} />}
      {isManual ? "manual" : "live"}
    </span>
  );
}
