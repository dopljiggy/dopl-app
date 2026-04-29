**Status:** implemented

# Sprint 10: FM Trading Terminal + Feed Redesign + Thesis Notes + Richer Notifications

## Context

User testing after Sprint 9 revealed 6 pain points. The FM position management is bare-bones (plain text input, no market data, no context). The dopler feed shows each position as a separate large card with missing data (allocation "—", raw prices). Push notifications are minimal ("bought AMPX"). The thesis_note field exists in the DB but is never surfaced in the UI.

This sprint addresses the 4 highest-impact items (user-agreed scope). Dopler investment amount/calculator and dopler personal data in feed are deferred to Sprint 11 — the investment amount feature has regulatory implications (personalized advice vs. transparency) that need legal review first.

## Prerequisites

- Surfer registers for a free Finnhub API key at finnhub.io
- Surfer adds `FINNHUB_API_KEY` to `.env.local` and Vercel (Production + Preview)

## Task 1: Finnhub Shared Module

**Create:** `src/lib/finnhub.ts`

Server-side module wrapping Finnhub REST API with in-memory TTL caching.

Exports:
- `searchTickers(query)` — calls `/search?q=`, returns `{symbol, description, type}[]`, filters to Common Stock. Cache: 5 min.
- `getQuote(ticker)` — calls `/quote?symbol=`, returns `{current, change, changePercent, previousClose, high, low, open}`. Cache: 30s.
- `getMarketStatus()` — calls `/stock/market-status?exchange=US`, returns `{isOpen, exchange}`. Cache: 60s.
- All fetches use `AbortSignal.timeout(5000)` to prevent hangs.

**Modify:** `.env.example` — add `FINNHUB_API_KEY=`

---

## Task 2: Market Data API Routes

Three thin authenticated route handlers. All use `createServerSupabase()` + `getUser()` for auth.

**Create:**
- `src/app/api/market/search/route.ts` — GET `?q=AAP` → `{results: {symbol, description}[]}`
- `src/app/api/market/quote/route.ts` — GET `?ticker=AAPL` → `{ticker, price, change, changePercent, name?, currency?}`. Falls back to Yahoo Finance (`query1.finance.yahoo.com`) if Finnhub fails. If BOTH fail, returns `{ticker, price: null, change: null, changePercent: null, error: "price unavailable"}` (200, not 502) so the FM can still add positions manually without live pricing — the form treats `price: null` as "enter price yourself".
- `src/app/api/market/status/route.ts` — GET → `{isOpen, exchange}`

**Depends on:** Task 1

---

## Task 3: Ticker Autocomplete Component

**Create:** `src/components/ui/ticker-search.tsx`

Reusable client component. Props: `onSelect: (result: {symbol, description}) => void`.

- Debounced input (300ms) calling `/api/market/search?q=`
- Dropdown: bold mono `symbol` + lighter `description`
- Keyboard nav: arrow up/down, enter to select, escape to close
- ARIA combobox pattern: input has `role="combobox"`, `aria-expanded`, `aria-autocomplete="list"`, `aria-activedescendant` pointing to the focused option. Listbox has `role="listbox"`, each option has `role="option"` with unique `id`.
- Loading spinner in input while fetching
- Empty state: "no matches"
- Design: existing glass input style (`bg-[color:var(--dopl-deep)]`, `border-[color:var(--dopl-sage)]/30`)

**Depends on:** Task 2

---

## Task 4: FM Trading Terminal (Rewrite AddPositionForm)

**Modify:** `src/components/ui/add-position-form.tsx` (major rewrite)

**FM flow, step by step:**

1. **Ticker search** — `TickerSearch` component replaces the plain text input. FM types "AMP..." → sees "AMPX — Amplitude, Inc." → clicks to select.

2. **Live quote card** — On selection, fetches `/api/market/quote?ticker=AMPX` + `/api/market/status` in parallel. Displays:
   - Bold mono ticker + company name
   - Current price: `$12.45`
   - Daily change: `+$0.32 (+2.6%)` green/red
   - Market status badge: green "open" or grey "closed"

3. **Buy mode toggle** — Two pill buttons: "shares" (default) / "amount"
   - Shares mode: enter share count → shows computed total (`42 sh × $12.45 = $523.90`)
   - Amount mode: enter dollar amount → shows computed shares (`$500 / $12.45 ≈ 40.2 sh`)

