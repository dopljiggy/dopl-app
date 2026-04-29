# dopl-app — Changelog

All code changes logged in reverse chronological order.
Format: date, description, files, why, impact, testing, risks.

---

## [2026-04-29] — Sprint 11: Perceived Load Speed (skeletons, fonts, splash, auth dedup, loader)

**Files changed:**
- `src/app/(dashboard)/dashboard/loading.tsx` (NEW) — shimmer skeleton matching the dashboard layout (title + checklist + 3 stat cards).
- `src/app/(dashboard)/dashboard/portfolios/loading.tsx` (NEW) — shimmer matching the portfolios list (title + new-portfolio button + 2 cards).
- `src/app/feed/loading.tsx` (NEW) — shimmer matching the feed (header + 2 collapsible portfolio cards with table rows).
- `src/app/notifications/loading.tsx` (NEW) — shimmer matching the notifications page (header + tab bar + 4 row skeletons).
- `src/app/settings/loading.tsx` (NEW) — shimmer matching settings (header + 3 label/input pairs).
- `src/app/layout.tsx` — replaced 3 Google Fonts `<link>` tags with `next/font/google` imports for `Fraunces`, `Inter`, `JetBrains_Mono`. Each font's CSS variable lands on `<html>`; the manual `<link rel="preconnect">` lines for `fonts.googleapis.com` / `fonts.gstatic.com` are gone.
- `src/app/globals.css` — `font-family` stacks now reference `var(--font-inter)`, `var(--font-fraunces)`, `var(--font-jetbrains-mono)` instead of the literal font names.
- `src/lib/supabase-server.ts` — `getCachedUser()` extended to return `{ supabase, user }` so callers re-use the cached client without paying for a second `createServerSupabase()` round-trip. `cache()` from React already deduplicates within a single server request.
- `src/app/(dashboard)/layout.tsx` + `src/app/(dashboard)/dashboard/page.tsx` — fixed the 2 existing callers of `getCachedUser()` to destructure `{ supabase, user }`. Same commit as the signature change so the type swap doesn't strand the codebase mid-build.
- 17 page files migrated from `createServerSupabase()` + `supabase.auth.getUser()` to `getCachedUser()`: `src/app/page.tsx`, `src/app/[handle]/page.tsx`, `src/app/feed/page.tsx`, `src/app/feed/[portfolioId]/page.tsx`, `src/app/settings/page.tsx`, `src/app/welcome/page.tsx`, `src/app/me/page.tsx`, `src/app/(public)/leaderboard/page.tsx`, `src/app/notifications/page.tsx`, `src/app/onboarding/page.tsx`, `src/app/(dashboard)/dashboard/portfolios/page.tsx`, `src/app/(dashboard)/dashboard/profile/page.tsx`, `src/app/(dashboard)/dashboard/positions/page.tsx`, `src/app/(dashboard)/dashboard/connect/page.tsx`, `src/app/(dashboard)/dashboard/billing/page.tsx`, `src/app/(dashboard)/dashboard/share/page.tsx`, `src/app/(dashboard)/fund-manager/activity/page.tsx`. API routes intentionally untouched — they handle independent requests and should each create their own auth context.
- `src/components/ui/aurora-loader.tsx` — route-change minimum dropped from 420ms → 150ms (loading.tsx skeletons now cover the heavy initial-render case). Fetch patch switched from a 200ms post-resolve extension to a 150ms start-delay: a setTimeout flips a flag and calls `start()` only if the request is still pending after 150ms; if the fetch resolves first, the timer is cleared and no spinner ever shows.
- `src/components/pwa/standalone-splash.tsx` — replaced the hardcoded 1500ms timer with a `dopl:content-ready` event listener (400ms minimum, 2000ms maximum fallback). Race-safe via a `window.__doplContentReady` global flag — dispatchers set the flag BEFORE dispatching; the splash checks the flag synchronously on mount so it dismisses correctly even if content's effects ran first.
- `src/components/dopler-shell.tsx` — added a `useEffect` that sets the `__doplContentReady` flag and dispatches `dopl:content-ready` after the shell mounts. Covers `/feed`, `/notifications`, `/settings`, `/leaderboard`, `/me`, `/[handle]`.
- `src/app/(dashboard)/dashboard-chrome.tsx` — same dispatcher pattern. Covers all `/dashboard/*` routes (the `(dashboard)` layout always wraps in DashboardChrome).
- `src/app/marketing-landing.tsx` — same dispatcher pattern. Covers the homepage (`/app/page.tsx` renders MarketingLanding).
- `plans/2026-04-29-sprint-11-performance.md` — Files Summary header corrected from "Modify (23)" → "Modify (25)" to match the actual count.

**Why:** Post-Sprint-10 smoke testing surfaced a slow PWA launch sequence — black screen → white screen → dopl logo splash → content. Investigation identified five additive layers stacking 2-4 seconds of perceived delay on a cold launch. All five fixes are independent: skeleton `loading.tsx` files replace the white-screen-during-server-render gap, splash dismissal is event-driven instead of timer-based, fonts are bundled in the app instead of downloaded from Google's CDN, the 17-page auth-call duplication is replaced with a single cached call, and the aurora loader stops flickering on fast fetches.

**Impact:**
- Cold launch: splash shows for ~400-600ms (until first client wrapper mounts) instead of the full 1500ms hardcoded duration. Maximum 2000ms if no dispatcher fires.
- Server-rendered routes show a shimmer skeleton during the SSR resolve instead of a blank white screen.
- Fonts ship from the same origin as the app — no DNS lookup, no preconnect, no FOIT flash on first paint.
- Pages sharing a layout (e.g., `/dashboard/*`) make one `getUser()` call per request instead of two — `(dashboard)/layout.tsx` and the destination page now share the cached call.
- Sub-150ms fetches show no spinner at all. Slower fetches still get the smooth aurora.
- No more flicker on fast fetches (CSS opacity ramp barely starting then immediately reversing).

**Testing:**
- `npm test` — 152/152 passing across 27 files (no test changes; Sprint 11 is purely runtime perf).
- `npm run build` — clean, no font warnings, no missing module warnings, all 5 new `loading.tsx` routes register.

**Risks:**
- `next/font/google` downloads the font binaries at build time. If the build environment can't reach Google's CDN, the build fails — Vercel's build infrastructure has been reliable here, so this is low-risk in practice.
- The splash event-dispatch pattern relies on at least one of the three dispatchers firing. Edge entry points (`/onboarding`, `/welcome`, the auth callback) don't have dispatchers and fall back to the 2000ms MAX. Acceptable for now; could be extended later if real usage shows long fallbacks on those paths.
- The `getCachedUser()` signature change is a one-shot migration — any future page that imports the old shape would break at compile time, which is the correct outcome.
- The aurora loader's 150ms start-delay relies on `setTimeout`/`clearTimeout` precision. On heavily-throttled devices this could shift by a few ms; not enough to matter for the spinner-vs-no-spinner threshold.

---

## [2026-04-29] — Sprint 10 Hotfix R1: Trading Terminal Polish + Rebalance Fanout + Feed Fixes

