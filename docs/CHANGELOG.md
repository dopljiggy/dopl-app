# dopl-app — Changelog

All code changes logged in reverse chronological order.
Format: date, description, files, why, impact, testing, risks.

---

## [2026-04-20] — Sprint 2: Notification Loop v1

**Files changed:**
- `supabase/migrations/003_notifications_enhancements.sql` — new columns: `actionable` (bool, default true), `change_type` (enum), `ticker`, `meta` (jsonb); new index on (user_id, created_at desc)
- `src/app/api/migrate/route.ts` — hard-coded SQL extended with the 003 ALTERs so migration can run via admin-gated curl (no Supabase SQL editor required)
- `src/types/database.ts` — `Notification` interface extended
- `src/lib/position-diff.ts` + `__tests__/` — per-portfolio diff, 9 unit tests (scoped to already-assigned tickers; no buy events; preserves allocation_pct)
- `src/lib/notification-fanout.ts` + `__tests__/` — shared fan-out helper, 6 unit tests (buy-fanout, sell-not-held=informational, sell-held-elsewhere=actionable, rebalance-only summary, mixed, empty fallback)
- `src/lib/dopl-toast.ts` — extracted shared `fireToast`
- `src/lib/proxy-gates.ts` + `__tests__/` — `doplerNeedsOnboarding` helper, 5 unit tests
- `src/app/api/snaptrade/sync/route.ts` — per-portfolio targeted UPDATE (shares, last_synced) and DELETE; never touches allocation_pct; returns `positions` (raw pool) + `perPortfolio` (structured changes)
- `src/app/api/portfolios/notify/route.ts` — thin wrapper over `notification-fanout.ts`
- `src/app/api/positions/assign/route.ts` — inline `logUpdateAndNotify` removed; now calls the shared helper
- `src/proxy.ts` — uses the proxy-gate helper to redirect subscribers without `trading_connected` to `/welcome` when they hit `/feed`
- `src/app/welcome/page.tsx` + `welcome-client.tsx` — rebuilt as 3-step (intro → region → connect); step 3 embeds `<TradingConnect />` inline; server-side redirect if already connected
- `src/app/api/trading/snaptrade/callback/route.ts`, `src/app/api/trading/saltedge/callback/route.ts` — success redirect changed from `/settings?connected=true` to `/feed?connected=true`
- `src/app/(dashboard)/layout.tsx` — removed `<NotificationBell />` mount
- `src/components/dopler-shell.tsx` — gates bell behind `md:` viewport, mounts `<NotificationToastListener />`
- `src/components/ui/notification-bell.tsx` — inline toast effect removed; uses shared fireToast if still needed
- `src/components/ui/notification-toast-listener.tsx` — standalone toast effect with initial-mount + clock-skew guards
- `src/components/ui/notification-popup.tsx`, `src/app/notifications/notifications-client.tsx` — hide primary CTA when `actionable=false`, show "informational" tag
- `src/app/(dashboard)/dashboard/positions/positions-client.tsx` — opens the new modal after sync
- `src/components/ui/notify-doplers-modal.tsx` — modal with per-portfolio Notify + Save-silent + "notified" check + explicit done button

**Why:** Ships the core product loop promised at pivot-decision time: FM changes portfolio → dopler gets notified → dopler taps to open their own broker for manual execution.

**Impact:**
- Doplers cannot reach `/feed` without connecting a broker — removes the "subscribed but can't execute" footgun.
- FM syncs now scope to already-assigned tickers per portfolio, preserving both tier-based curation and FM-authored `allocation_pct`.
- Fan-out logic lives in one place. Both manual-notify and auto-on-assign paths use the same code; holder-aware + rebalance-summary apply to both.
- Mobile doplers: no more bell overlap with the viewport; bottom-nav alerts + full inbox is canonical. FM dashboard: no more dopler-style bell.

**Testing:** `npm test` = **56 passing across 10 files** (+5 proxy-gate, +9 position-diff, +6 notification-fanout, +36 Sprint 1 baseline). All expected-feature-invariant tests are real, not stubs.

**Risks:**
- Migration 003 must be applied before Task 4 code runs in prod. With the admin-curl path (Task 1 Step 1.2), this is a one-command deploy-complete action — no SQL editor coordination.
- `/api/snaptrade/sync`'s per-row UPDATE/DELETE is not transactional; a crash mid-sync could leave a portfolio partially updated. Acceptable at Sprint 2 scale (4 live FMs); Sprint 3 can wrap in a Postgres function if volume justifies.
- Toast listener is client-side; if the dopler's tab is backgrounded, no toast. That's expected — Web Push (Sprint 3) fills the gap for closed-app notification.

