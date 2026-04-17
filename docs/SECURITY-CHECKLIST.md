# dopl-app — Security Checklist

Reference doc for security audits. Each item is a future plan, not scope for any single plan. Sprint 3 runs the audit and applies fixes.

Trimmed from dopl-mvp's SECURITY-AUDIT.md into a checklist format so it stays short and auditable. When a finding comes up, link to this file and track it in `docs/CHANGELOG.md`.

---

## Authentication & Authorization

- [ ] All API routes use `supabase.auth.getUser()` — never `getSession()` (sessions can be spoofed client-side)
- [ ] No client components import `supabase-admin` (service role key must not enter the client bundle)
- [ ] All API routes that mutate data check ownership of the target row, even when RLS is enabled (defense in depth)
- [ ] No service-role route performs a public read without an explicit allowlist of fields returned
- [ ] Middleware enforces role-based access (`fund_manager` → `/dashboard`, `subscriber` → `/feed`, unauthenticated → `/login`)

## Data Exposure

- [ ] No `select('*')` on tables containing sensitive fields (`snaptrade_user_secret`, `saltedge_customer_id`, `stripe_account_id`)
- [ ] Public endpoints (no auth) return only public-safe fields — not PII, not secrets
- [ ] Share card / public profile endpoints redact `email`, `auth.users` fields
- [ ] Stripe webhook and callback routes never leak the full event/payload in logs or responses

## Input Validation

- [ ] All API routes validate numeric input (reject NaN, Infinity, negative when not allowed)
- [ ] String inputs are length-capped (no unbounded user text that ends up in DB)
- [ ] UUID-shaped params are validated before using in queries
- [ ] File/image uploads have size and MIME-type limits
- [ ] No SQL injection surface (Supabase parameterizes, but verify no raw SQL strings are concatenated)

## Secrets & Keys

- [ ] `.env.local` is gitignored (verified 2026-04-17 — `.env*` is in .gitignore with `.env.example` exempted)
- [ ] No secret appears in git history (run `gitleaks` or equivalent)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is only read in server-side modules (check bundle analysis)
- [ ] Stripe, SnapTrade, Salt Edge secrets are server-only
- [ ] No secret logged to console, Sentry, or Vercel logs

## Row-Level Security

- [ ] Every table has RLS enabled (verified 2026-04-17 — all 7 tables in `supabase/schema.sql`)
- [ ] RLS policies exist for SELECT, INSERT, UPDATE, DELETE as applicable
- [ ] Policies use `auth.uid()` checks, not just `true`
- [ ] Service-role usage is auditable and minimal (only when RLS must be bypassed, e.g., webhook handlers)

## Payments & Webhooks

- [ ] Stripe webhook verifies signature before processing (verified 2026-04-17 in `src/app/api/stripe/webhook/route.ts`)
- [ ] Stripe webhook handler is idempotent (same event delivered twice must not double-subscribe)
- [ ] `application_fee_percent` is applied on every subscription (10%)
- [ ] SnapTrade/Salt Edge callbacks verify the request came from the provider (signature, nonce, or state param)

## Rate Limiting

- [ ] Public endpoints (no auth) are rate-limited or cached: `/api/positions/price`, share card, public profile fetch
- [ ] Login/signup endpoints have attempt limits to prevent credential stuffing
- [ ] Expensive endpoints (SnapTrade sync, Salt Edge sync) are queued/debounced per user

## Miscellaneous

- [ ] `npm audit` has no critical/high vulnerabilities (current: 2 moderate via axios/snaptrade SDK — see §7.10 of state-of-repo audit)
- [ ] No secrets in Stripe/SnapTrade/Salt Edge logs (these services log requests; verify payloads don't include our keys)
- [x] `/api/migrate` endpoint is gated behind an admin token or removed (flagged in state-of-repo §7.6) (gated 2026-04-17, Plan 3, Task 2)
- [ ] CSP headers set (no inline scripts without nonce)
- [ ] `X-Frame-Options: DENY` or `frame-ancestors 'none'` to prevent clickjacking on auth pages
- [ ] HTTPS enforced in production (Vercel default)

---

## Findings tracking

When an audit surfaces a finding, append a row here:

| Date | Finding | Severity | Sprint | Status |
|------|---------|----------|--------|--------|
| 2026-04-17 | `/api/migrate` reachable without admin gate | Medium | Sprint 1 | Resolved 2026-04-17 |
| 2026-04-17 | axios CVEs (SSRF, header injection) transitive via snaptrade SDK | Moderate | Sprint 3 | Open (no user-input vector) |
| 2026-04-17 | Stripe lib eager init causes cold `next build` failure | Low | Sprint 1 | Open |