**Files changed:**
- `src/app/(dashboard)/dashboard/portfolios/expandable-portfolio-card.tsx` — H1 (overflow fix via framer `transitionEnd`), H2 (`useEffect` to sync draft on positions change after `router.refresh()`), H3 (per-row Pencil adjust + Trash2 delete buttons with inline confirmation rows + thesis input), H7 (pie chart color legend, replaced illustrative `LineChart` with a "performance tracking coming soon" placeholder, dropped `LineChart`/`Line`/`XAxis`/`YAxis` imports + `perfData` useMemo).
- `src/app/api/positions/manual/route.ts` — H4 step 2: upsert path now fires a rebalance fanout when shares actually changed. `Number(existing.shares) || 0` handles null shares; `prevShares !== newShares` guard prevents notification spam on no-op updates and price-only refreshes. Manual Holdings (no `portfolio_id`) still skips fanout.
- `src/lib/notification-fanout.ts` — H4 step 1 (rebalance variant of `FanoutChange` gains optional `price?: number`), H5 (`describeOneChange` widened from `FanoutChange & {buy|sell}` to `FanoutChange` with new rebalance branch composing `"rebalanced AMPX · 42 → 60 shares · $189.50"` + optional thesis tail; fanout loop split — `rebalances.length === 1` routes per-ticker through `describeOneChange` with `change_type: "rebalance"`, `> 1` keeps the summary path with `change_type: "summary"` to avoid spam during snaptrade-sync diffs).
- `src/lib/__tests__/notification-fanout.test.ts` — 2 new test cases locking the rebalance body format (shares + price body, shares + thesis body).
- `src/app/api/positions/manual/__tests__/route.test.ts` — split the legacy "upsert does not fire fanout" test into two: (1) shares changed → rebalance fanout asserted (prevShares, shares, price, thesis); (2) shares unchanged → no fanout.
- `src/app/feed/feed-sections.tsx` — H6a (table header `g/l` → `p/l`, locals renamed to `pl`/`plPositive`), H6b (per-portfolio total computed from `positions` prop; allocation column falls back to `(market_value / total) * 100` when `allocation_pct` is null; shows "—" only when both are missing).
- `src/app/feed/[portfolioId]/page.tsx` — H6c: switched portfolio + positions + updates reads from the cookie-bound client to the admin client, mirroring `/feed/page.tsx`. The user-session client respects the `is_active = true` RLS filter on portfolios; combined with admin-listed subscriptions on `/feed`, doplers could see a deactivated portfolio in their feed but get bounced to `/feed` when clicking. Visibility still gated by `canView` (`isOwner || isFree || subscribed`).
- `src/components/ui/notification-bell.tsx` — H8a: bell-dropdown notification click defers `setPopup` by one frame via `requestAnimationFrame` so the dropdown's exit animation can start; without this, layout measurement on mobile produced a top-anchored popup instead of centered. Reviewer flagged `onExitComplete` on the dropdown's `AnimatePresence` as the escalation path if rAF proves insufficient.
- `src/components/dopler-shell.tsx` — H8b: new `useEffect` calls `ServiceWorkerRegistration.getNotifications()` and closes each delivered push notification on initial mount AND on `visibilitychange` to "visible". Initial-mount call covers "user opened the app directly" (visibilitychange doesn't fire on first load). Optional chain on `navigator.serviceWorker` covers older Safari/iOS that don't support web push.

**Why:** Surfer's smoke tests after Sprint 10's merge surfaced 11 issues across the trading terminal, feed, notifications, and portfolio card. All bugs or small UX polish from the Sprint 10 feature set — no new scope. The most material fixes: (1) the autocomplete dropdown was getting clipped inside the expanded card so FMs couldn't see suggestions; (2) "your %" rendered 0 immediately after adding a position because draft state wasn't syncing on `router.refresh()`; (3) the upsert path was deliberately silent on share changes — Surfer wants doplers notified when an FM rebalances; (4) the dopler "view full portfolio" link bounced to `/feed` because of an admin/RLS asymmetry between the listing page and the detail page.

**Impact:**
- FM trading-terminal autocomplete now floats above the card's footer buttons. Adding a new position via the terminal updates the "your %" column immediately without a manual refresh.
- Each row in the FM portfolio table has Pencil + Trash2 buttons that toggle inline adjust and delete confirmation rows with a thesis input. The adjust flow re-uses the existing manual-route upsert path; the delete flow re-uses the manual-route DELETE.
- Doplers receive a notification when an FM changes the share count of an existing position. Lock screen shows "Portfolio Name / rebalanced AMPX · 42 → 60 shares · $189.50" with optional thesis tail. Multi-ticker rebalances (e.g. snaptrade-sync diffs covering multiple positions in one call) still produce a summary notification to avoid spam.
- Feed table header reads "p/l" instead of the engineer-jargon "g/l". Allocation column shows computed percentages for positions with market_value, eliminating the "—" cluster.
- "View full portfolio →" link now reaches the detail page even for portfolios the FM has deactivated, as long as the dopler still holds the subscription. Visibility gates unchanged.
- Pie chart now shows ticker labels via a color-swatch legend underneath. The fake "30-day performance" sin-wave chart is replaced with an honest "performance tracking coming soon" placeholder.
- Bell-dropdown notifications open the centered popup correctly on mobile; opening the app directly clears any lingering OS-tray push notifications.

**Testing:**
- `npm test` — 152/152 passing across 27 files (was 149/149; +2 rebalance body cases, +1 split of the upsert-fanout test into changed vs unchanged sub-cases).
- `npm run build` — clean.
- Manual smoke (Surfer, post-merge): see Sprint 10 plan's Manual Smoke section under "Hotfix Round 1." Trading terminal flow, inline adjust/delete, rebalance push delivery, feed allocation values, view-full-portfolio link, pie legend, popup centering, and push-tray clear.

**Risks:**
- Switching `/feed/[portfolioId]/page.tsx` to the admin client means RLS no longer guards the portfolio read. The visibility gate (`canView`) still enforces access, but a regression in `canView` would now leak more data than before. Coverage by automated tests is gap — flagged as future test work.
- `requestAnimationFrame` for the bell popup is a one-frame deferral. If mobile Safari still anchors the popup at the top after this, escalate to `onExitComplete` on the dropdown's `AnimatePresence` per the reviewer's note.
- `getNotifications()` on the service-worker registration is supported on Chrome/Firefox/Edge + Safari 16+. Older Safari/iOS don't have web push at all so the optional chain handles them; users on those builds won't get tray clearing but also wouldn't have notifications to clear.
- The new H3 inline adjust flow hits the manual upsert path which now fires fanout — the no-op guard prevents spam from accidental re-submits, but a price-only update (e.g. quote refresh while editing) won't notify either. Acceptable for now; a future "price update" change_type could lift this.

---

## [2026-04-29] — Sprint 10: FM Trading Terminal + Feed Redesign + Thesis Notes + Richer Notifications

**Files changed:**
- `.env.example` — added `FINNHUB_API_KEY` placeholder.
- `src/lib/finnhub.ts` — new shared module wrapping Finnhub REST (`/search`, `/quote`, `/stock/market-status`) with module-scope TTL cache (5 min / 30 s / 60 s) and `AbortSignal.timeout(5000)` on every fetch.
- `src/app/api/market/search/route.ts` — new authed GET that returns Common-Stock autocomplete suggestions for the FM trading terminal.
- `src/app/api/market/quote/route.ts` — new authed GET. Finnhub primary, Yahoo Finance (`query1.finance.yahoo.com`) fallback. Both providers down → returns `{ price: null }` (200, not 502) so the FM can still add positions with manual pricing.
- `src/app/api/market/status/route.ts` — new authed GET that returns US market open/closed status.
- `src/components/ui/ticker-search.tsx` — new client component. 300ms debounce, full keyboard nav (arrow up/down/enter/escape), outside-click close, WAI-ARIA combobox pattern (role=combobox / role=listbox / role=option, aria-activedescendant tracks keyboard focus).
- `src/components/ui/add-position-form.tsx` — major rewrite. Vertical flow replaces the legacy 4-column grid: TickerSearch → live quote card (price + daily change + open/closed badge) → buy-mode pills (shares vs. dollars) → thesis note (max 280) → submit. Graceful fallback when quote returns `price: null` swaps the card for an amber-bordered manual-price input.
- `src/lib/notification-fanout.ts` — `FanoutChange` extended: buy gains optional `price?` and `allocation_pct?`; sell gains optional `price?`. `describeOneChange` rewritten to compose richer bodies from those fields plus `input.thesis_note`. Examples: `"bought AAPL · $189.50 · 40% allocation"`, `"bought AAPL · $189.50 — 'AI infra play'"`, `"sold AAPL · $189.50"`. Web push body upgrades automatically because `sendPushToUser` already reads `row.body`. `meta` now carries `price` and `allocation_pct` for client-side use.
- `src/app/api/positions/manual/route.ts` — POST accepts `thesis_note` in body and threads `price` onto the buy change; DELETE accepts `thesis_note` for the sell fanout.
- `src/app/api/positions/assign/route.ts` — DELETE accepts `thesis_note` and threads it into the sell fanout (POST already wired thesis_note from a prior sprint).
- `src/app/(dashboard)/dashboard/positions/positions-client.tsx` — trash icon no longer fires DELETE immediately. Click opens an inline amber-bordered confirmation row with a "why are you selling?" thesis input plus cancel/remove buttons; confirmed remove POSTs the thesis to the assign DELETE endpoint.
- `src/app/feed/feed-sections.tsx` — major rewrite. Replaces the per-position `PositionCard` grid (max 6, missing data showed as `"—"`) with a collapsible portfolio card per subscription. Body is a dense `TICKER | SHARES | PRICE | ALLOC | G/L` table with no row cap. Header click toggles expand/collapse via AnimatePresence height tween; UndoplButton + FM-avatar link work via `stopPropagation`. PositionCard file remains for the public `/[handle]` profile page.
- `src/lib/__tests__/notification-fanout.test.ts` — 4 new test cases covering enriched body formats (buy + price + allocation, buy + price + thesis, sell + price, backward-compat fallback).

**Why:** User testing after Sprint 9 surfaced six pain points. The FM position-management surface was bare-bones (plain text input, no market data, no context); the dopler feed showed each position as a separate large card with `"—"` allocation/price; push notifications were minimal (`"bought AMPX"`); and `thesis_note` already existed in the DB but was never surfaced in the UI. This sprint addresses the four highest-impact items. The two deferred items — dopler investment-amount calculator and dopler-personal-data in feed — have regulatory implications (personalized advice vs. transparency) that legal needs to clear before scoping into Sprint 11.

**Impact:**
- FMs typing into "add position" now see live ticker autocomplete with company names; on selection, the price + daily change + market-open badge render immediately.
- FMs can choose to enter shares or a dollar amount and the form computes the counterpart live (`42 sh × $12.45 = $523.90` or `$500 / $12.45 ≈ 40.2 sh`).
- Optional thesis note (max 280 chars) is saved on `portfolio_updates` AND included in the dopler-facing notification body, so lock-screen pushes carry the FM's reason for the trade.
- Doplers' feed becomes a glanceable portfolio overview: every position's ticker, shares, price, allocation %, and gain/loss % is visible without expanding anything; collapsing a portfolio still shows the FM strip + tier + undopl.
- Removing a position requires a one-click confirmation step with a thesis input, preventing accidental DELETEs and giving doplers context on the sell.
- Notification bodies upgrade automatically across web push (lock screen), in-app notifications (bell + alerts page), and the popup — they all read `notification.body`.

**Testing:**
- `npm test` — 149/149 passing across 27 files (was 145/145 before; 4 new fanout cases).
- `npm run build` — clean. New routes in build output: `/api/market/search`, `/api/market/quote`, `/api/market/status`.
- Manual smoke (Surfer, post-merge): see Sprint 10 plan's Manual Smoke section. Includes FM trading terminal flow (search/select/quote/submit), feed redesign expand/collapse, removal confirmation, and notification body delivery (push + in-app).

**Risks:**
- `FINNHUB_API_KEY` must be set in `.env.local` AND Vercel (Production + Preview). Without it, autocomplete returns `[]` and quotes 500-then-fall-through to Yahoo. The /api/market/quote graceful-degradation path keeps the form usable even with no key, but the live-quote UX disappears.
- Finnhub free tier is 60 calls/min globally (not per-user). Multiple FMs typing simultaneously could exhaust the limit; the 5-min search cache + 30s quote cache mitigate this for typical usage. Flag as a future scaling concern.
- Yahoo Finance's chart endpoint is unofficial and intermittently rate-limits with 429s. The dual-fallback is best-effort; the null-price branch is the actual safety net.
- `PositionCard` is no longer used by the feed but remains imported by `/[handle]`. Removing the file would break that route — flagged in the plan and intentionally kept.

---

## [2026-04-28] — Sprint 9: Web Push + Apple Sports Design

**Files changed:**
- `supabase/migrations/20260427_push_subscriptions.sql` — new `push_subscriptions` table with RLS (users can only manage their own subscriptions).
- `.env.example` — added `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` placeholders.
- `package.json`, `package-lock.json` — added `web-push` runtime dependency and `@types/web-push` dev dependency.
- `src/app/api/push/subscribe/route.ts` — new POST route that upserts a push subscription for the authenticated user.
- `src/app/api/push/unsubscribe/route.ts` — new POST route that removes a push subscription by endpoint.
- `src/lib/push.ts` — new shared push module. `sendPushToUser()` reads `push_subscriptions`, signs payloads with VAPID, fans out to every device, and prunes 410/404 subscriptions.
- `src/app/api/push/send/route.ts` — thin API wrapper around `sendPushToUser()` for manual/debug use. Authentication uses `crypto.timingSafeEqual` against the service role key.
- `public/sw.js` — added `push` and `notificationclick` event handlers. Tap-to-navigate uses `client.postMessage({ type: "PUSH_NAV", url })` instead of `client.navigate()` (iOS Safari compat). Cache version bumped to `dopl-shell-v22`.
- `src/components/pwa/push-prompt.tsx` — new dismissable in-app prompt that appears 3s after load if `Notification.permission === "default"`. Subscribes via `pushManager.subscribe` and POSTs to `/api/push/subscribe`. Persists dismissal in `localStorage`.
- `src/components/dopler-shell.tsx` — renders `<PushPrompt />`, listens for `PUSH_NAV` messages from the SW, and syncs `unreadCount` to the PWA app icon via `navigator.setAppBadge`/`clearAppBadge` (locally type-asserted).
- `src/lib/notification-fanout.ts` — after `notifications.insert()`, fans out web push to every unique notified subscriber via `Promise.allSettled(sendPushToUser(...))`. Best-effort: push failures don't block the sync.
- `src/lib/time-ago.ts` — new shared utility. Single terse format (`5s`, `5m`, `2h`, `3d`).
- `src/components/ui/notification-popup.tsx` — removed local `timeAgo`, imports shared. Ticker card redesigned: 3xl bold mono ticker, lime for buy / amber for sell, transparent sage background, smaller time-ago.
- `src/app/notifications/notifications-client.tsx` — removed local `timeAgo`, imports shared. Notification cards redesigned: 2xl bold mono ticker, lime/amber color accents, lighter card backgrounds, tighter spacing, glanceable hierarchy.
- `src/components/ui/notification-bell.tsx` — bell-dropdown rows redesigned: bold lg mono ticker leads, lime/amber accents, time-ago shrunk, body line-clamped to one line.

**Why:** Sprint 9 closes the loop on real push notifications (the in-app toast was always meant as a stopgap) and addresses the in-app notification UI feeling generic. Apple Sports' approach — bold ticker, terse time, color-coded direction, minimal chrome — maps cleanly onto position-change notifications. iOS 16.4+ enables web push for installed PWAs, so this finally works on iPhone.

**Impact:**
- Doplers see a one-time prompt to enable push 3s after load. Granted permissions persist; dismissals are stored in localStorage.
- Position changes fan out to every push subscription a notified subscriber owns; expired endpoints (410/404) are pruned automatically.
- Tapping a push notification opens dopl to `/feed/<portfolio_id>` (iOS Safari uses postMessage; other browsers use `clients.openWindow`).
- PWA app icon shows a numeric badge equal to unread count on Chromium and iOS Safari.
- Notification bell, popup, and `/notifications` page all share a consistent terse time format and Apple Sports-style ticker hierarchy. Sells render in amber, buys/adds in lime.
- Service worker cache invalidates to v22 — clients reload after activation to pick up the new push handlers.

**Testing:**
- `npm test` — 145/145 passing across 27 files.
- `npm run build` — clean. New routes appear in build output: `/api/push/subscribe`, `/api/push/unsubscribe`, `/api/push/send`.
- Manual smoke (Surfer, post-merge): see Sprint 9 plan's Manual Smoke Checks section. Includes iPhone PWA push delivery, Android Chrome, desktop, and edge cases (dismiss/deny/permission flows).

**Risks:**
- VAPID keys are environment-dependent. Surfer must generate them locally (`npx web-push generate-vapid-keys`), set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` in `.env.local`, and add both to Vercel before push will work in production.
- The migration `20260427_push_subscriptions.sql` must be run in the Supabase SQL editor before subscribe routes will succeed.
- iOS only delivers web push to PWAs that have been explicitly added to the home screen. Users who only visit in Safari proper will not receive push.
- `sendPushToUser` runs sequentially per device inside the function but `Promise.allSettled` fans out per user. For >500 subscribers per portfolio, the outer parallelism may strain Vercel's function timeout — flagged as a future scaling concern in the plan's Round 2 review.

---

## [2026-04-27] — Sprint 8: Regulatory + Polish + Performance

**Files changed:**
- Delete: `src/app/api/trading/snaptrade/{register,connect,callback}/route.ts`, `src/app/api/trading/saltedge/{register,connect,callback}/route.ts`, `src/app/api/trading/disconnect/route.ts` — 7 dopler-side broker/bank OAuth API routes removed for regulatory compliance.
- Delete: `src/components/connect/trading-connect.tsx` — TradingConnect component that powered the OAuth connect UI.
- Delete: `src/lib/proxy-gates.ts`, `src/lib/__tests__/proxy-gates.test.ts` — `doplerNeedsOnboarding` gate that redirected doplers to `/welcome` when `trading_connected` was false, creating an infinite redirect loop after OAuth removal.
- `src/proxy.ts` — removed `doplerNeedsOnboarding` import, `trading_connected` query, and redirect block. Feed access is now ungated for all authenticated subscribers.
- `src/app/welcome/welcome-client.tsx` — simplified from 3-step (welcome → region → connect) to 2-step (welcome → region → redirect to feed). Removed TradingConnect import and step.
- `src/app/welcome/page.tsx` — removed trading queries, `trading_connected` redirect, and `initial` prop. Query simplified to `role, full_name`.
- `supabase/migrations/20260427_add_broker_preference.sql` — adds `trading_broker_preference TEXT` to profiles.
- `src/app/api/broker-preference/route.ts` — new GET/POST endpoint for dopler broker preference (simple text column, no OAuth).
- `src/components/broker-preference-picker.tsx` — new dropdown component for selecting preferred broker. Saves on change via `/api/broker-preference`.
- `src/app/settings/page.tsx` — replaced TradingConnect with BrokerPreferencePicker. Simplified profile query. Removed `connected`/`error` search param banners. Parallelized profile + subscription count queries.
- `src/components/dopler-shell.tsx` — replaced `trading_connected`/`trading_connection_data` fetch with `trading_broker_preference`. Passes `brokerPreference` to NotificationBell. Added `prefetch` to nav links.
- `src/components/ui/notification-bell.tsx` — replaced `tradingConnected`/`tradingName`/`tradingWebsite` props with single `brokerPreference` prop.
- `src/lib/broker-deeplinks.ts` — added `BROKER_HOMEPAGES` map (8 brokers) and `getBrokerHomepage()` export for deep-link fallback.
- `src/components/ui/notification-popup.tsx` — replaced trading connect props with `brokerPreference`. Fixed overflow (max-h-[85vh] overflow-y-auto), opaque background (bg-[dopl-deep-2] replaces glass-card), and CTA logic (broker preference deep-links, "Other" hides broker CTA, null shows "set your broker in settings").
- `src/components/__tests__/notification-popup.test.tsx` — updated all 6 tests for broker preference props. Added 2 new tests: "Other" hides broker CTA, Coinbase falls back to homepage.
- `src/app/notifications/page.tsx` — replaced trading profile query with `trading_broker_preference`.
- `src/app/notifications/notifications-client.tsx` — replaced trading props with `brokerPreference`. Fixed missing `ticker`/`change_type` passthrough to popup. Inline CTAs use broker preference deep-links. Ticker extraction prefers typed field.
- `src/app/marketing-landing.tsx` — role-aware hero + bottom CTAs: dopler → "your feed", FM → "your dashboard", logged-out → "launch your fund".
- `src/app/layout.tsx` — added `padding-top: env(safe-area-inset-top)` to body for Dynamic Island.
- `src/app/(dashboard)/dashboard/page.tsx` — parallelized fund_managers + portfolios queries. Uses `getCachedUser()`.
- `src/app/feed/page.tsx` — parallelized fund_managers + profiles + positions queries via Promise.all().
- `src/app/(dashboard)/dashboard/positions/page.tsx` — parallelized portfolios + fund_managers queries.
- `src/app/feed/[portfolioId]/page.tsx` — parallelized subscription + positions + updates queries.
- `src/app/(dashboard)/layout.tsx` — uses `getCachedUser()` for deduplication with child pages.
- `src/app/(dashboard)/dashboard-chrome.tsx` — added `prefetch` to nav links.
- `src/lib/supabase-server.ts` — added `getCachedUser()` wrapped in `React.cache` for per-request auth deduplication.
- `public/manifest.json` — added `"id": "/"` field for iOS 16.4+ push notification support.

**Why:** Regulatory compliance required removing all dopler-side broker/bank OAuth. The broker preference picker replaces OAuth with a simple dropdown. Three notification popup bugs (overflow, opaque background, missing data) were fixed alongside the prop refactor. Homepage CTAs were generic for logged-in users. Dynamic Island overlap was unaddressed. Sequential Supabase queries on 5 pages created unnecessary waterfall latency.

**Impact:**
- New doplers can reach /feed without any broker OAuth — no infinite redirect loop.
- Welcome onboarding is 2 steps (welcome → region → feed), not 3.
- Broker preference picker replaces OAuth in settings — dropdown saves broker name, deep-link CTAs use it.
- 6 broker options that previously produced dead `#` links now fall back to homepage URLs.
- "Other" broker preference hides the broker CTA entirely — only "copy ticker" shows.
- Role-aware homepage CTAs: doplers see "your feed", FMs see "your dashboard".
- Dynamic Island no longer overlaps content on iPhone PWA.
- 5 pages load faster via parallelized Supabase queries + React.cache auth dedup.
- Nav link prefetch enables eager loading for faster page transitions.

**Testing:** `npm test` = **145 passing across 27 files**. `npm run build` clean. All grep checks for deleted code pass (zero references to TradingConnect, /api/trading/, trading_connected, trading_connection_data, proxy-gates, doplerNeedsOnboarding).

**Risks:**
- `trading_broker_preference` column must exist before deploy — migration already applied.
- Existing doplers with `trading_connected = true` won't see their old OAuth broker in the new dropdown — they need to re-select via the picker. Acceptable for regulatory compliance.

---

## [2026-04-23] — Sprint 7: dopler deep-link CTAs

**Files changed:**
- `src/components/ui/notification-bell.tsx` — the bell's click handler now forwards `meta`, `ticker`, and `change_type` from the notification row when it builds `PopupNotification`. The popup's `extractPortfolioId(meta)`, stale-actionable guard, and manual-sent badge were all designed to consume this data in Sprint 5 but never received it — the handler was only passing `{id, title, body, created_at, actionable}`.
- `src/components/ui/notification-popup.tsx` — primary CTA is now a ticker-scoped broker deep-link ("dopl AAPL on Robinhood" / "dopl AAPL on Schwab" / etc.) that opens the broker's actual stock page via `buildBrokerTradeUrl`. Falls back to "open {broker}" with the homepage URL when either the broker isn't in the pattern list or the notification has no ticker. Unauthenticated doplers see "connect your broker to dopl instantly" → `/settings`. Adds a "view portfolio" secondary link to `/feed/[portfolio_id]` below the primary whenever `meta.portfolio_id` resolves. Ticker-card label pulls from the typed `notification.change_type` column — "sold" when `change_type === "sell"`, "ticker" otherwise. `PopupNotification` type gains optional `ticker` + `change_type` fields; ticker extraction prefers the typed column and falls back to the existing body-regex for legacy rows.
- `src/components/__tests__/notification-popup.test.tsx` — existing three stale-actionable cases updated to assert the Sprint 7 copy ("dopl AAPL on Fidelity") instead of the pre-Sprint-7 "open Fidelity". +3 new Sprint 7 cases covering typed-ticker preference with the Robinhood URL pattern, the "sold" action badge from `change_type`, and the no-broker-connected empty-state copy.
- `src/lib/broker-deeplinks.ts` — new `buildBrokerTradeUrl(brokerName, websiteUrl, ticker)` helper. 5 verified deep-link patterns (Robinhood, Alpaca, Schwab, Fidelity, Tradier) + case-insensitive matching + homepage fallback for unknown brokers and null-ticker rows. Instance 2 audit verified the previous candidate patterns against live broker sites — Webull requires an exchange prefix we don't have from SnapTrade, Interactive Brokers has no public per-ticker URL, TD Ameritrade's domain is DNS-dead (merged into Schwab in 2023), and E\*TRADE has no public per-ticker URL; all four fall through to the homepage URL instead, which is strictly safer UX than a 404.
- `src/lib/__tests__/broker-deeplinks.test.ts` — new file, 15 cases. Verified-pattern asserts (1 per broker + 1 case-insensitivity spot check), fall-through asserts for the 4 brokers we deliberately omit (so the homepage fallback is regression-pinned), and edge cases (null ticker, null broker + null website, null broker + website only).

**Why:** The notification → action loop was broken end-to-end for doplers. A "bought AAPL" notification would open, show a "trade this · open Robinhood" CTA, link to robinhood.com's homepage, and force the dopler to manually search for AAPL — multiple seconds of friction between intent and action. Separately, the bell's click handler had been silently dropping `meta`/`ticker`/`change_type` since Sprint 5 shipped, which meant the stale-actionable guard never fired, the manual-sent badge never showed, and the ticker card fell back to body-regex extraction that drifts every time the FM's notification copy changes. Sprint 7 fixes the data flow and upgrades the CTA in one coherent pass.

**Impact:**
- Clicking a position-change notification now opens a popup with the ticker scoped broker deep-link as the primary CTA ("dopl AAPL on Robinhood"). Tapping it opens robinhood.com/stocks/AAPL (or the verified equivalent for Schwab / Fidelity / Alpaca / Tradier).
- Unknown brokers keep working via the existing homepage fallback — conservative on purpose, since a wrong deep link (wrong exchange prefix, dead domain) is worse UX than a homepage link.
- The stale-actionable guard now activates as designed: doplers opening a notification for a portfolio they've since cancelled see "view portfolio" instead of a broker deep-link, eliminating broken action paths.
- The "view portfolio" secondary link is now reachable on every active-sub notification, giving doplers a one-tap path from the popup to the full portfolio context without dismissing the notification.
- The "manually sent by the fund manager" badge fires correctly for manual updates.
- The ticker card now labels a sell event as "sold" instead of "ticker", giving quick visual context before the dopler reads the body.

**Testing:** `npm test` = **148 passing across 28 files** (Sprint 6 baseline 130 + 15 broker-deeplinks cases + 3 new popup cases = 148). `npm run build` clean with all three critical env vars unset. Playwright suite unchanged at 5 chromium tests.

**Risks:**
- **Broker name drift.** SnapTrade returns broker names as free-form strings; a rebrand or punctuation change ("Charles Schwab" vs "Schwab") could silently drop a pattern match. The regex matchers are intentionally loose (`/schwab/i`), but a partner-name change still risks falling back to the homepage. Acceptable — the fallback is safe — and we can expand the pattern regex when we see drift in analytics.
- **Auth-gated broker URLs (Alpaca, Tradier)** route an unauthed dopler through a login page before landing on the ticker. Minor friction on first tap; subsequent taps are seamless once the broker session is live.
- **No write-side integration.** The CTA deep-links to the broker's UI — the dopler still places the order themselves. Full mirror-trade is regulatory-gated and out of scope.
- **Body-regex fallback kept for legacy rows.** Any notification with `ticker=NULL` pre-Sprint-5 still runs through `extractTicker(body)`. Safe today but worth deleting once the column backfill is confirmed. Flagged for Sprint 9+ cleanup.

---

## [2026-04-22] — Hotfix: notification bell visible on all viewports

**Files changed:**
- `src/app/(dashboard)/dashboard-chrome.tsx` — removed `hidden md:block` from FM bell wrapper so it renders on mobile + desktop
- `src/components/dopler-shell.tsx` — same fix for dopler bell

**Why:** Both bells were wrapped in `hidden md:block`, making them `display:none` on viewports under 768px. After Sprint 6 removed the 5th bottom-nav tab, FMs had zero notification access on mobile. Users testing on phones or narrow windows saw no bell at all.
**Impact:** Bell icon now appears in the header bar on all screen sizes. Mobile FMs can tap the bell to see activity and open the dropdown.
**Testing:** 130 tests pass, build clean.
**Risks:** None — the bell already rendered correctly, it was just hidden by CSS.

---

## [2026-04-22] — Sprint 6: position flow + Sprint 5 UI fixes + SnapTrade sandbox

**Files changed:**
- `src/app/(dashboard)/dashboard-chrome.tsx` — reverted the Sprint 5 5th "activity" bottom-nav slot. The layout (4 labeled tabs + a non-route button-slot) cramped the labels and left the bell floating alone on the right; back to the original 4 tabs (home / portfolios / share / settings). The FM bell stays mounted in the desktop top-right header; mobile FMs reach `/fund-manager/activity` via the sidebar or in-content links.
- `src/components/ui/fm-notification-bell.tsx` + `src/components/ui/notification-bell.tsx` — moved the initial `getBoundingClientRect()` computation out of `useEffect` and into the click handler, so `pos`/`anchor` is set synchronously in the same state batch as `open`. The old pattern left `pos=null` on the first render after click, which made the `AnimatePresence` gate `{open && pos && …}` miss the initial mount and the dropdown never animated in. Applied to BOTH bells unconditionally per Instance 2 audit — the dopler bell had the identical latent race (`notification-bell.tsx:43-61` used the same effect-only pattern), just happened to land first in most renders. `useEffect` is kept for resize/scroll updates only.
- `src/app/api/positions/manual/route.ts` — POST now accepts an optional `portfolio_id`. When present, the route verifies ownership against `portfolios.fund_manager_id` (defense-in-depth alongside RLS), writes the position to that portfolio, and calls `fanOutPortfolioUpdate` with a buy event so every active dopler receives a notification. When absent, the existing Manual Holdings behavior is preserved (the onboarding manual-entry flow writes through this path and expects the `broker_connected=true` side-effect). Upsert-existing-ticker skips fanout — doplers already know about tickers already in the portfolio. DELETE no longer hardcodes Manual Holdings: it joins through the `positions` row to resolve both the actual `portfolio_id` and the ownership check in one query, then fires a sell fanout if the source portfolio is subscribable. Positions in Manual Holdings skip fanout (the portfolio has no subscribers).
- `src/app/api/positions/manual/__tests__/route.test.ts` — 3 new Sprint 6 cases on top of the existing 5 (POST with `portfolio_id` fires buy fanout, POST on upsert-existing skips fanout, POST with another user's `portfolio_id` 403s, DELETE from named portfolio fires sell fanout, DELETE of someone else's position 403s).
- `src/components/ui/add-position-form.tsx` — new inline "add position" primitive. Sprint 4 `<SubmitButton>` + `<InlineError>`; auto-price-fetch via `/api/positions/price` on submit mirroring `src/components/connect/manual-entry.tsx`. On success calls `router.refresh()` so the portfolio card re-renders with the new row.
- `src/app/(dashboard)/dashboard/portfolios/expandable-portfolio-card.tsx` — footer gains a toggleable "add position" button that mounts `<AddPositionForm>` inline above the action row; the empty-state block also surfaces the same button next to "assign from broker". The old "edit positions" link is renamed to "manage positions" (still routes to `/dashboard/positions` for broker-sync + bulk allocation). Other footer actions (send manual update, delete portfolio) are unchanged.
- `src/app/(dashboard)/dashboard/positions/positions-client.tsx` — `runSync` takes a `userInitiated` flag (default `false`). The mount-time auto-sync passes `false`, suppressing the `NotifyDoplersModal` that previously fired as a phantom "portfolio updated" popup when navigating to `/dashboard/positions` immediately after a manual position edit elsewhere. The resync button passes `true`. Changeset data is still stored in both paths so clicking resync after an auto-sync still works without a second network round-trip.
- `src/lib/snaptrade.ts` — added an exported pure `resolveSnaptradeCredentials(env)` resolver. Sandbox mode activates iff `SNAPTRADE_SANDBOX=true` AND both `SNAPTRADE_SANDBOX_CLIENT_ID` + `SNAPTRADE_SANDBOX_CONSUMER_KEY` are set. Missing either piece falls back to production credentials rather than constructing a half-configured client. Optional `SNAPTRADE_BASE_URL` overrides the API endpoint — unused today (prod + sandbox share the endpoint) but available if SnapTrade ships a distinct sandbox URL later. Exports `snaptradeMode` for consumers that want to surface the resolved mode (e.g. dev banner).
- `src/lib/__tests__/snaptrade.test.ts` — 5 new resolver cases (prod default, sandbox with both creds, toggle-on with missing creds falls back to prod, basePath passthrough, basePath unset stays undefined) on top of the existing 2 module-import sanity checks.
- `.env.example` — three new commented entries documenting the sandbox credentials + the base-url escape hatch.

**Why:** Sprint 5 shipped the notification loop data layer clean (fanOutFmEvent, webhook idempotency, /me dashboard, FM activity page) but left three issues on the deploy: the FM bell dropdown didn't open on prod, the 5th "activity" bottom-nav tab broke the mobile layout, and a phantom "portfolio updated" popup fired whenever the FM navigated to `/dashboard/positions`. Separately, the manual-position flow still wrote to a system "Manual Holdings" portfolio that doplers can't subscribe to — FMs in regions without SnapTrade coverage (UAE, India) had no way to populate their subscriber-visible portfolios, breaking the product value proposition for that cohort. And every end-to-end test of the broker sync chain still required real broker credentials, making it impossible to verify the chain cleanly pre-deploy.

**Impact:**
- FM bell dropdown opens reliably on click across both bells, with no nav-layout shift.
- Mobile bottom-nav returns to the clean 4-tab rhythm; activity is reachable via the desktop bell or in-content links.
- FMs can add positions to any subscribable portfolio they own via the inline form on the portfolio card, and every active dopler gets a buy notification via the existing Sprint 2 fanout path. Deleting a position fires a sell notification the same way. Manual Holdings stays as the onboarding-flow staging area; new positions there skip fanout (no subscribers to notify).
- Navigating to `/dashboard/positions` no longer shows a misleading "portfolio updated" modal unless the FM explicitly clicks resync AND there are real broker-side changes to notify on.
- SnapTrade can now be pointed at sandbox credentials with a single env toggle, enabling end-to-end broker-chain tests without real accounts. Dev-only today (prod stays on live credentials); the resolver keeps the prod fallback loud by requiring BOTH sandbox creds to be present.

**Testing:** `npm test` = **130 passing across 27 files** (Sprint 5 baseline 120 + 5 manual-route Sprint 6 cases + 5 snaptrade resolver cases = 130). `npm run build` clean with all three critical env vars unset. Playwright suite unchanged at 5 chromium tests.

**Risks:**
- **Fanout volume on bulk manual adds.** An FM adding 20 positions in quick succession via the inline form fires 20 individual buy notifications (one per insert). Acceptable at current scale; post-launch optimization is a batched "portfolio updated: +N positions" summary, not in scope here.
- **Manual Holdings backward-compat surface is narrow.** `/dashboard/connect` + the onboarding manual-entry flow still route through the no-`portfolio_id` POST path. If the onboarding flow ever restructures to seed a subscribable portfolio directly, the broker_connected side-effect on that path will need to move.
- **DELETE now requires the join to succeed.** Positions with a dangling `portfolio_id` (shouldn't exist — FK constraint — but defensively) would 403 instead of silently matching 0 rows. The old behavior hid the bug; the new behavior surfaces it. Acceptable trade-off.
- **Sandbox credentials routing is trust-based.** The resolver falls back to prod keys if either sandbox credential is missing, which protects against silent half-config but means a misconfigured dev env could accidentally hit prod. Mitigated by requiring the explicit `SNAPTRADE_SANDBOX=true` toggle — an accidental prod call needs both the toggle AND the missing credential, which is a noisy failure mode.
- **`SNAPTRADE_BASE_URL` escape hatch is untested against a real sandbox URL.** If SnapTrade ever ships one, the resolver will pass it through, but a distinct sandbox endpoint could have slightly different authentication semantics (timestamp signing, etc.) that require SDK-side handling.

---

## [2026-04-22] — Sprint 5: FM activity feed + dopler /me dashboard (Phase 2)

**Files changed:**
- `supabase/migrations/004_fm_activity_types.sql` — new migration, transaction-wrapped. Extends `notifications.change_type` check constraint to include `subscription_added` + `subscription_cancelled`, and adds a UNIQUE constraint on `subscriptions.stripe_subscription_id` so concurrent Stripe webhook retries cannot double-insert. Free-tier subs leave the column NULL and Postgres UNIQUE allows multiple NULLs, so free subs are unaffected. Applied to prod via Supabase SQL editor after pre-flight checks (change_type distinct values: only `summary`/NULL/`sell`/`buy`; stripe_subscription_id duplicates: zero). File committed for source control only.
- `src/types/database.ts` — widens `Notification.change_type` union with the two new FM values.
- `src/lib/notification-fanout.ts` — new `fanOutFmEvent(admin, input)` helper. Writes a single FM-side notification with a `meta.dedup_key = "<event>:<subscription_id>"` and short-circuits on duplicate via `.contains('meta', {dedup_key})`. Also threads `portfolio_id` into every row emitted by the existing `fanOutPortfolioUpdate` (used by the dopler popup's new stale-actionable guard).
- `src/lib/__tests__/notification-fanout.test.ts` — `makeFakeSupabase` helper extended with `.contains()` + `.limit()` support and an `existingFmNotifications` seed. +3 test cases (single insert, dedup idempotency, cancelled past-tense).
- `src/app/api/subscriptions/free/route.ts` — removes the inline notification insert; captures the subscription row id (reactivate: existing.id; insert: inserted.id) and calls `fanOutFmEvent` with `tier='free'`, `price_cents=null`.
- `src/app/api/stripe/webhook/route.ts` — `checkout.session.completed` now has a primary idempotency guard (existence check on `stripe_subscription_id` before insert, backed by the new UNIQUE constraint; UNIQUE-violation caught as idempotent success) + calls `fanOutFmEvent` with tier + price_cents from the portfolio. `customer.subscription.deleted` pre-fetches the row so an already-cancelled status short-circuits; status flip + both subscriber_count decrements gate the fanout (if any errors, returns 5xx so Stripe retries). Removes the stale "cancel Stripe sub" step — Stripe initiated the event upstream.
- `src/app/api/stripe/webhook/__tests__/idempotency.test.ts` — new integration test. In-memory supabase fake + `stripe.webhooks.constructEvent` mock. 2 cases: duplicate `checkout.session.completed` → 1 subscription row + 1 notification + 1 RPC call; duplicate `customer.subscription.deleted` → 1 notification, `stripe.subscriptions.cancel` never called.
- `src/app/api/subscriptions/route.ts` — DELETE pre-fetches portfolio + FM + dopler; DB writes (status flip + both counter decrements) gate the fanout; Stripe cancel is best-effort (try/catch, logged) and does NOT gate fanout.
- `src/hooks/use-fm-notifications.ts` + `src/components/fm-notifications-context.tsx` + `src/components/ui/fm-notification-bell.tsx` — new FM-side notification surface. Hook mirrors `use-notifications` with an `in('change_type', [...])` narrow; provider owns a single hook instance and hands it to consumers via context (single-owner pattern, no double-subscribe race). Bell mirrors the post-Sprint-3-R3 dopler bell's portal pattern exactly (createPortal to document.body, getBoundingClientRect anchoring, click-outside guards button + dropdown refs) so opening it can't distort the host nav. Anchor state is a discriminated union (`{kind:'top'}|{kind:'bottom'}`); consumers pass `anchor="bottom"` in the mobile bottom-nav so the dropdown opens upward. `max-h-[70vh]` keeps content inside landscape viewports.
- `src/app/(dashboard)/fund-manager/activity/{page,activity-client}.tsx` + `__tests__/activity-page.test.tsx` — new `/fund-manager/activity` route. Page fetches the 50 most recent FM events server-side; client renders "new" (unread) and "this week" (read, <7d) sections with per-row tier + price lines from `notification.meta`. Defensive change_type filter on the client guards against a non-FM row slipping through. Test file has a `vi.mock('@/hooks/use-fm-notifications', …throw)` regression guard so any direct-hook usage from `ActivityClient` fails the suite with a clear message.
- `src/app/(dashboard)/dashboard-chrome.tsx` — accepts `userId` prop. Wraps children in `FmNotificationsProvider` (fed by `useFmNotifications(userId)` at this level). Desktop mounts the FM bell top-right of the main content area; mobile adds it as a 5th slot in the existing bottom-nav labeled "activity" (button, not a route link — opens the portal dropdown in place).
- `src/app/(dashboard)/layout.tsx` — passes `user.id` to `DashboardChrome`.
- `src/components/ui/notification-popup.tsx` — overlay z-index `z-[60]` → `z-[80]` so the popup sits above any open bell dropdown (z-70). New `activeSubscribedPortfolioIds?: Set<string>` prop: if `notification.meta.portfolio_id` is NOT in the set AND `actionable === true`, downgrades the CTA to a read-only "view portfolio" link instead of the broker-action CTA. Fallback is permissive — rows without portfolio_id (legacy pre-Sprint-5) keep the existing broker CTA.
- `src/components/ui/toast.tsx` — container z-index `z-[80]` → `z-[90]` to sit above the popup. Stack contract documented: page=0, sidebar/nav=30, bell dropdown=70, popup=80, toast=90.
- `src/components/ui/notification-bell.tsx` — dopler bell dropdown `max-h-80` → `max-h-[70vh]` for landscape viewports. Reads `activeSubscribedPortfolioIds` from the notifications context and forwards to `<NotificationPopup>`.
- `src/app/notifications/notifications-client.tsx` — same forward to `<NotificationPopup>`.
- `src/hooks/use-notifications.ts` — `markAllRead()` now updates local state AFTER the PATCH resolves (instead of optimistically before). Prevents a realtime INSERT arriving mid-flight from being clobbered to `read:true` locally and snapping back.
- `src/components/notifications-context.tsx` — context value gains `activeSubscribedPortfolioIds: Set<string>`.
- `src/components/dopler-shell.tsx` — fetches the viewer's active subscription portfolio ids in the existing bootstrap `useEffect` and threads them through the provider. Bottom-nav profile tab and desktop user-icon `<Link>` both reroute `/settings` → `/me` (Option B locked 2026-04-21).
- `src/components/__tests__/notification-popup.test.tsx` — new file, 3 cases: stale-actionable triggers the "view portfolio" CTA; broker-action CTA renders when portfolio_id is in the active-subs set; legacy rows without `meta.portfolio_id` fall through to broker CTA.
- `src/app/notifications/__tests__/notifications-client.test.tsx` — updated stub provider value with the new `activeSubscribedPortfolioIds` field.
- `src/app/me/{page,me-client}.tsx` + `__tests__/me-client.test.tsx` + `src/components/ui/cancel-subscription-button.tsx` — new `/me` dopler dashboard. Server component has an explicit `if (!user) redirect('/login')` gate (the proxy also matches `/me` post-change, two layers of defense). Client renders three sections: active subscriptions (cards with FM handle + portfolio name + tier + price + cancel button), monthly spend total, recent notifications (top 5 via `useNotificationsContext`). Cancel is a 2-click confirm built on `<SubmitButton>`: first click arms the red "confirm cancel" state for 3s; second click returns a Promise so SubmitButton auto-manages the pending spinner. Failures render `<InlineError>` below the row; success fades the row out with framer-motion and recomputes the spend total. 5 tests: render, monthly spend sum, cancel happy path, cancel failure, empty state with `/leaderboard` CTA.
- `src/proxy.ts` — matcher gains `/me`.
- `src/app/settings/page.tsx` — adds a `← back to /me` breadcrumb at the top so the demoted page is visibly a sub-page.

**Why:** Two retention-blocking UX asymmetries after Phase 1 (Sprint 3) and UX polish (Sprint 4): FMs had no notification surface for subscribe/cancel events (Sprint 2 Task 5 removed the FM dashboard bell; `/api/subscriptions/free` was writing notifications that nobody could read), and doplers had no surface for managing their subscriptions (cancel flow existed at the API but had no UI entry point). Sprint 5 ships both. Scope discipline held: no MRR dashboard, no FM activity log expansion beyond subscribe/cancel, no cross-broker own-positions aggregation, no IA rework beyond Option B.

Also surfaced and fixed a pre-existing BLOCKER during the plan audit: the Stripe `checkout.session.completed` handler had zero idempotency guard. Stripe retries non-2xx for 72h, so a transient 500 would have double-inserted subscription rows and — after Task 2's fanout wiring — doubled the FM notification. Migration 004's UNIQUE constraint on `stripe_subscription_id` + the handler's existence-check guard + `fanOutFmEvent`'s `dedup_key` backstop make this airtight across retries and concurrent deliveries.

**Impact:**
- FMs get a real-time bell on dashboard (desktop top-right + mobile 5th bottom-nav slot labeled "activity") + a `/fund-manager/activity` page. Scope strictly to subscribe/cancel events; never pollutes with position-change notifications.
- Doplers land on `/me` from the profile tab: see every active subscription + cancel inline via 2-click confirm + see monthly spend and recent notifications. `/settings` becomes a sub-page for account admin with a back-link.
- Stripe webhook is idempotent end-to-end against concurrent retries.
- Dopler popup no longer renders a broken broker-action CTA for portfolios the dopler has cancelled — it renders a read-only "view portfolio" link instead.
- Z-index stack fix: open bell dropdowns no longer occlude open popups; toasts always stay above both.

**Testing:** `npm test` = **120 passing across 27 files** (R3 baseline 105/23 + 3 fanOutFmEvent + 2 webhook idempotency + 2 activity page + 3 notification-popup + 5 me-client = 120). `npm run build` clean with all three critical env vars unset.

**Risks:**
- **Supabase Realtime `filter` can only use `eq`** — the FM-side hook subscribes to all INSERTs for the user and filters client-side by `change_type`. On a chatty user this adds a small amount of client CPU; today, with subscribe/cancel velocity of tens per day at most, this is invisible. Post-v1 consideration: open two channels (one per event type) or use a dedicated `fm_events` table.
- **Webhook fanout gate drops the "dopler left" notification if a subscriber_count decrement errors mid-flow** — the user's cancel still returns 5xx and they retry; the status='cancelled' early-return then short-circuits on the second delivery, so the fanout never fires. Accepted trade-off for correctness (no phantom notifications for DB-inconsistent state). The underlying bug (partial-state DB writes) is pre-existing and out of Sprint 5 scope.
- **Stale-actionable guard only works on notifications created after this migration** — older `fanOutPortfolioUpdate` rows don't carry `meta.portfolio_id`, so the popup falls back to the broker-action CTA. Accepted — the fix applies to future rows, not a retroactive migration.
- **`/settings` demotion** — existing users may have `/settings` bookmarked. The page still works; the bottom-nav tab just no longer lands there directly. Back-link breadcrumb makes the new hierarchy clear. No redirect added; if user confusion surfaces post-deploy, we can add a `/settings → /me` redirect in a follow-up.
- **`/me` hands the FM-who's-also-a-dopler a "find a fund manager" empty-state CTA** when they have no subscriptions, which is mildly off-tone but acceptable v1. Flagged for copy polish post-launch.
- **FM event title copy is hard-coded** in `fanOutFmEvent` ("new dopler on X", "dopler left X"). If we want dynamic templates (thesis updates, milestone celebrations) post-launch, extract into a config. Out of scope.

---

## [2026-04-21] — Sprint 4 Hotfix R3 (3 smoke bugs)

**Files changed:**
- `src/lib/saltedge.ts` — replaced hardcoded `MIN_FROM_DATE = "2024-03-26"` with a `getMinFromDate()` function that returns `today − 90 days` as a `YYYY-MM-DD` string. Updated the file's doc comment (line 10) to describe the rolling 2-year-window contract instead of a fixed date. Call site in `createConnectUrl` now defaults `consent.from_date` to `getMinFromDate()` when the caller doesn't pass one.
- `src/lib/__tests__/saltedge.test.ts` — new file, 3 unit tests asserting shape + rolling-window contracts.
- `src/app/onboarding/onboarding-client.tsx` — added a `SNAPTRADE_REGIONS` allowlist (`us_canada`, `australia`) and derived an `effectiveBrokerProvider` in the broker step that overrides the server-selected provider when the FM's region has poor SnapTrade coverage. Regions `uae`, `india`, `other`, and unknown now route to Salt Edge regardless of what `broker_provider` the region API stored, with a small "manual entry is always available from your dashboard" hint rendered under the Salt Edge button so FMs know the fallback path.
- `src/app/api/positions/manual/route.ts` — extracted a `revalidatePositionSurfaces` helper that fetches the FM's handle and calls `revalidatePath` for `/dashboard`, `/dashboard/portfolios`, `/feed/[portfolioId]`, and `/[handle]`. Wired it into every POST branch (update-by-id, upsert existing, fresh insert) and DELETE so any mutation clears the stale Next.js full-route cache for every surface that renders positions.
- `src/app/api/positions/manual/__tests__/route.test.ts` — new file, 3 integration tests mocking `next/cache` + supabase to verify the revalidation call shape on POST insert, POST insert without an FM handle, and DELETE.

**Why:** Teammate's 2026-04-21 manual smoke on `dopl-app.vercel.app` caught three prod bugs:
1. Salt Edge consent init rejected every bank-connect attempt with `from_date must be >= 2024-04-01` — the 2024-03-26 constant had aged out of Salt Edge's rolling 2-year acceptance window.
2. FM with `region=UAE` clicked "i trade through brokerage" during onboarding and landed on a SnapTrade catalog full of US/Canada brokers (Webull Canada, etc.) they couldn't use.
3. FM (Jack) added 10 shares of $IQE to Manual Holdings; the row persisted in the DB but the portfolio detail, `/feed/[portfolioId]`, and public `/[handle]` surfaces all rendered "no positions yet" — stale page cache.

SnapTrade SDK probe: inspected `SnapTradeLoginUserRequestBody` (8 fields, no `country` / `region` / `countryCode` / `countries` / `allowedBrokerages`). Widget-level region filtering is impossible on the SDK, so the only fix is a client-side routing gate (Path B in the R3 plan).

**Impact:**
- Every new Salt Edge connect attempt now lands inside the rolling window; no regression for the ~90-day historical window we actually consume for portfolio-change detection.
- UAE / India / Other / unknown-region FMs on onboarding no longer see the SnapTrade card; they get Salt Edge (or the existing manual-entry path for `other`) with a visible manual-entry hint.
- Any manual-position write (add, edit, delete) now invalidates all four rendering surfaces. FMs see their position on the portfolio detail card in the same session, and doplers see it on their feed + the public FM profile on next navigation.

**Testing:** `npm test` = **105 passing across 23 files** (Sprint 4 R2 baseline was 99/21, +3 saltedge window tests + 3 positions/manual revalidation tests). `npm run build` clean with all three critical env vars unset.

**Risks:**
- `getMinFromDate()` returning `today − 90 days` loses the historical window of data Salt Edge could have returned for dates between 2024-03-26 and `today − 90 days`. We don't consume those historical transactions anywhere today, so this is a no-op loss. If future analytics care about deeper history, bump the offset (or expose it as an env var) — still always inside the rolling 2-year window.
- The SnapTrade region gate routes `india` FMs to Salt Edge even though the `/api/fund-manager/region` API still writes `broker_provider='snaptrade'` for india. The server mapping becomes cosmetically out of sync with the UI. Acceptable for a surgical hotfix — the user-visible flow is correct, and Sprint 6 sandbox work can align the server-side mapping.
- `revalidatePositionSurfaces` fires for every POST / DELETE on the manual-positions endpoint — up to 4 `revalidatePath` calls per write. Writes on this route are rare (manual entry is the exception case), so the extra SSR on these routes is bounded; no risk of invalidation-storming the CDN.
- Defense-in-depth server-side region check on `/api/snaptrade/connect` was deliberately deferred out of R3 to keep scope surgical. A client that bypasses the UI (curl, direct POST) can still hit the endpoint from a denylisted region and reach SnapTrade. Flagged for Sprint 6 hardening.

---

## [2026-04-21] — Sprint 4 Hotfix R2 (4 smoke bugs)

**Files changed:**
- `src/app/api/stripe/connect/route.ts` — pass explicit `country` to `stripe.accounts.create` derived from FM's `region` (us_canada→US, uk→GB, europe→NL, uae→AE, australia→AU, india→IN, other→US). Stripe's default-to-platform-country meant every FM got an AE account regardless of selected region. Also: if an existing unverified account has a mismatched country (stale pre-fix testing or mid-onboarding region change), delete it in Stripe and clear the DB row so the next create produces a correct account. Never touches `stripe_onboarded=true` accounts.
- `src/app/onboarding/onboarding-client.tsx` — (a) visibilitychange handler now clears `brokerStarting` + `stripeChecking` on tab return so the launcher button un-dims instead of staying stuck on "redirecting to snaptrade..."; added `brokerLaunched` state + "i'm done — check status" secondary button matching the Stripe pattern. (b) `createPortfolio` is idempotent within the wizard — `portfolioCreated` state (seeded from `initial.hasPortfolio` + `sessionStorage` so it survives router.refresh on OAuth return) short-circuits the POST on back→next re-entries; form inputs disable and the step shows a "`<name>` created" confirmation card.
- `src/app/(dashboard)/dashboard/share/share-client.tsx` — X URL reverted from `x.com/intent/post` (doesn't exist; returns X's error page) to `x.com/intent/tweet` (canonical Web Intent URL verified 2026-04). Also dropped `noopener,noreferrer` from the features string — per WHATWG spec `window.open` returns null with noopener set, which forced the same-tab fallback every time; defense-in-depth sever `popup.opener` after navigation instead.

**Why:** Surfer's 2026-04-21 smoke of Sprint 4 Hotfix R1 caught four remaining issues. Stripe AE default was a platform-config trap (no country arg → Stripe reads platform country = UAE). SnapTrade stuck state + duplicate portfolios were both onboarding-wizard state-management bugs. X share was an R1 regression — I migrated to `/intent/post` on a hunch; that URL doesn't exist.

**Impact:** Onboarding wizard now respects FM region for Stripe, un-sticks itself after OAuth return, and can't spawn duplicate portfolios on back/next navigation. Share-on-X opens the real X composer instead of an error page.

**Testing:** 99/21 tests passing. `npm run build` clean. No new tests added — all four bugs are integration-layer fixes (popup gesture preservation, server-side Stripe config, visibilitychange state reset, form-submit guard) covered by manual smoke.

**Risks:**
- Recreating stale unverified Stripe accounts deletes the old Stripe account (via `stripe.accounts.del`) before creating the new one. Safe because: only runs when `stripe_onboarded=false` (no payouts attached); wrapped in `.catch(() => {})` so a Stripe 4xx doesn't break the onboarding flow. Any already-onboarded account is never touched.
- `europe` → NL default is arbitrary; a Spanish FM hitting Stripe onboarding lands on an NL Connect account. Stripe Express supports switching country via contact-support, but mid-term fix is a country picker on the Stripe step when region === europe. Logged for Phase 2.
- Portfolio `portfolioCreated` short-circuit doesn't PATCH on edits. If an FM changes name/tier/price then clicks back→next, the original portfolio persists unchanged. Acceptable — they can edit from `/dashboard/portfolios`; surfacing that in the wizard is scope creep.

---

## [2026-04-21] — Sprint 4 Hotfix R1 (7 smoke bugs)

**Files changed:**
- `src/app/onboarding/onboarding-client.tsx` — (a) share step + copyLink now read the live `handle` state instead of `initial.handle` (stale server-render snapshot caused the share page to show the signup handle instead of the edited onboarding handle); (b) `step` persists in sessionStorage and hydrates with `max(saved, initialStep)` so a visibilitychange refresh (user returns from OAuth tab) can't yank the wizard backwards; (c) `launchStripe` captures the `{error}` response body and surfaces it via `<InlineError>` instead of silently closing the new tab — fixes "about:blank opens then auto-closes with no feedback."
- `src/components/ui/user-chip.tsx` + `__tests__/` — dropped "@you" fallback. FMs with handle → "@handle"; doplers with displayName → "Alice" (plain, no @); fallback to "me". Rewrote 7 tests for the new label-resolution branches.
- `src/components/ui/finish-setup-checklist.tsx` + `__tests__/` — Option-B redesign: bigger padding (p-8/p-10), display-xl heading, progress summary ("N of M complete" + lime progress bar), per-item icon tile + sublabel, btn-lime CTA per row. Items now keyed (`FinishSetupItemKey`). Reads `dopl_shared` localStorage flag to force the share item done when the FM has copied/downloaded/X-shared. +2 tests (localStorage flag, progress summary).
- `src/app/(dashboard)/dashboard/page.tsx` — 5 checklist items (broker / portfolio / positions / **stripe** / share). Broker item gated on `broker_provider` being snaptrade or saltedge specifically — manual-entry no longer flips it done.
- `src/app/(dashboard)/dashboard/share/share-client.tsx` — all three share actions (copy, download, X) set `localStorage.dopl_shared="1"` so the dashboard checklist item flips immediately. X URL moved from `twitter.com/intent/tweet` to `x.com/intent/post`; same-tab fallback if popup blocked.
- `src/app/api/positions/manual/route.ts` — calls `revalidatePath('/dashboard')` after insert so the checklist's "positions assigned" item flips on next dashboard visit without a hard refresh.
- `src/app/(dashboard)/dashboard/portfolios/portfolios-client.tsx` — "set up stripe to publish" lock is now a button; launches the same gesture-preserving Stripe flow as onboarding. `<InlineError>` surface for errors. Visibilitychange listener refreshes the page when FM returns from Stripe tab, so the lock flips off as soon as webhook confirms.
- `CLAUDE.md` — line 78 merge/push policy rewritten to reflect actual practice (Surfer does not verify locally; hotfix iteration auto-merges). Added "Next 16 gotchas" section documenting useSearchParams+Suspense pattern discovered during Sprint 4 implementation.

**Why:** Surfer's 2026-04-21 smoke of the deployed Sprint 4 caught these. Most impactful: handle-mismatch (share page showed old signup handle), wizard step regression on OAuth return, and Stripe setup silent failure. The checklist design complaint + missing Stripe item rolled in since the data plumbing touched the same file.

**Impact:** Sprint 4's user-visible flows (onboarding wizard, share page, FM dashboard nudge, portfolios Stripe gate) now behave as intended. Checklist has visual weight matching its role as the primary post-onboarding prompt. Stripe launch failures are no longer silent — if the next smoke surfaces a Vercel env-var issue, the error message will tell us.

**Testing:** 99/21 tests passing (Sprint 4 baseline was 95/21; +2 checklist localStorage/progress, +1 user-chip case, −1 deleted stale "@you" test, +2 checklist item-key adjustments). `npm run build` clean.

**Risks:**
- `revalidatePath('/dashboard')` on every manual position insert will re-SSR the dashboard more aggressively. Acceptable — it's a rare write path.
- Checklist item shape breaking-changed (`key` field required). Only consumer is `/dashboard/page.tsx`; no downstream breakage.
- `x.com/intent/post` is the current canonical X intent URL; `twitter.com/intent/tweet` still works as a redirect so we're not blocking anyone.

---

## [2026-04-21] — Sprint 4: UX Polish

**Files changed:**
- `src/components/ui/submit-button.tsx` + `__tests__/` — new primitive. Auto-flips pending when `onClick` returns a Promise (`Promise.resolve(x).finally()` handles both resolve + reject + sync throws). Consumers can also control via `isPending`. 5 tests.
- `src/components/ui/nav-link.tsx` + `__tests__/` — new primitive. Wraps Next 16 `<Link>` + `useLinkStatus` so links visibly dim during in-flight navigation. Split into `<NavLink>` / `<NavLinkInner>` / `<NavLinkView>` so the presentational half is testable without a Link context. 3 tests.
- `src/components/ui/inline-error.tsx` + `__tests__/` — new primitive. Red/amber banner with optional `nextHref` CTA + dismiss. Replaces `alert()` + ad-hoc red divs. 4 tests.
- `src/components/ui/user-chip.tsx` + `__tests__/` — new primitive. Top-right handle chip + dropdown (role-appropriate feed/dashboard + settings + sign out). 5 tests.
- `src/components/ui/finish-setup-checklist.tsx` + `__tests__/` — new primitive. FM dashboard nudge card (broker / first portfolio / positions / share). Auto-hides when every item done. 4 tests.
- `src/app/marketing-landing.tsx` — extracted client component receiving a `viewer` prop. Renders `<UserChip>` for authed, Sign in / Sign up buttons for unauthed.
- `src/app/page.tsx` — server component now fetches `{ role, handle, display_name }` and passes a viewer object to `<MarketingLanding>`. No more authed-redirect. `determineAuthedHomeTarget` helper deleted.
- `src/app/__tests__/home-redirect.test.ts` — replaced 5 helper tests with a 1-line sanity guard against re-introducing the helper.
- `src/app/oauth-return/page.tsx` + `__tests__/` — new page for new-tab OAuth handoff. Tries `window.close()` immediately; shows a "return to dopl" fallback button after 300ms. 5 tests.
- `src/app/onboarding/onboarding-client.tsx` — broker + Stripe launchers rewritten to pre-open `about:blank` synchronously (preserves Safari iOS gesture context), then `newTab.location.href = url` after fetch resolves. Cookie now includes `Secure`. New visibilitychange listener calls `router.refresh()` when the user returns from the OAuth tab after > 500ms away. SubmitButton + InlineError applied; mobile progress bar shows `step N of M — name` instead of overflowing dots. 2 visibilitychange tests.
- `src/app/api/snaptrade/callback/route.ts` + `src/app/api/saltedge/callback/route.ts` + `src/app/api/stripe/connect/route.ts` — onboarding-flow success redirects now land on `/oauth-return?provider=X` instead of `/onboarding?connected=true`. Error paths stay on `/onboarding?error=...` so user isn't stranded on a cold page.
- `src/components/dopler-shell.tsx` + `src/app/(dashboard)/dashboard-chrome.tsx` — logo `href` changed from `/feed` / `/dashboard` to `/`. Top/bottom dopler nav + dashboard sidebar migrated from `<Link>` to `<NavLink>`.
- `src/app/(auth)/signup/page.tsx` + `src/app/(auth)/login/page.tsx` + `src/app/(dashboard)/dashboard/portfolios/portfolios-client.tsx` + `src/components/ui/send-manual-update-modal.tsx` — SubmitButton swapped in for every submit button. Existing inline red divs replaced with `<InlineError>`.
- `src/app/(dashboard)/dashboard/page.tsx` — mounts `<FinishSetupChecklist>` above the stats grid with 4 items (broker / first portfolio / positions / share). Replaces the inline SetupRow block.
- `src/app/settings/sign-out-button.tsx` + `src/app/feed/[portfolioId]/subscribe-button.tsx` + `src/app/(dashboard)/dashboard/profile/profile-client.tsx` + `src/app/(dashboard)/dashboard/billing/billing-client.tsx` — added `disabled:opacity-50` to hand-rolled buttons that had `disabled=` but no dim class.

**Why:** Phase 1 surfaced a consistent "clicking feels sluggish" complaint — root cause was perceived slowness (clicks fire fast but no visual feedback during the 100–500ms gap before state change). This sprint ships 5 primitives (SubmitButton, NavLink, InlineError, UserChip, FinishSetupChecklist) + sitewide application + OAuth new-tab flow + logo-to-home + mobile progress fix + auth error surfacing. Scope was tightly guarded against adding features — no FM activity log, no dopler dashboard, no optimistic UI, no IA rethink.

**Impact:**
- Every button that fires a server request now has immediate spinner/disabled feedback within one render frame of click.
- OAuth (SnapTrade, Salt Edge, Stripe) opens in a new tab; original dopl tab stays live and auto-refreshes on tab return.
- Authed `/` renders marketing with UserChip instead of force-redirecting. Dopl logo routes to `/` across the app.
- Zero executable `alert()` calls remain in `src/app` or `src/components`.
- FM dashboard shows a finish-setup checklist until every core item is done.
- Mobile onboarding progress shows `step N of M — label` instead of overflowing dots.

**Testing:** `npm test` = **95 passing across 21 files** (71 Sprint 3 baseline + 5 SubmitButton + 3 NavLink + 4 InlineError + 5 UserChip + 5 oauth-return + 2 visibility + 4 FinishSetupChecklist − 4 deleted home-redirect helper tests + 1 new home-redirect sanity = 95). `npm run build` clean with all three critical env vars unset.

**Risks:**
- `useLinkStatus` pending state is skipped when destinations are prefetched — this is a slow-network safety net, not a fast-network every-click indicator. Documented.
- Popup blocker on `window.open` — rare in direct click handlers; same-tab fallback kicks in cleanly.
- `window.close()` blocked on user-opened tabs — `/oauth-return` fallback button handles it.
- visibilitychange refresh races submit-in-flight — mitigated by `> 500ms` guard; existing form state survives `router.refresh()`.

---

## [2026-04-21] — Sprint 3 hotfix round 5 (Task 21)

**Files changed:**
- `src/components/ui/toast.tsx` — toast container moved from `top-4 right-4` to `top-20 right-4` so toasts render below the sticky top nav instead of overlapping the bell + settings icons.

**Why:** Surfer image #47 — "you've undopled Manual Holdings" toast rendered directly on top of the bell and profile icons, obscuring the bell's unread pulse and blocking click targets.

**Testing:** `npm test` 71/71, `npm run build` clean.

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