4. **Thesis note** — Text input: "why this trade? (optional)". Max 280 chars.

5. **Submit** — POST `/api/positions/manual` with `{portfolio_id, ticker, shares, current_price, name, thesis_note}`

Layout: vertical flow (search → quote card → buy controls → thesis → submit), replacing the current 4-column grid.

**Depends on:** Task 3

---

## Task 5: Wire thesis_note + Extend FanoutChange Types

**Modify:** `src/lib/notification-fanout.ts` — Extend `FanoutChange` types (additive, backward-compatible):
```
buy:  { type: "buy"; ticker; shares; price?: number; allocation_pct?: number }
sell: { type: "sell"; ticker; prevShares; price?: number }
```
This type change MUST happen in Task 5 (before the route changes below reference it), otherwise TypeScript rejects the excess `price` property on change objects.

**Modify:** `src/app/api/positions/manual/route.ts`
- POST body type: add `thesis_note?: string | null`
- Line ~227: change `thesis_note: null` → `thesis_note: body.thesis_note ?? null`
- POST changes array: add `price: price ?? undefined` to the buy change object
- DELETE body type: add `thesis_note?: string | null`
- Line ~307: change `thesis_note: null` → `thesis_note: (body as any).thesis_note ?? null`

**Modify:** `src/app/api/positions/assign/route.ts`
- DELETE body (line 108): extend from `{ id }` to `{ id, thesis_note? }`
- Line 134: change `thesis_note: null` → `thesis_note: body.thesis_note ?? null`

**Depends on:** None (thesis_note already accepted by fanout). Logically after Task 4 since the form now sends it.

---

## Task 6: Richer Notification Bodies + Push

**Modify:** `src/lib/notification-fanout.ts`

(FanoutChange type extension already done in Task 5.)

Rewrite `describeOneChange(change, thesisNote?)`:
- Buy + price + allocation: `"bought AAPL · $189.50 · 40% allocation"`
- Buy + thesis: `"bought AAPL · $189.50 — 'AI infrastructure play'"`
- Sell + price: `"sold AAPL · $189.50"`
- Fallback (no price): `"bought AAPL"` (backward compat)

Thread `input.thesis_note` into `describeOneChange()` calls in the notification row loop (lines 124-178).

Push enrichment is automatic — `sendPushToUser` uses `row?.body` which is this enriched string. Lock screen will show: `"Main Portfolio / bought AAPL · $189.50 · 40% allocation"`.

**Modify:** `src/lib/__tests__/notification-fanout.test.ts` — add 3-4 test cases for enriched bodies.

**Depends on:** Task 5

---

## Task 7: Thesis Note in Position Removal Flow

**Modify:** `src/app/(dashboard)/dashboard/positions/positions-client.tsx`

Replace the immediate `remove(id)` trash-icon click with a confirmation step:
- New state: `pendingRemove: {id, ticker} | null`, `removeThesis: string`
- Click trash → sets `pendingRemove` → inline confirmation row appears below the position
- Confirmation row: "remove {ticker}?" + thesis input + cancel/confirm buttons
- On confirm: DELETE to `/api/positions/assign` with `{id, thesis_note}`

~30 lines added.

**Depends on:** Task 5

---

## Task 8: Feed Redesign — Dense Table Rows

**Modify:** `src/app/feed/feed-sections.tsx` (major rewrite)

Replace `PositionCard` grid with collapsible portfolio cards:

**Portfolio card structure:**
- Header (clickable to toggle): FM avatar + name/handle | portfolio name + sync badge | tier badge + undopl button | chevron
- Expanded body: dense position table

**Table columns:** `TICKER | SHARES | PRICE | ALLOC | G/L`
- Ticker: mono bold, left-aligned
- Shares: `XX sh`, mono
- Price: `$XX.XX`, mono tabular-nums
- Allocation: `XX.X%`, mono
- Gain/loss: `+XX.X%` green or `-XX.X%` red

