/**
 * Pure function to resolve a fund manager's display identity
 * from the two possible sources: a `fund_managers` row and a
 * `profiles` row (backstop for FMs not yet provisioned).
 *
 * Extracted from src/app/feed/page.tsx so it's unit-testable.
 * Callers do the map lookups and pass the two rows in.
 */

export function norm(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t.length > 0 ? t : null
}

export interface FmRow {
  display_name?: string | null
  handle?: string | null
  avatar_url?: string | null
  broker_provider?: string | null
}

export interface ProfileRow {
  full_name?: string | null
  email?: string | null
}

export interface ResolvedFm {
  handle: string | null
  display_name: string
  avatar_url: string | null
  broker_provider: string | null
}

export function resolveFm(
  fm: FmRow | null | undefined,
  profile: ProfileRow | null | undefined,
  id?: string | null
): ResolvedFm {
  const idStub =
    typeof id === 'string' && id.length > 0
      ? `fm_${id.slice(0, 6)}`
      : null
  const handle =
    norm(fm?.handle) ??
    norm(profile?.email?.split('@')[0]) ??
    idStub ??
    null
  const display_name =
    norm(fm?.display_name) ??
    norm(profile?.full_name) ??
    handle ??
    'unknown'
  return {
    handle,
    display_name,
    avatar_url: norm(fm?.avatar_url),
    broker_provider: norm(fm?.broker_provider),
  }
}
