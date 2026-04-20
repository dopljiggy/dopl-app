export interface FmOnboardingShape {
  bio: string | null;
  broker_connected: boolean;
}

/**
 * Returns true when a fund manager hasn't completed enough of the
 * onboarding flow to be safely sent to the main dashboard. Used by
 * both the post-signup redirect and the /dashboard layout gate.
 *
 * Heuristic: if they have ANY portfolio, or a non-null bio, or a
 * connected broker → they've engaged with onboarding. Otherwise
 * send them to /onboarding.
 */
export function fmNeedsOnboarding(
  fm: FmOnboardingShape | null | undefined,
  portfolioCount: number
): boolean {
  if (!fm) return true;
  if (portfolioCount > 0) return false;
  if (fm.bio && fm.bio.trim().length > 0) return false;
  if (fm.broker_connected) return false;
  return true;
}
