import { Snaptrade } from "snaptrade-typescript-sdk";

/**
 * SnapTrade client.
 *
 * Sandbox support — inspected the TS SDK (v9) on 2026-04-22:
 *   - SDK has no built-in sandbox flag. `Configuration` exposes
 *     `basePath` + credential params; there's no sandbox constant in
 *     `base.js` (default is `https://api.snaptrade.com/api/v1`).
 *   - SnapTrade's sandbox isolation is at the CREDENTIAL level. Partners
 *     register a separate test app in the SnapTrade dashboard and get a
 *     distinct clientId/consumerKey pair. Those credentials hit the same
 *     API endpoint but expose a test-brokerage catalog — e.g. "SnapTrade
 *     Test Brokerage" / "Interactive Brokers Sandbox" — that accept
 *     mock credentials and return simulated positions/balances. No OAuth
 *     changes vs production.
 *
 * Toggle: set `SNAPTRADE_SANDBOX=true` + both
 * `SNAPTRADE_SANDBOX_CLIENT_ID` and `SNAPTRADE_SANDBOX_CONSUMER_KEY`.
 * If the toggle is set but either credential is missing, we fall back
 * to production keys rather than construct a half-configured client —
 * keeps dev setup failures loud instead of silently routing to prod.
 *
 * `SNAPTRADE_BASE_URL` is an optional escape hatch. The API endpoint is
 * the same in prod and sandbox today, but if SnapTrade ships a distinct
 * sandbox URL later, flipping this env var is enough — no code change
 * needed.
 */
export type SnaptradeMode = "production" | "sandbox";

export interface ResolvedSnaptradeCredentials {
  clientId: string;
  consumerKey: string;
  mode: SnaptradeMode;
  basePath?: string;
}

export function resolveSnaptradeCredentials(
  env: NodeJS.ProcessEnv = process.env
): ResolvedSnaptradeCredentials {
  const sandboxRequested = env.SNAPTRADE_SANDBOX === "true";
  const sandboxClient = env.SNAPTRADE_SANDBOX_CLIENT_ID;
  const sandboxKey = env.SNAPTRADE_SANDBOX_CONSUMER_KEY;
  const basePath = env.SNAPTRADE_BASE_URL || undefined;

  if (sandboxRequested && sandboxClient && sandboxKey) {
    return {
      clientId: sandboxClient,
      consumerKey: sandboxKey,
      mode: "sandbox",
      basePath,
    };
  }

  return {
    clientId: env.SNAPTRADE_CLIENT_ID ?? "",
    consumerKey: env.SNAPTRADE_CONSUMER_KEY ?? "",
    mode: "production",
    basePath,
  };
}

const resolved = resolveSnaptradeCredentials();

/** Resolved mode at module init. "sandbox" iff the toggle + both sandbox creds were set. */
export const snaptradeMode: SnaptradeMode = resolved.mode;

export const snaptrade = new Snaptrade({
  clientId: resolved.clientId,
  consumerKey: resolved.consumerKey,
  ...(resolved.basePath ? { basePath: resolved.basePath } : {}),
});