---

## [2026-04-17] — Sprint 1 Task 7: Onboarding handle + display_name enforcement

**Files changed:**
- `src/app/onboarding/onboarding-client.tsx` — surfaces handle field on Step 0, removes skip button from Step 0, disables continue until both display_name and handle are valid
- `src/app/api/profile/route.ts` — PATCH now rejects empty/whitespace display_name (400), validates handle against `/^[a-z0-9_-]{2,32}$/` (400 on mismatch)
- `src/app/api/profile/__tests__/route.test.ts` — new (7 tests covering all rejection paths)

**Why:** Root-cause fix for Sprint 1 Task 1's symptom. The id-stub fallback in `resolveFm` handles the render side, but a fund_manager could still land on `/dashboard` with `display_name=''` or a blank handle by skipping Step 0 or relying on the unvalidated PATCH path. This closes that gap at the source.

**Impact:**
- No new fund_manager rows can reach the dashboard without a valid handle + display_name.
- The `fm_{first6-of-id}` fallback from Task 1 becomes defense-in-depth only, not a regular path.

**Testing:** `npm test` (36 passing, 7 new); manual onboarding smoke test from fresh signup → Step 0 → advance to Step 1.

**Risks:** None identified. Existing fund_managers are unaffected (DB writes go through PATCH only on profile edit). The 4 live FMs in prod all have valid handles.

---

## [2026-04-17] — Plan 3.1: Lazy supabaseAdmin in Stripe webhook route

**Files changed:**
- `src/app/api/stripe/webhook/route.ts` — replaced inline module-level `createClient(...)` with `createAdminClient()` called inside the POST handler
- `src/app/api/stripe/webhook/__tests__/route.test.ts` — new, asserts module import is safe when Stripe or Supabase env vars are unset (3 tests)

**Why:** Plan 3 Task 4's `npm run build` verification exposed a second eager-init bug in the same file. `const supabaseAdmin = createClient(...)` at module level threw `supabaseUrl is required` at the "Collecting page data" stage when `NEXT_PUBLIC_SUPABASE_URL` was unset.

**Impact:** `npm run build` now succeeds with Stripe AND Supabase env vars unset. Plan 3 Goal #4 is delivered end-to-end.

**Testing:** `npm test` (29 passing, 3 new webhook tests); cold `npm run build` with `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` all unset completes successfully.

**Risks:** None. The existing `createAdminClient()` factory in `src/lib/supabase-admin.ts` is a drop-in replacement — same primitive, called at request time instead of module load.

---

## [2026-04-17] — Plan 3: Sprint 1 launch blockers

**Files changed:**
- `src/lib/fm-resolver.ts` — `resolveFm` accepts optional id, falls back to `fm_{first6}` then `'unknown'` (no more literal `'fund manager'`)
- `src/lib/__tests__/fm-resolver.test.ts` — updated pinned fallback test, added id-stub + never-literal tests
- `src/app/feed/page.tsx` — passes fm id into `resolveFm`
- `src/app/api/migrate/route.ts` — gated behind `MIGRATION_ADMIN_TOKEN` with `crypto.timingSafeEqual`
- `src/app/api/migrate/__tests__/route.test.ts` — new (5 tests)
- `src/proxy.ts` — renamed from `src/middleware.ts`; export `proxy` instead of `middleware` (Next.js 16)
- `src/lib/stripe.ts` — lazy `getStripe()` replaces eager module-level `stripe`
- `src/lib/__tests__/stripe.test.ts` — new (4 tests)
- `src/app/api/stripe/{connect,checkout,webhook}/route.ts`, `src/app/api/subscriptions/route.ts` — call `getStripe()` at handler entry
- `.env.example` — documents `MIGRATION_ADMIN_TOKEN`
- `docs/SECURITY-CHECKLIST.md` — ticked migrate-gate item, updated issues-log

**Why:** Close the four launch blockers identified in `research/state-of-repo-2026-04-17.md` §7.6 / §7.8 before Sprint 2 (notification loop v1) begins.

**Impact:**
- Doplers no longer see literal `'fund manager'` rendered as a display name.
- `/api/migrate` requires an admin token (401 otherwise); removes an unauthenticated service-role endpoint.
- `npm run build` emits zero `middleware`-convention deprecation warnings.
- `npm run build` succeeds with `STRIPE_SECRET_KEY` unset — unblocks future CI.

