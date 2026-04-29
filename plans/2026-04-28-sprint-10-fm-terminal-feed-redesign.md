**Status:** implemented (hotfix round 1)

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

---

# Sprint 10: Hotfix Round 1

Post-merge smoke testing by Surfer revealed 11 issues across the trading terminal, feed, notifications, and portfolio card. All are bugs or small UX polish from the Sprint 10 feature set — no new scope.

**Branch:** `fix/sprint-10-hotfix-r1`

**Prerequisites:** None (Finnhub key already deployed)

---

## Task H1: Fix Autocomplete Dropdown Clipping

**File:** `src/app/(dashboard)/dashboard/portfolios/expandable-portfolio-card.tsx`

**Root cause:** The `motion.div` wrapping the expanded body (line ~237) uses `overflow-hidden` in its className. This clips all absolutely-positioned children regardless of z-index. The TickerSearch dropdown (`position: absolute`, `z-30`) renders inside this container, so it's cut off at the card boundary instead of floating above sibling elements.

**Fix:** Use framer-motion's `transitionEnd` to switch overflow after the expand animation completes:

```tsx
animate={{
  height: "auto",
  opacity: 1,
  transitionEnd: { overflow: "visible" },
}}
exit={{
  overflow: "hidden",
  height: 0,
  opacity: 0,
}}
style={{ overflow: "hidden" }}
```

