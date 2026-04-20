export interface DoplerFeedGateInput {
  role: "fund_manager" | "subscriber";
  tradingConnected: boolean;
  path: string;
}

/**
 * Returns true if a subscriber is trying to reach /feed without having
 * connected a trading provider. Used by proxy.ts to redirect to /welcome.
 */
export function doplerNeedsOnboarding(input: DoplerFeedGateInput): boolean {
  if (input.role !== "subscriber") return false;
  if (input.tradingConnected) return false;
  return input.path === "/feed" || input.path.startsWith("/feed/");
}