**Testing:** `npm test` (resolver tests expanded, 5 new migrate tests, 4 new stripe tests); manual `npm run build` with and without `STRIPE_SECRET_KEY`; verified proxy warning absent.

**Risks:** None identified beyond those flagged in the plan's Risks section.

---

## [2026-04-17] — Plan 1: Transition Setup + Code Audit

**Plan:** `plans/2026-04-17-transition-and-audit.md` (implemented)

**Files added:**
- `PIPELINE.md` — 3-instance workflow (Architect / Reviewer / Implementer)
- `CLAUDE-BRAND.md` — brand + design system (extracted from original CLAUDE.md)
- `STATUS.md` — living project summary
- `.env.example` — 10 documented env vars (gitignore now exempts this file)
- `research/state-of-repo-2026-04-17.md` — full repo audit (34 routes, 103 TS files, 12.3K LOC, DB schema, recent commits, build warnings, env var grep, npm audit snapshot)
- `research/pivot-decision-2026-04-16.md` — Alpaca → SnapTrade pivot record (copied from dopl-mvp)
- `research/competitive-landscape-2026-04-13.md` (copied from dopl-mvp)
- `research/copy-trading-competitors-2026-04-10.md` (renamed from alpaca-competitors-*)
- `docs/SECURITY-CHECKLIST.md` — security audit checklist (copied + trimmed from dopl-mvp)
- `vitest.config.ts` — test runner config (jsdom, globals, @/ alias)
- `src/test-helpers/setup.ts` — imports `@testing-library/jest-dom`
- `src/test-helpers/supabase-mock.ts` — ported `buildChain` mock from dopl-mvp
- `src/lib/fm-resolver.ts` — pure function `resolveFm(fm, profile)` extracted from `feed/page.tsx`
- `src/lib/__tests__/fm-resolver.test.ts` — 10 assertions covering norm + resolveFm fallback paths
- `src/lib/__tests__/supabase-mock.test.ts` — 4 assertions validating the mock
- `src/lib/__tests__/snaptrade.test.ts` — 2 assertions validating module loads

**Files modified:**
- `CLAUDE.md` — rewritten as engineering reference (tech stack, revenue, terminology, DB pointer, conventions, pipeline ref, changelog protocol, folder structure, gotchas). Brand content moved to CLAUDE-BRAND.md; Next.js 16 gotcha references AGENTS.md.
- `package.json` — added `test` and `test:watch` scripts, added devDeps: vitest, @testing-library/react, @testing-library/jest-dom, jsdom, @vitejs/plugin-react
- `.gitignore` — added `!.env.example` exemption so the template commits
- `src/app/feed/page.tsx` — replaced inline `resolveFm` closure with import from `@/lib/fm-resolver`; closure becomes `resolveFmById` that does map lookups and delegates to the pure function

**Memory folder populated:** `/Users/surfer/.claude/projects/-Users-surfer-Desktop-dopl-app/memory/` with 8 ported feedback files + 3 new dopl-app-specific memory files + rewritten `MEMORY.md` index.

**Why:** Foundational setup for 3-instance pipeline work on dopl-app. Establishes measurement baseline (audit), testing infrastructure (vitest), env var documentation, and pipeline conventions before Sprint 1 launches user-facing fixes.

**Impact:** No user-facing changes. Developer experience + future-plan fact base only. 15 tests now run under `npm test` where previously there were zero.

**Testing:**
- `npm test` — 15 passing across 3 test files (fm-resolver, supabase-mock, snaptrade)
- `npm run build` — TypeScript compiles cleanly; build fails at "Collecting page data" on the pre-existing Stripe eager-init bug (documented in `research/state-of-repo-2026-04-17.md` §7.3, tracked for Sprint 1). Not a regression.
- Manual: verified CLAUDE.md auto-load content covers tech stack + terminology; PIPELINE.md paths updated for dopl-app layout (no `dopl/` subfolder); memory folder files are complete.

**Risks:** None user-facing. The resolveFm refactor preserves exact behavior (including the "fund manager" fallback literal — that's Sprint 1's fix, not this plan's). axios CVEs (moderate, transitive via SnapTrade SDK) noted in §7.10 of audit — tracked for Sprint 3.

**Branch:** `chore/transition-setup` (local only — Surfer verifies + pushes + merges).