**Behavior:**
- All portfolios start expanded (dopler typically has 1-3)
- Click header to collapse/expand with `AnimatePresence` + `motion.div` (same pattern as expandable-portfolio-card.tsx)
- No max-6 cap — dense rows fit all positions comfortably
- "view full portfolio →" link at bottom to `/feed/[portfolioId]`
- Remove `PositionCard` import (component still used on `/[handle]` profile page — don't delete the file)

The feed page already fetches `id, portfolio_id, ticker, name, allocation_pct, current_price, gain_loss_pct, shares, market_value` — all data needed. No server page changes.

**Depends on:** None (pure UI). Can execute in parallel with Tasks 5-7.

---

## Task Dependency Graph

```
Task 1 → Task 2 → Task 3 → Task 4
                                ↓
              Task 5 (types + routes) → Task 6 (richer bodies)
                     ↓
                   Task 7

Task 8 (independent — parallel with any)
```

Task 5 now includes the `FanoutChange` type extension (moved from Task 6) so TypeScript accepts the `price` property on change objects before the routes reference it.

Recommended execution: 1, 2, 3, 4, 5, 8, 6, 7

---

## Review Notes (Instance 2, Round 1)

**Date:** 2026-04-28

### Finding 1 (Critical): Task 5/6 type ordering — FIXED
Moved `FanoutChange` type extension from Task 6 into Task 5. The type must be widened before routes add `price` to change objects, otherwise TypeScript rejects the excess property.

### Finding 2 (Important): Dual-fallback failure — FIXED
Quote route now returns `{ticker, price: null, ...}` (200) when both Finnhub and Yahoo are down. The AddPositionForm treats `price: null` as "enter price yourself" — FM can still add positions without live pricing.

### Finding 3 (Important): ARIA combobox — FIXED
TickerSearch spec now requires `role="combobox"`, `aria-expanded`, `aria-autocomplete="list"`, `aria-activedescendant`, and `role="listbox"` / `role="option"` on the dropdown per WAI-ARIA combobox pattern.

---

## Files Summary

**Create (5):**
- `src/lib/finnhub.ts`
- `src/app/api/market/search/route.ts`
- `src/app/api/market/quote/route.ts`
- `src/app/api/market/status/route.ts`
- `src/components/ui/ticker-search.tsx`

**Modify (7):**
- `src/components/ui/add-position-form.tsx` (major rewrite)
- `src/app/feed/feed-sections.tsx` (major rewrite)
- `src/app/api/positions/manual/route.ts` (wire thesis_note + price)
- `src/app/api/positions/assign/route.ts` (wire thesis_note)
- `src/lib/notification-fanout.ts` (richer bodies + FanoutChange types)
- `src/lib/__tests__/notification-fanout.test.ts` (new test cases)
- `src/app/(dashboard)/dashboard/positions/positions-client.tsx` (removal confirmation)
- `.env.example` (add FINNHUB_API_KEY)

**Unchanged but relevant:**
- `src/components/ui/position-card.tsx` — still used on `/[handle]` profile, not deleted
- `src/app/feed/page.tsx` — already fetches all needed position data
- `src/lib/push.ts` — push body enrichment is automatic via notification body

---

## Verification

### Automated
- `npm test` — all existing tests pass + new notification-fanout test cases
- `npm run build` — clean build

### Manual Smoke (Surfer on prod after merge)

**FM Trading Terminal:**
1. Go to /dashboard/portfolios → expand a portfolio → click "add position"
2. Type "AMP" → see autocomplete dropdown with ticker suggestions
3. Select a ticker → live quote card appears with price, daily change, market status
4. Toggle between "shares" and "amount" buy modes → computed values update
5. Add a thesis note → submit → position appears in portfolio
6. Remove a position → confirmation with thesis input → confirm

**Feed Redesign:**
7. As dopler, go to /feed → each portfolio is a single card with dense table rows
8. Rows show: ticker, shares, price, allocation %, gain/loss %
9. Click portfolio header to collapse/expand
10. "view full portfolio →" link navigates to detail page

**Notifications:**
11. After FM adds a position with thesis note → dopler receives push
12. Lock screen shows: "Portfolio Name / bought AAPL · $189.50 · 40% allocation"
13. If thesis provided, it appears in the notification body
14. In-app notifications (bell + alerts page) show enriched body

**Edge cases:**
15. Finnhub rate limit / down → quote route falls back to Yahoo Finance
16. Market closed → status badge shows "closed"
17. Ticker with no Finnhub data → graceful "no matches" in search
18. Position with no price data → notification body falls back to basic format

---

## Plan Review — Round 1 (Instance 2)

**Reviewed:** 2026-04-28
**Reviewer focus areas:** Finnhub API compatibility, TickerSearch keyboard nav, AddPositionForm container, FanoutChange backward compat, feed data verification, Yahoo Finance fallback

### Verified ✓

1. **Finnhub API endpoints correct** — `/search?q=`, `/quote?symbol=`, `/stock/market-status?exchange=US` are all documented free-tier endpoints. `AbortSignal.timeout(5000)` works on Vercel serverless (Node 18+). Free tier: 60 calls/min — adequate for FM-only feature.

2. **FanoutChange extension is backward-compatible** — Adding optional `price?: number` and `allocation_pct?: number` to the discriminated union variants is safe. All 4 callers (`manual/route.ts` POST/DELETE, `assign/route.ts` POST/DELETE) construct plain objects without these fields. SnapTrade sync uses `PositionChange` from `position-diff.ts` (has extra `positionId` field, only emits sell/rebalance) — unaffected.

3. **AddPositionForm container compatibility** — `expandable-portfolio-card.tsx` wraps the form in AnimatePresence + `motion.div` (line 475-479). The outer `GlassCard` has `overflow-hidden p-0` but AnimatePresence handles dynamic height transitions. Switching from the current 4-column grid (line 116 of `add-position-form.tsx`) to vertical flow will work — the container adapts to content height.

4. **Feed redesign data availability** — `feed/page.tsx` line 103 already fetches `id, portfolio_id, ticker, name, allocation_pct, current_price, gain_loss_pct, shares, market_value`. All columns needed for the dense table (TICKER, SHARES, PRICE, ALLOC, G/L) are present. No server page changes needed.

5. **assign/route.ts POST already wires thesis_note** — Line 93 already has `thesis_note: body.thesis_note ?? null`. Task 5 correctly targets only the DELETE path (line 134) for this file.

### Findings

**Finding 1 — [CRITICAL] Task dependency: Task 5 adds `price` before FanoutChange type allows it**

Task 5 says: "POST changes array: add `price: price ?? undefined` to the buy change object" in `manual/route.ts`. But the `FanoutChange` buy variant is currently `{ type: "buy"; ticker: string; shares: number }` — no `price` field. The type extension adding `price?: number` is in Task 6.

Dependency graph has Task 5 → Task 6 (5 executes first). TypeScript's excess property checking will reject `{ type: "buy", ticker, shares, price }` passed where `FanoutChange` is expected because `price` isn't a known property yet.

**Fix:** Move the `FanoutChange` type extension (adding `price?` and `allocation_pct?` to all three variants) from Task 6 into Task 5. Task 5 becomes: "extend FanoutChange types, then wire thesis_note + price through API routes." Task 6 then focuses purely on `describeOneChange()` rewrite and notification enrichment.

**Finding 2 — [IMPORTANT] Dual-fallback failure path not specified**

Task 2's quote route falls back to Yahoo Finance if Finnhub fails. But `query1.finance.yahoo.com/v8/finance/chart/` is unofficial — Yahoo has been intermittently blocking unauthenticated requests (429s, cookie/crumb requirements). The existing `src/app/api/positions/price/route.ts` already uses this endpoint, so it's a known codebase risk.

The plan should specify what happens when BOTH providers fail. Recommendation: return `{ ticker, price: null, change: null, changePercent: null, error: "price_unavailable" }` and let the UI show the ticker with "price unavailable" rather than blocking the entire add-position flow. The FM can still manually enter shares without live pricing.

**Finding 3 — [IMPORTANT] TickerSearch missing accessibility spec**

Task 3 describes keyboard navigation (arrow up/down, enter to select, escape to close) but omits WAI-ARIA combobox attributes. The component needs:
- Input: `role="combobox"`, `aria-expanded`, `aria-autocomplete="list"`, `aria-controls="[listbox-id]"`
- Dropdown: `role="listbox"`, `id` matching `aria-controls`
- Each option: `role="option"`, `aria-selected`
- Active option tracking via `aria-activedescendant` on the input

Add a one-liner to Task 3: "Follow WAI-ARIA combobox pattern (role, aria-expanded, aria-activedescendant)."

**Finding 4 — [NIT] Finnhub rate limit at scale**

Free tier: 60 calls/min globally (not per-user). Each add-position flow triggers up to 3 calls (search keystrokes + quote + market status). With aggressive debouncing (300ms) and 5-min/30s/60s caching, this is fine for early usage. Flag as a known limitation — if multiple FMs are active simultaneously, search calls could exhaust the limit. The 5-min cache on search results is the right mitigation.

### Verdict: NEEDS REVISION

- **1 critical:** Task 5/6 dependency ordering causes a TypeScript build error. Move FanoutChange type extension into Task 5.
- **1 important:** Specify graceful degradation when both Finnhub and Yahoo Finance fail.
- **1 important:** Add ARIA combobox spec to Task 3 (one line).
- **1 nit:** Acknowledged, no action needed.

All fixable with minor plan edits — no structural changes to the task breakdown or dependency graph.

---

## Plan Review — Round 2 (Instance 2)

**Reviewed:** 2026-04-28
**Round 1 findings:** 1 critical, 2 important, 1 nit

### Round 1 Fix Verification

1. **[CRITICAL] Task 5/6 type ordering — RESOLVED.** FanoutChange type extension moved into Task 5 (lines 93-98). Explicit ordering note at line 98 prevents misinterpretation. Task 6 line 119 confirms types are already in place. Dependency graph updated at line 188 with explanatory note at line 195. TypeScript will now accept `price` on change objects when the route changes in the same task reference them.

2. **[IMPORTANT] Dual-fallback failure — RESOLVED.** Task 2 quote route (line 38) now specifies: 200 response with `{ticker, price: null, change: null, changePercent: null, error: "price unavailable"}` when both Finnhub and Yahoo fail. Form treats `price: null` as manual-entry mode. The 200 status (not 502) is the right call — the request succeeded, just without price data.

3. **[IMPORTANT] ARIA combobox — RESOLVED.** Task 3 (line 54) now specifies the full WAI-ARIA combobox pattern: `role="combobox"`, `aria-expanded`, `aria-autocomplete="list"`, `aria-activedescendant` on the input; `role="listbox"` with matching `id` on the dropdown; `role="option"` with unique `id` on each option.

### New Issues Check

No new issues introduced by the revisions. Verified:
- Type extension code block shows buy + sell variants only; rebalance left as-is — correct, since `describeOneChange` only handles buy/sell and rebalances get a summary message
- Dependency graph accurately reflects the merged Task 5 scope
- Review Notes section (lines 201-213) correctly documents the Architect's fixes inline with the plan body

### Verdict: APPROVED

All 3 Round 1 findings resolved correctly. Plan is ready for Instance 3 implementation.

**Implementation notes for Instance 3:**
- Task 5 is now the heaviest task — type extension + 2 route files. Commit the type extension first, then the route changes, to keep commits logical.
- The `rebalance` variant of FanoutChange is intentionally NOT extended with `price?` — only buy and sell need it.
- Quote route's `price: null` fallback means Task 4's AddPositionForm must handle null price gracefully (hide quote card, show manual shares input only).

---

## Implementation Review (Instance 2)

**Reviewed:** 2026-04-29
**Branch:** `feat/sprint-10-fm-terminal-feed-redesign` (10 commits)
**Tests:** 149/149 across 27 files (was 145 — 4 new fanout cases)
**Build:** clean, all three new market routes (`/api/market/{search,quote,status}`) present in route table

### Focus Area Verification

**1. TickerSearch combobox semantics — PASS ✓**

`src/components/ui/ticker-search.tsx` implements the full WAI-ARIA combobox pattern:
- Input (lines 148-152): `role="combobox"`, `aria-expanded` bound to `open`, `aria-autocomplete="list"`, `aria-controls={listboxId}`, `aria-activedescendant={activeOptionId}` (resolves to undefined when no active option, removing the attribute from DOM correctly)
- Listbox (line 166): `role="listbox"` with `id={listboxId}` matching `aria-controls`
- Options (lines 186-187): `role="option"`, `aria-selected={i === activeIndex}`, unique `id={`${optionIdPrefix}-${i}`}`
- Empty state (lines 170-177): `role="option"` + `aria-disabled` so screen readers announce "no matches" rather than getting stuck
- Two separate `useId()` calls (lines 38-39) for listbox vs option-prefix prevents collision when multiple TickerSearch instances mount
- Keyboard nav: ArrowDown/Up wrap top-to-bottom, Enter selects, Escape closes — all via `e.preventDefault()` to avoid form submission
- Outside-click handler scoped via `containerRef` (lines 82-91)

**2. Fanout body enrichment — PASS ✓**

`describeOneChange` in `src/lib/notification-fanout.ts` (lines 252-266) produces all 4 plan formats. Verified by 4 new test cases (lines 310-389):
- `"bought AAPL · $189.50 · 40% allocation"` (buy + price + allocation, line 332) ✓
- `"bought AAPL · $189.50 — 'AI infrastructure play'"` (buy + price + thesis, line 350-352) ✓
- `"sold AAPL · $189.50"` (sell + price, line 371) ✓
- `"bought AAPL"` (no price fallback, line 388) ✓

`thesis_note` is correctly threaded via the second parameter — `describeOneChange(change, input.thesis_note)` (line 142). `meta` field now also carries `price` and `allocation_pct` (lines 149-151) for client-side reuse.

**3. Quote-route null-price fallback — PASS ✓**

`src/app/api/market/quote/route.ts` graceful-degradation chain:
- Finnhub primary: `getQuote(ticker)` in try block (line 81). Both `null` returns (e.g., empty quote for unknown ticker) AND thrown errors (timeouts, 4xx/5xx) fall through.
- Yahoo fallback: `fetchYahooQuote(ticker)` returns `null` on any failure mode — non-OK response, missing `regularMarketPrice`, JSON parse error, AbortSignal timeout (lines 20-58).
- Final fallback: explicit 200 response with `{price: null, error: "price unavailable"}` (lines 97-103).

The form (`src/components/ui/add-position-form.tsx`) handles null price end-to-end:
- Line 197 conditional: shows live quote card only when `quote.price != null`, otherwise renders amber-bordered manual-price input (lines 233-247).
- `effectivePrice` computation (lines 103-107) prefers `quote.price` then falls back to `Number(manualPrice)` — so the form accepts the FM's own pricing when both providers are down.
- Submit disabled (line 149) until `effectivePrice > 0` AND `computedShares > 0`, preventing zero-price inserts.

**4. Feed redesign collapse/expand animation — animation works, but introduces an HTML-validity issue (see Finding 1 below)**

Animation mechanics are correct: outer `AnimatePresence mode="popLayout"` with `motion.section layout` for portfolio enter/exit, inner `AnimatePresence initial={false}` with height-from-0-to-auto + opacity tween + `style={{overflow: "hidden"}}` for body expand/collapse. `initial={false}` prevents a flash on initial mount. Chevron icon swap (Down ↔ Right) uses two same-sized 16px icons so the header doesn't reflow. No layout shift observed in the structure.

**5. thesis_note threading — PASS ✓**

Both manual and assign DELETE paths now accept and thread `thesis_note`:
- `src/app/api/positions/manual/route.ts`: POST body type at line 127 (`thesis_note?: string | null`), threaded to fanout at line 235 with `body.thesis_note ?? null`. DELETE body type at lines 264-267, threaded at line 319.
- `src/app/api/positions/assign/route.ts`: POST already wired (line 93, pre-Sprint 10). DELETE body type at lines 108-111, threaded at line 138.

Form sends correctly:
- Trading terminal (`add-position-form.tsx` line 136): `thesis_note: thesis.trim() || null`
- Removal flow (`positions-client.tsx` line 124): `thesis_note: thesisNote.trim() || null`

### Findings

**Finding 1 — [IMPORTANT] Nested interactive elements in `feed-sections.tsx` PortfolioCard**

`src/app/feed/feed-sections.tsx` lines 64-144: the PortfolioCard header is wrapped in a `<button>` that contains an `<a>` (line 75 — Link to `/{fm_handle}`) AND another `<button>` (line 130 — `<UndoplButton>`). This is **invalid HTML** — the HTML5 `<button>` content model excludes interactive content descendants. The previous (pre–Sprint 10) implementation used a plain `<div>` wrapper; this regression was introduced by the rewrite.

**Symptoms in production:**
- React's `validateDOMNesting` warning fires in dev mode: `<a> cannot appear as a descendant of <button>`.
- Screen readers announce the entire header as one button label, so VoiceOver/NVDA users won't hear "view {fm_name}'s profile" as a distinct link.
- Tab key behavior inside the inner Link/UndoplButton is browser-dependent — Safari and Firefox handle it differently from Chromium.
- `e.stopPropagation()` (lines 72, 116) prevents the toggle from firing on inner clicks but doesn't fix the validity issue.

**Suggested fix:** Replace the outer `<button>` with `<div role="button" tabIndex={0} aria-expanded={...} onKeyDown={...}>` where `onKeyDown` handles Enter/Space to toggle. The visual styling, click-to-toggle behavior, and the inner Link/UndoplButton all keep working correctly. ~10-line change.

**Finding 2 — [NIT] `allocation_pct` plumbed but never populated by any route**

The FanoutChange type's optional `allocation_pct?: number` field (line 18 of `notification-fanout.ts`) is exercised by the `describeOneChange` test (line 332) producing `"bought AAPL · $189.50 · 40% allocation"`. But neither `manual/route.ts` POST nor `assign/route.ts` POST actually sets it on the buy change. `manual/route.ts` line 226-232 only passes `type, ticker, shares, price` — no allocation.

In production, real FM buys via the trading terminal will produce bodies like `"bought AAPL · $189.50"` (price only), never `"...· 40% allocation"`. The plan's spec (Task 6 example) sets an expectation that won't materialize without a follow-up that either (a) recomputes allocation post-insert and re-emits, or (b) accepts allocation from the form (which has no allocation input).

This is a **partial implementation, not a regression**. Infrastructure is in place; just no caller exercises it. Worth flagging because the post-merge smoke test specifies "bought AAPL · $189.50 · 40% allocation" on the lock screen (Verification step 12) — that won't appear. Surfer will see `"bought AAPL · $189.50"` and may flag it as a bug.

### Other observations (no action)

- CHANGELOG entry comprehensive and accurate (date 2026-04-29, full files-changed + risks).
- `PositionCard` correctly preserved for `/[handle]` profile — only the `PositionLike` type is imported by `feed-sections.tsx` (line 8), the component itself stays unused there.
- Manual DELETE thesis_note path is plumbed but not exercised by the new UI — `positions-client.tsx` calls `assign` DELETE for removals. Intentional plumbing for parity.
- `as any` casts in `manual/route.ts` DELETE (lines 285-318) are pre-existing patterns continued for the nested portfolios join shape.
- `npm run build` produced one warning (turbopack lockfile detection) — pre-existing, not Sprint 10.
- The sub-five-second `AbortSignal.timeout(5000)` on Finnhub fetches is shorter than Vercel's 10s default, leaving headroom for the Yahoo fallback to also complete inside one serverless invocation.

### Verdict: APPROVED WITH ONE ITEM TO ADDRESS

- **1 important:** Finding 1 (nested interactive elements) should be fixed before merge — small change, real accessibility regression for a major rewrite. Suggest a follow-up commit on the same branch.
- **1 nit:** Finding 2 (allocation_pct) is a partial-implementation gap, not a bug. Could ship as-is; a later commit can wire allocation if/when the FM trading terminal grows an allocation input or a post-insert recompute path.

If the nested-button fix lands as a follow-up commit (e.g., `fix(feed): replace nested button with div role=button for valid HTML`), this branch is good to merge. Tests + build are both green; the rest of the implementation matches the plan precisely.

---

## Final Review (Instance 2) — after follow-up commits

**Reviewed:** 2026-04-29
**Branch state:** 12 commits, 149/149 tests, build clean
**Commits added since prior review:** `9b472ba` (Finding 1 fix), `620c243` (Finding 2 fix)

### Finding 1 follow-up: `9b472ba` — div role=button

The outer `<button>` swap to `<div role="button" tabIndex={0}>` is the right call. The original HTML5 invalidity is gone — `<div>` allows interactive descendants. `aria-expanded` and `aria-controls` are preserved so the relationship to the position-table region survives. The new `focus-visible:ring-2 focus-visible:ring-[color:var(--dopl-lime)]/40` is a thoughtful addition — keyboard users now see a clear focus indicator that the original `<button>` didn't have. `cursor-pointer` re-adds the affordance that `<div>` lost from `<button>`'s implicit pointer.

**However — one new keyboard-only regression introduced by the fix.** ❗

The `onKeyDown` handler (lines 73-78) fires on any Enter/Space keydown that bubbles up to the outer div, regardless of where focus actually is. When a keyboard user tabs onto the inner `<Link>` (FM avatar/handle) and presses Enter, the sequence is:

1. KeyDown fires on the Link, bubbles to outer div
2. Outer div's handler calls `e.preventDefault()` → cancels the browser's default Enter-on-link → no synthetic click → no navigation
3. `toggle()` runs → portfolio expands/collapses instead of navigating to the FM profile

Same issue when focus is on `<UndoplButton>` — Enter/Space toggles the portfolio instead of opening the undopl confirmation.

The `onClick={(e) => e.stopPropagation()}` on the wrapper divs (lines 84, 128) prevents *click* bubbling but doesn't cover *keydown* — keydown still bubbles from the inner element through those wrappers up to the outer div. Mouse/touch users are unaffected (because `onClick` propagation is properly stopped); only keyboard users hit this.

**One-line fix:**
```tsx
onKeyDown={(e) => {
  if (e.target !== e.currentTarget) return;  // ← add this
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    toggle();
  }
}}
```

The early return ensures the toggle only fires when the outer div itself is the keyboard-focused element (not when the keydown is bubbling up from an inner Link/Button). All other behaviors stay identical.

### Finding 2 follow-up: `620c243` — allocation_pct computation — APPROVED ✓

Clean, correct implementation in `src/app/api/positions/manual/route.ts` (16 lines added):

- Computes `allocationPct` only when the new position has `market_value > 0` — gracefully skipped when price unavailable.
- The post-insert `SELECT market_value WHERE portfolio_id=...` query correctly includes the just-inserted row, so `total` is the up-to-date portfolio total.
- Math: `(market_value / total) * 100` produces the right percentage for both edge cases (single position → 100%, multi-position → fractional).
- Passed onto the buy change as `allocation_pct: allocationPct`. `describeOneChange` already knows how to render it via `change.allocation_pct.toFixed(0)`.
- Uses the user's `supabase` (not admin) for the SELECT — RLS-safe since ownership was already verified upstream.
- Defensive `if (total > 0)` guard against division by zero.

Production smoke step 12 (`"...· 40% allocation"` on lock screen) will now match what the FM trading terminal emits. Resolves the original NIT cleanly.

### Verdict: APPROVED — one keyboard-only follow-up suggested, not blocking

- **Finding 1 (original HTML validity):** RESOLVED by `9b472ba`. Branch is no longer invalid HTML5, no longer trips React's validateDOMNesting, and screen readers will announce the role correctly.
- **Finding 2 (allocation_pct):** RESOLVED by `620c243`.
- **New issue:** keyboard activation of inner `<Link>` / `<UndoplButton>` is intercepted by the outer toggle handler. One-line fix (`if (e.target !== e.currentTarget) return;`) restores the original keyboard behavior. Suggest a 13th follow-up commit before merge — it's a one-token change.

Tests + build remain green. The rest of the implementation matches the plan and the review-round fixes precisely. Ship the keyboard fix and this branch is fully ready for merge.

---

## Sign-off — after `d265fa4`

**Reviewed:** 2026-04-29
**Branch:** 13 commits, 149/149 tests, build clean.

The keydown-filter commit (`d265fa4`) is exactly the suggested fix: `if (e.target !== e.currentTarget) return;` as the first line of the outer div's `onKeyDown` handler, with an inline comment naming the inner Link / UndoplButton case. Mouse/touch behavior is unchanged. Keyboard users on the inner elements now activate them as expected; only header-direct keypresses toggle.

All Sprint 10 findings (plan rounds + implementation rounds) are now resolved:
- Plan Round 1 critical (Task 5/6 type ordering) ✓
- Plan Round 1 important (dual-fallback failure) ✓
- Plan Round 1 important (ARIA combobox spec) ✓
- Implementation important (HTML validity / nested interactive) ✓
- Implementation nit (allocation_pct never populated) ✓
- Final review nit (keyboard regression from the validity fix) ✓

**Branch is fully cleared for merge** under the "first-merge of a new sprint" policy — Surfer merges + pushes manually, then smokes on `dopl-app.vercel.app`.