Remove `overflow-hidden` from the className (it's now handled via inline style + animation).

**Exit criteria:** TickerSearch dropdown renders above the footer buttons when the portfolio card is expanded. Collapse animation still clips content smoothly.

**Depends on:** None

---

## Task H2: Fix Draft 0% on Newly Added Positions

**File:** `src/app/(dashboard)/dashboard/portfolios/expandable-portfolio-card.tsx`

**Root cause:** The `draft` state is initialized via `useState(() => ...)` which only runs on mount. When `router.refresh()` pushes new positions as props (after adding a position via the trading terminal), the draft state doesn't include the new position — it shows 0%.

**Fix:** Add a `useEffect` that syncs draft when positions change:

```tsx
useEffect(() => {
  setDraft((prev) => {
    const next = { ...prev };
    for (const p of positions) {
      if (!(p.id in next)) {
        next[p.id] = p.allocation_pct != null
          ? Number(p.allocation_pct)
          : brokerPcts.get(p.id) ?? 0;
      }
    }
    // Remove draft entries for positions that no longer exist
    for (const id of Object.keys(next)) {
      if (!positions.some((p) => p.id === id)) delete next[id];
    }
    return next;
  });
}, [positions, brokerPcts]);
```

**Exit criteria:** After adding a position, the "Your %" column shows the computed allocation immediately without requiring a page refresh.

**Depends on:** None

---

## Task H3: Inline Position Management (Add/Reduce/Delete Per Row)

**File:** `src/app/(dashboard)/dashboard/portfolios/expandable-portfolio-card.tsx`

**Problem:** Currently the FM can only add new positions via the trading terminal, and must navigate to "manage positions" to delete. Adjusting shares on existing positions requires manually searching the same ticker again. The FM should be able to add, reduce, or remove shares directly from the position table row.

**Changes to position table:** Add a new column (col-span-1) at the right of each position row with two icon buttons:

1. **Adjust button** (Pencil or PlusMinus icon): toggles an inline expansion below the row.
   - Shows: current shares (read-only), new share count input, thesis note input ("why? optional"), confirm/cancel buttons.
   - On confirm: POST to `/api/positions/manual` with `{ portfolio_id, ticker, shares: newShares, current_price: pos.current_price, name: pos.name, thesis_note }`. This hits the existing upsert path (same ticker in same portfolio → update).
   - State: `adjusting: { id: string; ticker: string } | null`, `adjustShares: string`, `adjustThesis: string`.

2. **Delete button** (Trash2 icon): toggles an inline confirmation row below the position.
   - Shows: "remove {ticker}?" + thesis note input + cancel/confirm buttons. Same pattern as the Task 7 removal flow in `positions-client.tsx`.
   - On confirm: DELETE to `/api/positions/manual` with `{ id }`, then `router.refresh()`.
   - State: `pendingRemove: { id: string; ticker: string } | null`, `removeThesis: string`.

**Grid change:** Existing `grid-cols-12` becomes `grid-cols-[3fr_3fr_2fr_2fr_2fr_auto]` to accommodate the action column. Or keep 12 cols and reduce others by 1 to free up col-span-1 for actions.

**Existing "add position" form stays** — it's for discovering and adding **new** tickers via search. The inline adjust is for **existing** positions only.

**Exit criteria:** FM can click adjust on AMPX row → change shares from 42 to 60 → add optional thesis → confirm. FM can click trash on GOOG row → see confirmation → add thesis → confirm deletion. Both refresh the portfolio card immediately.

**Depends on:** H1 (overflow fix ensures inline expansions aren't clipped), H2 (draft sync so new counts appear correctly)

---

## Task H4: Upsert Fanout (Rebalance Notification)

**Files:** `src/lib/notification-fanout.ts`, `src/app/api/positions/manual/route.ts`

**Root cause:** The upsert path (lines 192-208) explicitly skips `fanOutPortfolioUpdate`. Comment: "ticker already exists means the FM is editing shares/price, not adding a new holding, so no fanout." Surfer wants doplers notified when the FM increases or decreases an existing position.

**Changes:**

### Step 1: Extend FanoutChange rebalance variant (notification-fanout.ts)

Line 21: add `price?: number` to the rebalance variant (currently missing — Sprint 10 Task 5a only added `price` to buy/sell):

```ts
// Before:
| { type: "rebalance"; ticker: string; prevShares: number; shares: number };
// After:
| { type: "rebalance"; ticker: string; prevShares: number; shares: number; price?: number };
```

This MUST happen before the route change below, otherwise TypeScript rejects `price` on rebalance objects. Separate commit.

### Step 2: Fire fanout on upsert (manual/route.ts)

1. Line ~196: change `.select("id")` → `.select("id, shares")` on the existing-position lookup.

2. After the successful update (line ~206), when `isExplicitPortfolio` **and shares actually changed**, fire fanout:
   ```ts
   if (isExplicitPortfolio) {
     const prevShares = Number(existing.shares) || 0;
     const newShares = shares ?? 0;
     if (prevShares !== newShares) {
       await fanOutPortfolioUpdate(createAdminClient(), {
         portfolio_id: portfolioId,
         fund_manager_id: user.id,
         changes: [{
           type: "rebalance",
           ticker,
           prevShares,
           shares: newShares,
           price: price ?? undefined,
         }],
         description: `rebalanced ${ticker}`,
         thesis_note: body.thesis_note ?? null,
       });
     }
   }
   ```

3. Remove or update the comment at line ~191 to reflect the new behavior.

**Guard:** `prevShares !== newShares` prevents notification spam on no-op updates (re-submitting unchanged shares would otherwise produce "rebalanced AMPX · 42 → 42 shares").

**Exit criteria:** When FM changes shares on an existing ticker (upsert), every active dopler on the portfolio receives a notification. No notification fires when shares are unchanged. When using the Manual Holdings path (no portfolio_id), no fanout fires (unchanged).

**Depends on:** None (can run in parallel with H1-H3, but logically H3 is what triggers this path from the UI)

---

## Task H5: Rebalance Notification Body + Routing Fix

**File:** `src/lib/notification-fanout.ts`

**Two problems:**
1. `describeOneChange` signature is `(change: FanoutChange & { type: "buy" | "sell" })` — doesn't accept rebalance.
2. The notification loop (lines 124-172) routes ALL rebalances through a summary path: `"rebalanced — N positions"`. Single-ticker rebalances (from H4) need per-ticker enriched bodies. Multi-ticker rebalances (SnapTrade sync diffs) should keep the summary path to avoid notification spam.

**Changes:**

### Step 1: Widen `describeOneChange` signature

```ts
// Before:
function describeOneChange(
  change: FanoutChange & { type: "buy" | "sell" },
  thesisNote?: string | null
): string {

// After:
function describeOneChange(
  change: FanoutChange,
  thesisNote?: string | null
): string {
```

Add the rebalance case inside the function:
```ts
if (change.type === "rebalance") {
  const parts: string[] = [`rebalanced ${change.ticker}`];
  if (change.prevShares != null && change.shares != null) {
    parts.push(`${change.prevShares} → ${change.shares} shares`);
  }
  if (change.price != null) parts.push(`$${change.price.toFixed(2)}`);
  let body = parts.join(" · ");
  const thesis = thesisNote?.trim();
  if (thesis) body += ` — '${thesis}'`;
  return body;
}
```

### Step 2: Route single-ticker rebalances individually

In the notification loop, split the rebalance handling:

```ts
// Before (lines 157-172): all rebalances → one summary row
if (rebalances.length > 0) {
  notifRows.push({ ... body: `rebalanced — ${rebalances.length} position${...}` ... });
}

// After: single rebalance → per-ticker enriched row, multi → summary
if (rebalances.length === 1) {
  notifRows.push({
    user_id: userId,
    portfolio_update_id: updateId,
    title: portfolio.name,
    body: describeOneChange(rebalances[0], input.thesis_note),
    actionable: true,
    change_type: "rebalance",
    ticker: rebalances[0].ticker,
    meta: {
      shares: rebalances[0].shares,
      prev_shares: rebalances[0].prevShares,
      price: rebalances[0].price,
      portfolio_id: input.portfolio_id,
      ...(input.meta_extend ?? {}),
    },
  });
} else if (rebalances.length > 1) {
  // Multi-ticker rebalance (SnapTrade sync) — summary to avoid spam
  notifRows.push({ ... body: `rebalanced — ${rebalances.length} positions` ... });
}
```

The `individuals` filter (line 124-127) stays unchanged — it still only collects buy/sell. The type-narrowing cast `as Extract<FanoutChange, { type: "buy" | "sell" }>` is no longer needed since `describeOneChange` now accepts all variants, but keeping it is harmless.

### Step 3: Tests

**File:** `src/lib/__tests__/notification-fanout.test.ts`

Add 2 test cases:
1. Single rebalance with price + shares → notification body: `"rebalanced AMPX · 42 → 60 shares · $189.50"`
2. Single rebalance with thesis → body includes thesis quote

**Exit criteria:** Lock screen shows "Portfolio Name / rebalanced AMPX · 42 → 60 shares · $189.50" or with thesis appended. Multi-ticker rebalances (SnapTrade sync) still produce summary notifications.

**Depends on:** H4 (rebalance type extension + upsert path)

---

## Task H6: Feed Fixes

### H6a: G/L → P/L

**File:** `src/app/feed/feed-sections.tsx`

Line 218: change `g/l` → `p/l` in the table header. Rename the `gl` / `glPositive` variables to `pl` / `plPositive` for consistency.

### H6b: Compute Allocation from Market Value

**File:** `src/app/feed/feed-sections.tsx`

When `allocation_pct` is null (older positions, FM hasn't saved allocations), compute it client-side from `market_value` — same logic the FM portfolio card uses.

In `PositionTable`, compute the total market value across the positions passed to the component (already scoped to one portfolio — `PositionTable` receives `s.positions` per `PortfolioCard`). For each row: `alloc = (pos.market_value / total) * 100`. Use DB `allocation_pct` when present; fall back to computed; show "—" only when both `allocation_pct` and `market_value` are null.

### H6c: Debug "View Full Portfolio" Link

**File:** `src/app/feed/[portfolioId]/page.tsx`

The route exists and `s.portfolio_id` is always defined in the data flow. Surfer reports clicking the link "takes me nowhere." Investigate: check for runtime errors (missing data, auth issues, empty render). The link itself at `feed-sections.tsx:192-197` uses `<Link href={/feed/${s.portfolio_id}}>` which is correct. Likely a bug in the detail page — could be a data fetch that returns empty and renders nothing, or a redirect condition that bounces the user. **Ship as a documented finding if the root cause isn't immediately clear** — don't block the hotfix round on this.

**Exit criteria:** Feed table header shows "p/l". Allocation column shows computed percentages instead of "—" for positions with market_value. H6c: either fix confirmed or root cause documented for follow-up.

**Depends on:** None

---

## Task H7: Pie Chart Legend + Remove Illustrative Chart

**File:** `src/app/(dashboard)/dashboard/portfolios/expandable-portfolio-card.tsx`

### H7a: Pie Chart Legend

Below the PieChart `ResponsiveContainer`, add a simple legend: a `flex flex-wrap gap-x-4 gap-y-1 mt-3` container with items for each `donutData` entry:

```tsx
<div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
  {donutData.map((d, i) => (
    <div key={d.name} className="flex items-center gap-1.5 text-[10px] font-mono text-[color:var(--dopl-cream)]/60">
      <span
        className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
        style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
      />
      {d.name}
    </div>
  ))}
</div>
```

### H7b: Remove Illustrative 30-Day Chart

Replace the entire LineChart section (the `lg:col-span-3 glass-card-light` div) with a placeholder:

```tsx
<div className="lg:col-span-3 glass-card-light p-5 rounded-2xl flex flex-col items-center justify-center text-center">
  <TrendingUp size={24} className="text-[color:var(--dopl-cream)]/15 mb-2" />
  <p className="text-xs text-[color:var(--dopl-cream)]/40">
    performance tracking coming soon
  </p>
  <p className="text-[10px] text-[color:var(--dopl-cream)]/25 mt-1">
    historical portfolio returns will appear here
  </p>
</div>
```

Remove the `perfData` useMemo, the `LineChart`/`Line`/`XAxis`/`YAxis` imports (if no longer used elsewhere in the file), and the `linearGradient` def.

**Exit criteria:** Pie chart has visible ticker labels below it. The 30-day section shows "performance tracking coming soon" instead of fake data. No unused Recharts imports remain.

**Depends on:** None

---

## Task H8: Notification Fixes

### H8a: Bell Popup Positioning

**File:** `src/components/ui/notification-bell.tsx`

**Root cause:** When clicking a notification from the bell dropdown, `setPopup(...)` and `setOpen(false)` fire in the same handler. The dropdown's exit animation (portal teardown) races with the popup mount, causing a layout shift on mobile — the popup appears at the top of the screen instead of centered.

**Fix:** Use the dropdown's `AnimatePresence` `onExitComplete` callback or `requestAnimationFrame` to delay popup mount until after the dropdown portal tears down. Try `requestAnimationFrame` first; if the layout shift persists on mobile, escalate to `onExitComplete` on the dropdown's `AnimatePresence`:

```tsx
// Option A (try first): rAF delay
setOpen(false);
requestAnimationFrame(() => {
  setPopup(notification);
});

// Option B (if A insufficient): onExitComplete on dropdown AnimatePresence
// Move setPopup into the onExitComplete callback
```

### H8b: Clear Push Notifications on App Open

**File:** `src/components/dopler-shell.tsx`

When the user opens the app directly (not via push notification tap), delivered push notifications should be cleared from the notification tray.

Add to the existing `visibilitychange` handler or create one:

```tsx
useEffect(() => {
  const clearPush = () => {
    if (document.visibilityState !== "visible") return;
    navigator.serviceWorker?.ready.then((reg) =>
      reg.getNotifications().then((ns) => ns.forEach((n) => n.close()))
    );
  };
  // Clear on initial mount (app opened directly, not via push tap).
  clearPush();
  document.addEventListener("visibilitychange", clearPush);
  return () => document.removeEventListener("visibilitychange", clearPush);
}, []);
```

Note: `ServiceWorkerRegistration.getNotifications()` is supported in Chrome, Firefox, Edge, and Safari 16+. On older Safari/iOS where it's unavailable, the optional chaining on `navigator.serviceWorker` handles it gracefully. The initial `clearPush()` call covers the case where `visibilitychange` doesn't fire on first load.

**Exit criteria:** Clicking a notification from the bell opens the detail popup centered on screen, not at the top. Opening the app clears any pending push notifications from the notification tray.

**Depends on:** None

---

## Task Dependency Graph

```
H1 (overflow fix) ──┐
H2 (draft sync)  ───┤
                     ├── H3 (inline adjust/delete)
H4 step 1 (rebalance type ext) ─── H4 step 2 (route change) ─── H5 (rebalance body + routing)

H6 (feed fixes)      — independent
H7 (pie + chart)      — independent
H8 (notification)     — independent
```

**Recommended execution:** H1, H2, H4-step-1 in parallel → H3, H4-step-2 → H5 → H6, H7, H8 (independent, any order)

**Implementer notes from reviewer:**
1. H4 step 1 (FanoutChange type extension) must be a separate commit before H4 step 2 (route change) — same pattern as Sprint 10 Task 5a/5b.
2. H4 step 2 must guard `prevShares !== newShares` to prevent notification spam on no-op updates.
3. H5: the `individuals` filter on line 124-127 stays buy/sell only. Single rebalances route individually; multi-rebalance keeps the summary path.
4. H6b: total market value is per-portfolio (already scoped by `PositionTable` props).
5. H6c: ship as documented finding if root cause isn't immediately clear.
6. H8a: try rAF first, escalate to `onExitComplete` if layout shift persists.
7. H8b: fire `clearPush()` on initial mount AND on visibilitychange.

---

## Files Summary

**Modify (7):**
- `src/app/(dashboard)/dashboard/portfolios/expandable-portfolio-card.tsx` — overflow fix, draft sync, inline adjust/delete, pie legend, remove illustrative chart (H1, H2, H3, H7)
- `src/app/api/positions/manual/route.ts` — upsert fanout with rebalance change (H4)
- `src/lib/notification-fanout.ts` — rebalance body enrichment (H5)
- `src/lib/__tests__/notification-fanout.test.ts` — 2 new test cases (H5)
- `src/app/feed/feed-sections.tsx` — G/L→P/L, compute alloc from market_value (H6)
- `src/components/ui/notification-bell.tsx` — popup timing fix (H8a)
- `src/components/dopler-shell.tsx` — clear push on app open (H8b)

**Investigate (1):**
- `src/app/feed/[portfolioId]/page.tsx` — debug "view full portfolio" link (H6c)

---

## Verification

### Automated
- `npm test` — all existing tests pass + 2 new rebalance body test cases
- `npm run build` — clean build

### Manual Smoke (Surfer on prod after merge)

**Trading Terminal:**
1. Expand a portfolio → autocomplete dropdown renders above footer buttons
2. Add a new position → "Your %" shows correct value immediately (not 0%)
3. Click adjust on an existing position → inline row appears → change shares → add thesis → confirm → portfolio updates
4. Click delete on a position → confirmation + thesis → confirm → position removed

**Notifications:**
5. FM adjusts shares on existing position (upsert) → dopler receives push notification
6. Lock screen shows "rebalanced AMPX · 42 → 60 shares · $189.50"
7. If thesis provided, it appears in notification body
8. Open app directly (not via push) → push notifications clear from tray
9. Click notification from bell → detail popup appears centered on screen

**Feed:**
10. Column header shows "p/l" not "g/l"
11. Allocation column shows computed percentages for positions with market_value
12. "View full portfolio →" link navigates successfully

**Portfolio Card:**
13. Pie chart has color legend showing ticker names
14. 30-day section shows "performance tracking coming soon" placeholder

---

## Hotfix R1 Plan Review (Instance 2)

**Reviewed:** 2026-04-29
**Reviewer focus:** H3 body shape, H4 + H5 fanout typing, H6b architecture, H8b cross-browser

### Verified ✓

1. **H1 — overflow fix is the canonical pattern.** framer-motion's `transitionEnd: { overflow: "visible" }` after expand and `overflow: "hidden"` on exit is the established workaround for absolute-positioned children inside an animated `height: auto` container. Move from className to inline style as the plan describes.

2. **H2 — draft sync is correct.** The `useEffect` on `[positions, brokerPcts]` runs whenever positions arrive via `router.refresh()`, additively populating draft entries that don't exist and pruning entries for removed positions. The `(prev) => ({...prev, ...})` shape preserves any in-flight FM edits.

3. **H3 — manual route body shape supports the inline-adjust flow.** Verified directly against `src/app/api/positions/manual/route.ts` lines 119-128: POST body type already accepts `{portfolio_id, ticker, name, shares, current_price, thesis_note}` (and ignores `id` when not provided). The upsert path at lines 191-209 matches: ticker exists → update via `.update(row)`. **No API changes required.** Plan's claim is accurate.

4. **H6a, H6b — client-side allocation is architecturally fine for a hotfix.** Per-portfolio compute mirrors `expandable-portfolio-card.tsx` lines 75-86 (`brokerPcts` useMemo). No server changes, no schema changes, ~8 lines added in feed-sections. The duplication with the FM card is acceptable because both views compute the same percentage from the same source. Long-term, a DB-trigger or server-side compute on insert would centralize the logic, but that's out of scope.

5. **H7a, H7b — pie legend + chart removal are mechanical.** No risk. Verify the `Tooltip` import stays (still used by PieChart) when removing `LineChart`/`Line`/`XAxis`/`YAxis`.

6. **H8b — `getNotifications()` works on iOS Safari 16.4+ PWA.** Web Push and `ServiceWorkerRegistration.getNotifications()` ship together on iOS 16.4. Earlier iOS versions don't support Web Push at all, so there's nothing to clear and the optional chain on `navigator.serviceWorker?.ready` covers them. The MDN compatibility table confirms support across Chrome, Firefox, Edge, and Safari 16+ for the SW registration path.

### Findings

**Finding 1 — [CRITICAL] H5's rebalance type claim is wrong**

H5 says: *"The `rebalance` variant in `FanoutChange` already has `prevShares` and `shares`. It gained `price?: number` in Task 5a. No type changes needed."*

This is **factually incorrect**. Verified against the current `src/lib/notification-fanout.ts` line 21:

```typescript
| { type: "rebalance"; ticker: string; prevShares: number; shares: number };
```

Sprint 10's Task 5a only added `price?: number` to the buy and sell variants. The rebalance variant was intentionally left unchanged (documented in Round 2 plan review notes: "rebalance variant of FanoutChange left unchanged"). H4's snippet writes `price: price ?? undefined` onto a rebalance change, which TypeScript will reject:

```
Object literal may only specify known properties, and 'price' does not exist in type
'{ type: "rebalance"; ticker: string; prevShares: number; shares: number; }'
```

**Fix:** Move the rebalance-variant extension into H4 (or a new tiny H4-prereq sub-task):
```typescript
| {
    type: "rebalance";
    ticker: string;
    prevShares: number;
    shares: number;
    price?: number;
  };
```
Additive, backward-compatible (callers in `snaptrade/sync` don't supply price, which is fine since it's optional). Update H5's note that says "no type changes needed."

**Finding 2 — [CRITICAL] H5 doesn't address how rebalance changes get routed through `describeOneChange`**

The current fanout loop (notification-fanout.ts lines 124-188) splits changes into two paths:
- `individuals = changes.filter(c => c.type === "buy" || c.type === "sell")` — routed through `describeOneChange()` per-ticker
- `rebalances = changes.filter(c => c.type === "rebalance")` — combined into ONE summary notification per sub: `"rebalanced — N positions"`

`describeOneChange`'s signature explicitly excludes rebalance:
```typescript
function describeOneChange(
  change: FanoutChange & { type: "buy" | "sell" },
  thesisNote?: string | null
): string
```

H5 wants the rebalance variant to produce bodies like `"rebalanced AMPX · 42 → 60 shares · $189.50"` via `describeOneChange`. That requires:

1. **Widen the signature** from `change: FanoutChange & { type: "buy" | "sell" }` to `change: FanoutChange` (and add a `case "rebalance"` to the body composition).
2. **Change the call site** so single-ticker rebalances are routed per-ticker through `describeOneChange` instead of the summary path. The simplest split: when `rebalances.length === 1`, treat the single rebalance as an individual (per-ticker, enriched body); when `> 1`, keep the existing summary (avoids notification spam during snaptrade-sync rebalances which can produce many changes at once).

H5 should make both of these explicit. As written, the plan reads as a function-body change only, which is insufficient — implementer would either widen the signature ad-hoc (no spec), or hit a compile error and ask.

**Fix to H5:** Add two sub-bullets:
- Widen `describeOneChange` signature to accept `FanoutChange` (all variants); add a `case "rebalance"` block.
- In the fanout loop: when `rebalances.length === 1`, push the rebalance through the individuals branch; when `>= 2`, keep the summary notification.

**Finding 3 — [IMPORTANT] H4 will fire fanout on no-op updates**

The upsert path at line 200-208 calls `.update(row)` regardless of whether `shares` or `price` actually changed. With H4's new fanout, an FM who hits "confirm" on the inline-adjust flow with the SAME share count (or accidentally re-submits) will produce a notification like `"rebalanced AMPX · 42 → 42 shares · $189.50"` — the body literally states "no change happened."

**Fix:** Guard the fanout in H4 with a no-op detector:
```typescript
const prevShares = Number(existing.shares) || 0;
const newShares = shares ?? 0;
if (prevShares !== newShares) {
  await fanOutPortfolioUpdate(...);
}
```
Price-only updates without share change still skip fanout — quote refreshes shouldn't notify. If price-only changes need to notify in the future, that's a different change type ("price update") not a rebalance.

**Finding 4 — [IMPORTANT] H6b ambiguity: "total market value across all positions"**

H6b says *"compute the total market value across all positions, then for each row: `alloc = (pos.market_value / total) * 100`."* In feed-sections, the dopler may have multiple subscribed portfolios visible simultaneously. The implementer might naively sum across all sections — that would produce wrong percentages.

**Fix:** Make explicit: "compute total within each portfolio's `PositionTable` instance, not across the entire feed page." Since `PositionTable` already takes `positions: PositionLike[]` scoped to one portfolio, the fix is per-component natural — but the plan should say so to prevent misinterpretation.

**Finding 5 — [NIT] H8b should also fire on initial mount**

`visibilitychange` doesn't fire on first page load — only on subsequent visibility transitions. If the dopler taps a push, the SW posts PUSH_NAV and navigates them in, but the lingering notification stays in the tray until they switch away and back. **Fix:** Call `clearPush()` once at the end of the useEffect body (in addition to the listener registration), so the very first mount also clears.

**Finding 6 — [NIT] H8a's `requestAnimationFrame` may be insufficient**

The dropdown's exit animation is `duration: 0.18` (180ms) but rAF is one frame (~16ms). The fix defers popup mount by ~16ms — enough to escape React's same-render batching, but not enough to wait for the dropdown's exit-animation completion. If the layout shift is caused by simultaneous render (most likely), rAF works. If it's caused by the popup measuring layout while the dropdown is still in the DOM mid-exit, rAF won't fully resolve it.

**Suggested:** Implementer should test the rAF fix first (cheap). If the shift persists, escalate to AnimatePresence's `onExitComplete` callback on the dropdown — set popup only after the dropdown finishes exiting. Don't redesign the plan for the harder case until verified.

**Finding 7 — [NIT] H6c is an investigation task with no fallback exit criteria**

H6's exit criteria mixes H6a/b/c. If H6c's root cause turns out to need a migration or RLS rework, it can't ship in this hotfix. **Suggested:** Allow H6c to land as a documented finding (e.g., "viewing detail of non-subscribed portfolio bounces back to /feed because RLS blocks the read — separate fix"). H6's exit criteria should split per sub-task so H6a/b can ship even if H6c is parked.

### Sprint Containment Check

This is a post-merge hotfix branch off `main`, which is allowed under `feedback_no_auto_push.md` ("Hotfix iteration rounds … Claude auto-merges + pushes once tests + build are green"). New scope (inline adjust UI in H3, allocation compute in H6b, push-clear in H8b) is justifiable as direct response to smoke findings, not feature creep. ✓

### Verdict: NEEDS REVISION

- **2 critical:** H5's incorrect type claim (Finding 1) and missing routing change (Finding 2) will block implementation. Both fix in H5 with small additions.
- **2 important:** H4 no-op fanout (Finding 3) and H6b scope ambiguity (Finding 4) — small specifications.
- **3 nits:** H8b initial mount, H8a fallback, H6c partial-block exit criteria.

All resolvable with plan edits — no need to restructure tasks or rethink scope. Re-review after Architect revises H4 + H5 + H6b clarification + H8 polish.

---

## Hotfix R1 Plan Review — Round 2 (Instance 2)

**Reviewed:** 2026-04-29
**Round 1 findings:** 2 critical, 2 important, 3 nits

### Round 1 Fix Verification

1. **[CRITICAL] H5 rebalance type claim — RESOLVED.** Type extension promoted to H4 Step 1 (lines 650-661) with explicit before/after diff and "MUST happen before the route change below, otherwise TypeScript rejects `price` on rebalance objects. Separate commit." This mirrors the Sprint 10 Task 5a/5b pattern. The implementer notes (line 933) reinforce it.

2. **[CRITICAL] describeOneChange routing — RESOLVED.** H5 now has three explicit steps:
   - Step 1 (lines 710-739): widens signature from `FanoutChange & { type: "buy" | "sell" }` to `FanoutChange`, with the new rebalance case body composition shown inline (price + share-delta + thesis tail).
   - Step 2 (lines 741-773): splits the loop — `rebalances.length === 1` produces a per-ticker enriched row via `describeOneChange`; `rebalances.length > 1` keeps the summary path. The single-rebalance branch shows the full notification row construction (user_id, portfolio_update_id, title, body, change_type, ticker, meta).
   - Step 3 (lines 777-783): adds 2 test cases.
   
   The `individuals` filter staying buy/sell only is correctly noted, with the right explanation that the predicate `(c): c is Extract<...>` becomes redundant but harmless.

3. **[IMPORTANT] H4 no-op fanout guard — RESOLVED.** H4 Step 2 wraps the fanout in `if (prevShares !== newShares)` (lines 670-687). Comment on line 692 explains the spam prevention. Exit criteria explicitly says "No notification fires when shares are unchanged." The `Number(existing.shares) || 0` fallback handles null shares.

4. **[IMPORTANT] H6b scope — RESOLVED.** Line 805 now reads "compute the total market value across the positions passed to the component (already scoped to one portfolio — `PositionTable` receives `s.positions` per `PortfolioCard`)." Implementer notes line 936 reinforces it. Eliminates the cross-portfolio summing risk.

5. **[NIT] H8b initial mount — RESOLVED.** Line 903 calls `clearPush()` once before adding the listener. Comment on line 902 explains why: "Clear on initial mount (app opened directly, not via push tap)." Closing note at line 909 documents the rationale.

6. **[NIT] H8a fallback escalation — RESOLVED.** Lines 873-884 specify "Try `requestAnimationFrame` first; if the layout shift persists on mobile, escalate to `onExitComplete` on the dropdown's `AnimatePresence`." Both options shown as code snippets.

7. **[NIT] H6c partial-block — RESOLVED.** Line 811 adds: "**Ship as a documented finding if the root cause isn't immediately clear** — don't block the hotfix round on this." H6's exit criteria split per sub-task (line 813): "H6c: either fix confirmed or root cause documented for follow-up."

### New Issues Check

No new issues introduced. Verified:
- The dependency graph (lines 920-928) correctly reflects the new H4 step 1 / step 2 split.
- The recommended execution order accounts for the H4 split: "H1, H2, H4-step-1 in parallel → H3, H4-step-2 → H5".
- Files Summary still lists 7 modify + 1 investigate — accurate.
- The implementer notes block (lines 932-939) consolidates all 7 review findings as actionable bullets.
- The H5 multi-rebalance summary body (`"rebalanced — ${rebalances.length} positions"`) is correctly plural-only because the `> 1` branch only runs when length is 2+.

### Minor stylistic observations (no action)

- H5 Step 2 calls the existing predicate a "type-narrowing cast" — technically it's a type-guard predicate, not a cast. The conclusion (keeping it is harmless) is correct, just a small terminology nit.
- The H5 multi-rebalance branch uses `... body: \`rebalanced — ${rebalances.length} positions\` ...` shorthand. Implementer fills in the rest of the row from the existing pattern (lines 158-171 of notification-fanout.ts) — clear from context.

### Verdict: APPROVED

All 7 Round 1 findings resolved correctly. Plan is ready for Instance 3 implementation.

**Implementation summary for Instance 3:**
- 8 tasks → expected ~10-12 commits (H4 split into 2, H5 split into 3, others mostly single-commit)
- Test count: 149 → 151 (2 new rebalance body cases)
- All risks pre-identified and either fixed in plan or documented as implementer escalation paths (H8a rAF→onExitComplete, H6c documented finding)
- This is a hotfix branch off `main`, not a sprint branch — Claude auto-merges + pushes once tests + build pass per the merge policy
