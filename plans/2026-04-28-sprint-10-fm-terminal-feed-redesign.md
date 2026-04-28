**Status:** needs-revision

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
