import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not configured — set it in .env.local or the deployment environment"
    );
  }
  _stripe = new Stripe(key, { apiVersion: "2026-03-25.dahlia" });
  return _stripe;
}

// Re-exported from constants.ts (the single source of truth) so client
// components — which can't pull from this server-only module — can also
// reference the same value.
export { DOPL_FEE_PERCENT } from "./constants";
