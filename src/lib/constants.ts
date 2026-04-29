/**
 * Shared constants safe to import from both client and server modules.
 * `lib/stripe.ts` imports the server-only Stripe SDK, so client
 * components can't pull constants from it directly. This module is
 * the single source of truth — `stripe.ts` re-exports from here.
 */

/**
 * Platform fee dopl takes from every paid subscription, expressed as a
 * percentage of the FM's price. Wired into Stripe Connect as
 * `application_fee_percent` and surfaced verbatim in user-facing copy
 * ("includes 10% platform fee", "you keep 90%").
 */
export const DOPL_FEE_PERCENT = 10;
