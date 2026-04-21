# dopl-app — Changelog

All code changes logged in reverse chronological order.
Format: date, description, files, why, impact, testing, risks.

---

## [2026-04-21] — Sprint 3 hotfix round 4 (Task 20)

**Files changed:**
- `src/app/[handle]/profile-tiers.tsx` — `doplFree` now pushes to `/feed` instead of `/feed/<portfolioId>?subscribed=true`.
- `src/app/api/stripe/checkout/route.ts` — Stripe checkout success_url is now `/feed?subscribed=true` instead of a portfolio-specific URL.
- `src/app/feed/[portfolioId]/page.tsx` — Replaces `notFound()` with `redirect("/feed")` when the portfolio isn't found. Stops doplers hitting dead-end 404 pages on stale or deleted portfolio ids.

**Why:** Surfer hit a 404 after doplFree pushed to `/feed/<portfolioId>?subscribed=true` (image #45). Regardless of root cause (stale id, RLS, race), the simpler UX is to land on `/feed` which already lists all subscribed portfolios — no portfolio-id wrangling, no 404 surface. One consistent post-subscribe destination for both free and paid flows.

**Testing:** `npm test` 71/71, `npm run build` clean.

**Risks:** Loses the per-portfolio deeplink after subscribe. If that deeplink matters later (e.g., sharing a specific doplin portfolio), reintroduce via a separate "view portfolio" action from the feed list.

---

## [2026-04-21] — Sprint 3 hotfix round 3 (Tasks 17-19)

**Files changed:**
- `src/app/[handle]/profile-tiers.tsx` — `doplFree()` now `router.push('/feed/<id>?subscribed=true')` after success (matching the paid-checkout flow). Previously only refreshed in place, leaving doplers stranded on the FM's profile with a "dopling ✓" chip but no sense of completion.
- `src/components/ui/notification-bell.tsx` — Dropdown renders via `createPortal` to `document.body` with `position: fixed` anchored via `getBoundingClientRect`. Click-outside handler updated to treat the portaled dropdown as in-scope. Round 1's `top-full` tweak and R1/R2 defensive z-stacking are superseded by this approach.
- `src/components/dopler-shell.tsx` — Drops the now-unneeded `relative z-40` wrapper around the bell.
- `src/app/[handle]/page.tsx` — Wraps the page in `DoplerShell` when the viewer is an authed subscriber, so realtime toasts have a bell to retrieve them from. Unauthed visitors and FM viewers keep the existing lean public layout.

**Why:** Surfer's round-3 smoke found (a) free dopl left the user on `/<handle>` with no redirect, (b) `/[handle]` had no top nav at all so realtime toasts vanished with no recovery path, (c) the bell UI distortion from images #28/#43 persisted after the round-1 defensive fix.

**Impact:** Closes out Phase 1 UI friction. Dopler flow now has a coherent "slide → arrive on feed" loop matching the paid flow.

**Testing:** `npm test` 71/71, `npm run build` clean. Manual verification pending on Surfer side.

**Risks:** Portal-based dropdown repositions on scroll/resize; computed via `getBoundingClientRect` which reads layout (OK at click-time, listeners added/removed on open toggle so no perf impact when closed).

---

## [2026-04-21] — Sprint 3 hotfix round 2 (Tasks 13-16)

**Files changed:**
- `src/app/onboarding/onboarding-client.tsx` + `page.tsx` — Broker step embedded inline in the wizard. No more navigation to `/dashboard/connect` (which dropped FMs into the full dashboard layout with sidebar). Step now branches on `broker_provider` derived from region: SnapTrade or Salt Edge renders a provider-specific "connect" button that fires register+connect APIs then redirects to external OAuth; manual explains positions will be added later. Initial state extended with `region`, `brokerProvider`, `hasSnaptradeUser`, `hasSaltedgeCustomer`. Stripe step now opens Stripe Connect in a new tab (`window.open` instead of `window.location.href`) and surfaces an "i'm done — check status" button that calls `router.refresh()` to re-read `stripe_onboarded` after the async account.updated webhook fires. Portfolio step amber copy updated to reflect pre-Stripe creation.
- `src/app/api/stripe/connect/route.ts` — Accepts `{from: "onboarding"}` body; when set, return_url and refresh_url point to `/onboarding?stripe_done=true` instead of `/dashboard/billing`. Also defaults Stripe Express accounts to `business_type: "individual"` to skip the UAE-heavy business-docs verification flow (Trade License, Memorandum of Association). Individual FMs go through shorter personal ID verification instead; company FMs can switch back inside Stripe's hosted flow.
- `src/app/api/portfolios/route.ts` + `[id]/route.ts` — Paid portfolio POST/PATCH no longer blocked when `stripe_onboarded=false`. Dopler-side "finalizing setup" UI lock + `/api/stripe/checkout` (which needs a charge-enabled account) remain as defense in depth. Lets FMs create paid tiers during onboarding in one shot, unblocks Smokes 4+5.

**Why:** Surfer's smoke revealed two blockers: (a) broker step navigated users out of the wizard context, leaving them on the full dashboard with a dead onboarding progress bar at top, (b) Stripe setup hijacked the current tab, creating a confusing multi-hop loop (onboarding → Stripe → billing page → "continue onboarding" button → re-launch Stripe).

**Impact:** Onboarding wizard now stays self-contained end-to-end except for the unavoidable external OAuth redirect (SnapTrade/Salt Edge/Stripe) — and even those loop back cleanly via the cookie-based callback path added in hotfix round 1.

**Testing:** `npm test` 71/71, `npm run build` clean. Surfer to re-run Smoke 2 end-to-end.

**Risks:** Provider-specific inline flow depends on `broker_provider` being set by the region step. If a user lands on the wizard with a stale `broker_provider=null` in DB (unlikely), the broker step defaults to SnapTrade. Acceptable per region→provider mapping.

---

## [2026-04-21] — Sprint 3 hotfix round (Tasks 9-12)

**Files changed:**
- `src/app/onboarding/onboarding-client.tsx` — Stripe step unconditional (removes circular gate where paid portfolio creation was blocked until Stripe, and Stripe step only showed after paid portfolio existed). Surfaces 400 `error + next` from `/api/portfolios` inline. Broker step now uses a `launchBrokerConnect()` helper that sets a short-lived `dopl_onboarding_flow` cookie and navigates to `/dashboard/connect?from=onboarding`; on return (`?connected=true`), the wizard auto-advances past the broker step.
- `src/app/(dashboard)/dashboard/portfolios/portfolios-client.tsx` — same error-surfacing pattern in the create modal (inline red banner with billing link).
- `src/app/api/snaptrade/callback/route.ts` + `src/app/api/saltedge/callback/route.ts` — cookie-based branching: when `dopl_onboarding_flow=1` is present, success redirects to `/onboarding?connected=true` (and errors to `/onboarding?error=…`) instead of `/dashboard/connect`. Cookie cleared on every redirect response.
- `src/components/ui/notification-bell.tsx` — dropdown uses `top-full` for explicit anchoring (was relying on static-position + `mt-2`).
- `src/components/dopler-shell.tsx` — bell wrapper gains `relative z-40` to isolate its stacking layer inside the sticky nav's backdrop-blur context.

**Why:** Surfer's 2026-04-21 browser smoke of the deployed Sprint 3 code surfaced 4 blockers: (1) circular Stripe-gate made new FMs unable to reach the "set up stripe" step, (2) paid portfolio create appeared stuck because the 400 response wasn't surfaced to the UI, (3) broker step sent FMs to `/dashboard/connect` with no return path back to the onboarding wizard, (4) notification bell click visibly distorted the top nav layout.

**Impact:** Phase 1 ship readiness unblocked. New FMs can now complete the onboarding wizard end-to-end: profile → region → broker (with auto-return) → portfolio (paid tiers show a pre-creation warning instead of silently failing) → stripe → share.

**Testing:** `npm test` 71/71 green, `npm run build` clean. Manual verification pending on Surfer side.

**Risks:** Bell UI fix is defensive — applied without being able to reproduce the distortion in a headless env. If the symptom persists, a second pass with DOM-inspector evidence is needed.

---

## [2026-04-20] — Sprint 3: Ship-to-Real-Users (Phase 1)

**Files changed:**
- `src/app/page.tsx` + `__tests__/home-redirect.test.ts` — authed users hitting `/` redirect to role-appropriate page (FM → /dashboard, connected dopler → /feed, unconnected dopler → /welcome). 5 unit tests pin the pure helper `determineAuthedHomeTarget`.
- `src/lib/onboarding-gates.ts` + `__tests__/` — pure predicate `fmNeedsOnboarding`; 5 unit tests.
- `src/app/api/auth/provision/route.ts` — returns `needs_onboarding: true` for fresh fund_managers.
- `src/app/(auth)/signup/page.tsx` — FM first-signup now routes to `/onboarding` (not `/dashboard`). Duplicate email, handle collision, and password-too-short errors surfaced inline.
- `src/app/(auth)/login/page.tsx` — "invalid login credentials" and "email not confirmed" surfaced with friendlier copy.
- `src/app/(dashboard)/layout.tsx` + `dashboard-chrome.tsx` — layout converted to a server component that fetches FM + portfolio count and runs the `fmNeedsOnboarding` gate; existing client nav extracted to `dashboard-chrome.tsx`.
- `src/app/onboarding/page.tsx` + `onboarding-client.tsx` — conditional Stripe Connect step inserted between portfolio and share when any portfolio is priced > 0. Step ordering is named (not numeric) so the conditional step doesn't break offsets. `Progress` bar now takes `steps` as a prop.
- `src/app/api/portfolios/route.ts` + `[id]/route.ts` — paid-tier POST/PATCH refused unless `stripe_onboarded=true`. Returns 400 with `next: /dashboard/billing`.
- `src/app/(dashboard)/dashboard/portfolios/page.tsx` + `portfolios-client.tsx` — lock badge on draft paid portfolios when FM not onboarded.
- `src/app/[handle]/page.tsx` + `profile-tiers.tsx`, `src/app/feed/[portfolioId]/page.tsx` + `portfolio-detail-client.tsx` — slide-to-dopl on paid tiers replaced with "this fund manager is finalizing setup" when FM not onboarded.
- `src/components/notifications-context.tsx` + `dopler-shell.tsx` — `useNotifications` lifted to shell-only via `NotificationsProvider`. Single hook instance owned by DoplerShell.
- `src/app/notifications/notifications-client.tsx`, `src/components/ui/notification-bell.tsx`, `src/components/ui/notification-toast-listener.tsx` — all consume `useNotificationsContext()` instead of calling the hook directly.
- `src/app/notifications/__tests__/notifications-client.test.tsx` — regression guard: `useNotifications` cannot be called from within the inbox.
- `src/app/notifications/notifications-client.tsx`, `src/components/ui/notification-popup.tsx` — render a small "manual" chip when `notification.meta?.manual === true`.
- `src/lib/notification-fanout.ts` + test — `FanoutInput` gains `meta_extend?: Record<string, unknown>`; every emitted notif row's `meta` merges it in. +1 unit test.
- `src/app/api/portfolios/notify/route.ts` — accepts top-level `meta` field, passes through as `meta_extend`.
- `src/components/ui/send-manual-update-modal.tsx` — new modal (ticker + direction + optional note). POSTs to `/api/portfolios/notify` with `meta: { manual: true }`.
- `src/app/(dashboard)/dashboard/portfolios/expandable-portfolio-card.tsx` — new "send manual update" trigger per portfolio.
- `src/app/(dashboard)/dashboard/portfolios/__tests__/send-manual-update.test.tsx` — 3 integration tests covering disabled/enabled state + POST payload including `meta.manual === true`.

**Why:** Phase 1 of the ship-to-real-users roadmap. Closes five launch-blocking gaps (home redirect, FM signup → onboarding, paid-portfolio gate, inbox realtime race, auth error surfacing) and adds a small send-manual-update UI for FMs without a connected broker.

**Impact:**
- Brand-new FM signup now flows through the 5-step (or 6-step with Stripe) onboarding.
- Paid portfolios can't be published without Stripe Connect complete; doplers see a finalizing-setup card instead of silent checkout failure.
- Authed users hitting `/` reach their role-appropriate page instead of the marketing landing.
- Dopler inbox updates live without refresh. Manually-sent notifications carry a visible "manual" tag.
- Signup/login error messages are clear and inline; handle collision is pinned under the handle input.
- FMs without a connected broker can announce thesis updates via the new modal.

**Testing:** `npm test` = **71 passing across 14 files** (56 Sprint 2 baseline + 5 home redirect + 5 onboarding predicate + 1 notifications regression + 1 fanout meta_extend + 3 send-manual-update).

**Risks:**
- Stripe onboarding webhook latency — FM returning to the Stripe step before `stripe_onboarded=true` propagates sees the step still unchecked. Accept short-term UX lag; Sprint 4 can add a focus-listener re-check.
- Existing prod FMs: the `fmNeedsOnboarding` predicate passes any FM with a bio, broker_connected, or at least one portfolio. Per pre-deploy spot check, the 4 live FMs all satisfy at least one of those. Pre-merge SQL check: `select id, handle, bio, broker_connected, (select count(*) from portfolios where fund_manager_id = fm.id) as portfolio_count from fund_managers fm;` — every row must have one of the three.
- Send-manual-update bypasses broker-sync truth — mitigated by the `meta.manual=true` flag + visible inbox chip so doplers can tell which notifications are broker-verified.

---

## [2026-04-20] — Dopler sign-out access on desktop

**Files changed:**
- `src/components/dopler-shell.tsx` — desktop top nav gains a User-icon link to `/settings`, placed next to the bell. Hidden on mobile (bottom nav's profile tab already covers it).

**Why:** Post-Sprint-2 smoke exposed that doplers on desktop had no access to `/settings` from the top-level UI — the only sign-out path required typing the URL manually. FM side has sign-out one click away via the sidebar; dopler side had asymmetric UX.

**Impact:** One-click path to `/settings` (and its existing `<SignOutButton>`) from any dopler page on desktop. Mobile path unchanged — still via the bottom-nav profile tab.

**Testing:** Tests unchanged. Manual smoke: log in as dopler on desktop, confirm user icon appears right of the bell, clicking lands on `/settings`, sign-out button visible there.

**Risks:** None. Pure additive change; no conditional render flaps.

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
