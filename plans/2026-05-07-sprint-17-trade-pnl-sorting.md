# Sprint 17 — SnapTrade Cleanup + Trade Page + P&L + Sorting

**Created:** 2026-05-07
**Status:** implemented (hotfix r1 complete)
**Implementer round:** branch `feat/sprint-17-trade-pnl-sorting` — 7 commits, 151/151 tests, build clean
**Author:** Instance 1 (Architect)
**Reviewer:** Instance 2 (Reviewer)
**Implementer:** Instance 3 (2026-05-07)

## Context

Sprint 16 merged (toast fix, mobile scroll, positions UX, portfolio delete SET NULL, VALUE column). During Sprint 15/16 smoke testing, SnapTrade's "Connection Limit Reached" blocked multi-broker testing — ghost authorizations accumulate because our disconnect flow swallows upstream revocation failures.

Sprint 17 combines:
1. SnapTrade connection limit fix (cleanup + prevention)
2. P&L / cost basis tracking (wire SnapTrade's `average_purchase_price`)
3. Enhanced sell notifications (buy price, sell price, P&L in notification body)
4. Unified "Trade" page (portfolios + pool on one screen)
5. Portfolio sorting (4 standard sorts + custom manual order)
6. Drag-and-drop (portfolio reorder + position-to-portfolio assignment)
7. Catchup smoke coverage from Sprint 15/16

**Migration count:** 1 — `portfolios.display_order` (Task 7). No migration needed for P&L — `entry_price` and `gain_loss_pct` columns already exist.

**Branch:** `feat/sprint-17-trade-pnl-sorting`

---

## Task 1: SnapTrade authorization cleanup endpoint

**Problem:** SnapTrade free tier = 5 authorizations per user. Ghost authorizations accumulate when `removeBrokerageAuthorization()` fails silently during disconnect. FM sees "Connection Limit Reached" with only 1 active connection in dopl.

**Create:** `src/app/api/snaptrade/cleanup/route.ts`

**POST** — for the authenticated FM:
1. Fetch FM's `snaptrade_user_id` and `snaptrade_user_secret`
2. Call `snaptrade.connections.listBrokerageAuthorizations()` to list ALL SnapTrade-side authorizations
3. **Self-heal first:** For each active `broker_connections` row with `provider_auth_id = NULL` (migration-006 backfills), match by `broker_name` against the SnapTrade auth list's `brokerage.name` and persist the matched `id` back to the row. This is the same pattern as `sync-connection.ts:89-111`. Without this step, a legitimate-but-unhealed connection would be treated as a ghost and revoked.
4. Compare healed active `broker_connections` rows (keyed by `provider_auth_id`) against the SnapTrade auth list
5. For each SnapTrade authorization with NO matching active row → call `removeBrokerageAuthorization()` to free the slot
6. Return `{ total, removed, remaining, healed }` — `healed` = count of NULL provider_auth_ids that were backfilled

**GET** — diagnostic: list all SnapTrade authorizations + our active `broker_connections` rows for comparison. No mutations.

**Reuse:**
- `src/lib/sync-connection.ts:89-111` — self-heal pattern (match by broker_name, persist id)
- `src/app/api/snaptrade/callback/route.ts:83-101` — auth listing + existingMap pattern
- `src/app/api/broker/disconnect/route.ts:83-87` — `removeBrokerageAuthorization()` call
- `src/lib/snaptrade.ts` — SDK client

**UI:** Add a "Clean up stale connections" button on the connect page (`src/app/(dashboard)/dashboard/connect/connect-client.tsx`) that calls POST and shows the result count via toast.

---

## Task 2: Pre-flight connection count check

**Modify:** `src/app/api/snaptrade/connect/route.ts`

**Problem:** Connect endpoint calls `loginSnapTradeUser()` without checking authorization count. FM completes full OAuth flow then sees "Connection Limit Reached" at SnapTrade.

**Fix:** Before `loginSnapTradeUser()` (currently at line ~27):
1. Call `listBrokerageAuthorizations()` to count existing authorizations
2. If count >= 5, return `{ error: "connection limit reached — disconnect a broker or clean up stale connections", limit: 5, current: count }` with status 429
3. Connect page already reads `error` from response and displays it — no UI change needed

---

## Task 3: Surface disconnect revocation failures

**Modify:** `src/app/api/broker/disconnect/route.ts` + `src/app/api/broker/connections/[id]/route.ts`

**Problem:** `removeBrokerageAuthorization()` failures are caught and swallowed (console.warn only). FM sees "disconnected" but SnapTrade still counts the authorization.

**Fix:** If upstream revocation fails:
- Still soft-delete locally (FM shouldn't be stuck)
- Track `revocationFailed` boolean, return `{ ok: true, warning: "disconnected locally but broker-side cleanup failed — use the cleanup tool if you hit connection limits" }` when true
- `BrokerConnectionCard` (`src/components/connect/broker-connection-card.tsx`) reads `warning` from response body and shows it via toast

---

## Task 4: P&L / cost basis tracking

**Problem:** SnapTrade provides `average_purchase_price` on every Position object from `getUserHoldings()`, but `sync-connection.ts` ignores it entirely (lines 142-167). Our `positions` table already has `entry_price` (decimal, schema.sql line 88) and `gain_loss_pct` (decimal, line 90) columns — both empty for broker positions.

**Modify:** `src/lib/sync-connection.ts`

**Step 1 — Capture `average_purchase_price` during sync:**

In the `LiveHolding` interface (line 48), add `entry_price: number | null`.

In the SnapTrade holdings loop (line 142-167), extract:
```typescript
const entryPrice = (pos as { average_purchase_price?: number }).average_purchase_price ?? null;
```

When aggregating same-ticker across accounts (the `existing` branch at line 153), weight-average the entry price:
```typescript
// Weighted-average entry price across accounts
if (existing.entry_price != null && entryPrice != null && (existing.shares ?? 0) + shares > 0) {
  existing.entry_price =
    (existing.entry_price * (existing.shares ?? 0) + entryPrice * shares) /
    ((existing.shares ?? 0) + shares);
} else {
  // One or both accounts didn't report — use whichever is known
  existing.entry_price = existing.entry_price ?? entryPrice;
}
```

Null handling rules:
- If one account returns null and another returns a value → use the known value (don't treat null as 0)
- If running shares is 0 → skip the division, use the new entryPrice directly
- If both are null → stays null

**Step 2 — Persist + compute gain/loss:**

Expand the `existingByTicker` SELECT (line 256) to include `entry_price` and `current_price`:
```typescript
.select("id, ticker, portfolio_id, shares, entry_price, current_price")
```

And expand the Map type accordingly so these values are available for UPDATE fallback and sell fanout.

In `applySync()` UPDATE branch (line 286-294), use explicit fallback so SnapTrade omitting `average_purchase_price` on a sync round doesn't overwrite a previously-stored value:
```typescript
const resolvedEntry = h.entry_price ?? found.entry_price ?? null;
const resolvedPrice = h.current_price ?? found.current_price ?? null;

await admin.from("positions").update({
  shares: h.shares,
  current_price: h.current_price,
  market_value: h.market_value,
  name: h.name || undefined,
  entry_price: resolvedEntry,
  gain_loss_pct: resolvedEntry && resolvedPrice
    ? ((resolvedPrice - resolvedEntry) / resolvedEntry) * 100
    : null,
  last_synced: now,
}).eq("id", found.id);
```

In `applySync()` INSERT branch (line 297-307):
```typescript
entry_price: h.entry_price,
gain_loss_pct: h.entry_price && h.current_price
  ? ((h.current_price - h.entry_price) / h.entry_price) * 100
  : null,
```

**Step 3 — Display P&L on positions page and trade page:**

In `positions-client.tsx` pool rows: show entry price and gain/loss percentage alongside existing market value + gain/loss color tinting (already there from Sprint 16).

**No migration needed** — `entry_price` and `gain_loss_pct` columns already exist in schema. Data fills on next sync.

---

## Task 5: Enhanced sell notifications

**Problem:** When a position is sold (detected by sync or unassigned by FM), the sell notification only says "sold AAPL" or "sold AAPL · $189.50". Doplers want to know the buy price, sell price, and P&L.

**Modify:** `src/lib/notification-fanout.ts` + `src/lib/sync-connection.ts` + `src/app/api/positions/assign/route.ts`

**Step 1 — Extend `FanoutChange` sell type** (line 20):
```typescript
{ type: "sell"; ticker: string; prevShares: number; price?: number;
  buy_price?: number; realized_pnl_pct?: number }
```

**Step 2 — Enrich `describeOneChange`** (line 284-310):

Current sell: `"sold AAPL · $189.50"`
Enhanced sell: `"sold AAPL · $189.50 · bought at $142.30 · +33.1% P&L"`

Only show buy_price and P&L when values are available (graceful degradation for positions without cost basis).

**Step 3 — Pass cost basis + sell price into BOTH sell fanout sites:**

The enhanced sell body `"sold AAPL · $189.50 · bought at $142.30 · +33.1% P&L"` needs three values: `price` (sell price = last known current_price), `buy_price` (= entry_price), `realized_pnl_pct`.

**Site 1 — `sync-connection.ts` sold detection (lines 314-337):**
The `existingByTicker` Map now carries `entry_price` and `current_price` (from Step 2). Before deleting the position, compute and pass:
```typescript
changes: [{
  type: "sell",
  ticker: prev.ticker,
  prevShares: Number(prev.shares) || 0,
  price: prev.current_price != null ? Number(prev.current_price) : undefined,
  buy_price: prev.entry_price != null ? Number(prev.entry_price) : undefined,
  realized_pnl_pct: prev.entry_price && prev.current_price
    ? ((Number(prev.current_price) - Number(prev.entry_price)) / Number(prev.entry_price)) * 100
    : undefined,
}]
```

**Site 2 — `positions/assign/route.ts` DELETE handler (lines 307-389):**
Expand the positions SELECT (line 307-312) to include `current_price` and `entry_price`:
```typescript
.select("id, ticker, shares, portfolio_id, broker_connection_id, current_price, entry_price, portfolios(fund_manager_id)")
```
Then pass the same three fields into the sell fanout change (lines 377-389).

**Step 4 — Store in notification meta** (JSONB, no migration):

Add `buy_price` and `realized_pnl_pct` to the meta object (line 152-159) alongside existing `price`, `shares`, `prev_shares`. Notification display components can read these for richer rendering.

---

## Task 6: Unified "Trade" page

**Problem:** Portfolios and positions are on separate pages. FM has to navigate back and forth to assign positions. The team wants a single "Trade" screen with portfolios on the left and the position pool on the right.

**Create:** `src/app/(dashboard)/dashboard/trade/page.tsx` + `trade-client.tsx`

**Layout:**
- **Desktop:** Two-pane. Left = portfolio list (reuse `expandable-portfolio-card.tsx` cards). Right = position pool grouped by broker connection (reuse pool rendering from `positions-client.tsx`).
- **Mobile:** Tab bar at top — "Portfolios" | "Pool" — switching between the two panes. Simple `<button>` pair with underline indicator, no library.
- Pool shows unassigned positions grouped by broker connection with summary stats (count, total value per broker section).
- Portfolios show expandable cards with the existing donut chart + positions table.

**Modify sidebar:** `src/app/(dashboard)/dashboard-chrome.tsx` lines 26-35

Insert `{ href: "/dashboard/trade", icon: ArrowLeftRight, label: "trade" }` as second item (right after overview). Keep existing "portfolios" and "positions" links — they remain useful as focused views. Import `ArrowLeftRight` from `lucide-react`.

Updated sidebar order: overview → **trade** → portfolios → positions → doplers → broker → billing → profile → share.

**Pre-step — extract PoolSection into shared module:**

The pool rendering (PoolSection function, `formatMoney` helper, broker-grouping `useMemo`s, batch-assign controls) is currently embedded inside `positions-client.tsx` — not exported. Before the trade page can reuse it, extract into `src/components/positions/pool-pane.tsx`:
- Export `PoolPane` component (the pool side with broker grouping, summary stats, batch assign)
- Export `formatMoney` helper
- Both `/dashboard/positions` and `/dashboard/trade` import from the shared module
- No logic changes — pure extraction

**Existing code to compose from:**
- `src/app/(dashboard)/dashboard/portfolios/expandable-portfolio-card.tsx` — portfolio cards with donut charts, positions table, actions (already a clean reusable component)
- `src/components/positions/pool-pane.tsx` — **extracted** pool section (see pre-step above)
- `/api/positions/assign` POST/DELETE — assign/unassign API (already built, Sprint 15)

**Key behavior:**
- Assign: select pool positions → pick target portfolio → POST `/api/positions/assign` with `position_ids`
- Unassign: click remove on a portfolio position → DELETE `/api/positions/assign` → position returns to pool
- Both panes refresh after mutations (optimistic UI or refetch)

---

## Task 7: Portfolio sorting + custom order

**Problem:** Portfolios currently render in creation order. FM wants to reorder them.

**Migration 008:** `supabase/migrations/008_portfolio_display_order.sql`
```sql
ALTER TABLE public.portfolios
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;
```
Idempotent (`IF NOT EXISTS`). `NOT NULL DEFAULT 0` tightens the constraint — column always sorts, never null. `DEFAULT 0` backfills all existing rows; no separate UPDATE needed.

**Create sort dropdown** on Trade page and portfolios page (`src/app/(dashboard)/dashboard/portfolios/portfolios-client.tsx`):

Four standard client-side sorts:
1. **Date created** (default) — `created_at` ASC
2. **Market value** — sum of position market_values DESC
3. **Position count** — number of assigned positions DESC
4. **Subscriber count** — `subscriber_count` DESC

Plus a **"Custom order"** toggle that:
- Enables drag-to-reorder on the portfolio list (see Task 8)
- Persists order via `display_order` column
- When active, sorts by `display_order ASC, created_at ASC` — the `created_at` tiebreaker ensures stable sort when all portfolios start at display_order = 0

**New-portfolio behavior:** When creating a portfolio (POST `/api/portfolios`), set `display_order = max(existing display_order for this FM) + 1`. This ensures new portfolios appear at the end of custom order, not before existing ones.

UI: small dropdown (`<select>` or custom dropdown) above portfolio list. When "Custom order" is selected, a grip handle appears on each portfolio card.

---

## Task 8: Drag and drop

**Two DnD use cases:**

### 8a: Portfolio reordering (custom order mode)

When sort = "Custom order", portfolio cards become draggable. Reordering updates `display_order` on all affected portfolios via a single PATCH endpoint.

**Create:** `src/app/api/portfolios/reorder/route.ts`
- PATCH — body: `{ order: [{ id, display_order }] }`
- Ownership check on all portfolio IDs
- Batch update `display_order`

### 8b: Position-to-portfolio assignment via drag (desktop only)

On the Trade page (Task 6), pool positions can be dragged onto a portfolio card to assign them. This calls the existing POST `/api/positions/assign` with `{ position_ids: [id], portfolio_id }`.

- Desktop only — on mobile, keep the existing select + "Assign" button flow
- Drop target: the portfolio card header area (not the expanded positions table)
- Visual feedback: highlight the portfolio card border on drag-over

**Library:** `@hello-pangea/dnd` — MIT, maintained fork of `react-beautiful-dnd`, supports React 19. Alternatives considered: `@dnd-kit/core` (more flexible but heavier API surface for simple list reorder + cross-list drag).

**Scope guard:** DnD is a desktop enhancement. Touch/mobile keeps the current select-and-assign pattern. If `@hello-pangea/dnd` creates bundle or React 19 issues, fall back to button-only reorder (up/down arrows) for 8a and skip 8b entirely.

---

## Task ordering + dependencies

```
Task 1 ─┐
Task 2 ─┤ (independent — SnapTrade cleanup)
Task 3 ─┘
Task 4 ──→ Task 5 (P&L feeds into sell notifications)
Task 6 ──→ Task 7 ──→ Task 8 (trade page → sorting → DnD on top)
```

Tasks 1-3 and Tasks 4-5 can be built in parallel. Task 6 can start alongside 4-5 since it composes existing components. Tasks 7-8 layer on top of Task 6.

---

## Files modified (summary)

| File | Tasks | Change |
|------|-------|--------|
| `src/app/api/snaptrade/cleanup/route.ts` | 1 | NEW — cleanup endpoint (with self-heal) |
| `src/app/api/snaptrade/connect/route.ts` | 2 | Add pre-flight auth count check |
| `src/app/api/broker/disconnect/route.ts` | 3 | Surface revocation failure as warning |
| `src/app/api/broker/connections/[id]/route.ts` | 3 | Surface revocation failure as warning |
| `src/lib/sync-connection.ts` | 4, 5 | Wire `average_purchase_price` → `entry_price`, compute `gain_loss_pct`, expand existingByTicker SELECT, pass cost basis + sell price into sell fanout |
| `src/lib/notification-fanout.ts` | 5 | Extend sell `FanoutChange` with `buy_price` + `realized_pnl_pct`, enrich `describeOneChange` |
| `src/app/api/positions/assign/route.ts` | 5 | Expand DELETE SELECT with `current_price` + `entry_price`, pass into sell fanout |
| `src/components/positions/pool-pane.tsx` | 6 | NEW — extracted PoolPane + formatMoney from positions-client |
| `src/app/(dashboard)/dashboard/positions/positions-client.tsx` | 4, 6 | Show entry price + gain/loss on pool rows; import PoolPane from shared module |
| `src/app/(dashboard)/dashboard/trade/page.tsx` | 6 | NEW — Trade page server component |
| `src/app/(dashboard)/dashboard/trade/trade-client.tsx` | 6, 7, 8 | NEW — Two-pane layout + mobile tabs + sort dropdown + DnD |
| `src/app/(dashboard)/dashboard-chrome.tsx` | 6 | Add "trade" nav item after overview |
| `src/app/(dashboard)/dashboard/portfolios/portfolios-client.tsx` | 7 | Add sort dropdown (same as trade page) |
| `src/app/api/portfolios/route.ts` | 7 | Set `display_order = max(existing) + 1` on POST |
| `src/app/api/portfolios/reorder/route.ts` | 8a | NEW — PATCH reorder endpoint |
| `supabase/migrations/008_portfolio_display_order.sql` | 7 | NEW — add `display_order` column (NOT NULL DEFAULT 0, IF NOT EXISTS) |
| `src/app/(dashboard)/dashboard/connect/connect-client.tsx` | 1 | Add cleanup button UI |
| `src/components/connect/broker-connection-card.tsx` | 3 | Surface disconnect warning via toast |

---

## Manual smoke (run on `dopl-app.vercel.app` after merge + deploy)

**From Sprint 15 (blocked by connection limit — unblocked by Tasks 1-3):**
- Disconnect a broker → positions stay in pool, connect page shows "Add Broker"
- Connect a second broker → two cards on connect page
- Sync one broker card → only that broker's positions sync
- Disconnect one broker → the other stays connected

**From Sprint 16:**
1. Toast appears bottom-right, no overlap with buttons
2. Mobile discover → scroll to bottom → cards don't overlap bottom nav
3. Positions page → three summary stat pills visible
4. "In Portfolios" → portfolio headers show tier badge + total market value
5. Pool → broker sections show total market value
6. Delete a portfolio → positions return to pool immediately
7. Manual position survives portfolio deletion
8. Portfolios page → VALUE column with dollar amounts

**Sprint 17 new:**
1. Clean up stale connections → slot count decreases → "Add Broker" works
2. Connect new broker → no "Connection Limit" error (pre-flight check works)
3. Disconnect broker → if upstream fails, warning toast shown (not silent success)
4. Sync positions → entry price and P&L % appear on pool rows
5. Sell/unassign a position → notification shows buy price + P&L
6. Trade page → desktop: portfolios left, pool right
7. Trade page → mobile: Portfolios/Pool tabs, tap to switch
8. Assign position from pool to portfolio on trade page → position moves
9. Sort portfolios by value → highest value first
10. Sort by custom order → drag to reorder → order persists after refresh
11. Drag pool position onto portfolio card (desktop) → assigns it

---

## Verification

**Automated (Instance 3):**
- `npm test` — all existing tests pass
- `npm run build` — clean
- Add tests for: cleanup endpoint, pre-flight check, `gain_loss_pct` computation, reorder endpoint

**Manual (Surfer on `dopl-app.vercel.app` after merge + deploy):**
- Migration 008 pasted into Supabase SQL editor before smoke
- Full smoke checklist above (Sprint 15 + 16 catchup + Sprint 17 new)

---

## Hotfix Round 1 — Post-smoke fixes (2026-05-07)

**Branch:** `fix/sprint-17-hotfix-r1`

Smoke results: Tasks 1-8 functionally correct. Three UX issues surfaced:

### Task 9: Pie chart padding fix

**Problem:** Donut chart in expandable-portfolio-card has `paddingAngle={2}` which creates thick dark gaps between slices, making the chart look skewed and ugly.

**File:** `src/app/(dashboard)/dashboard/portfolios/expandable-portfolio-card.tsx` line 344

**Fix:** Change `paddingAngle={2}` → `paddingAngle={0.5}`. This keeps a hairline gap between slices (enough to distinguish them) without the visual distortion.

---

### Task 10: Custom order UX — position numbers + larger arrows

**Problem:** When sort mode is "custom order", up/down arrows appear beside each portfolio card but there's no visible position number, no text labels, and the purpose is not immediately clear. Surfer described it as "very confusing."

**Files:**
- `src/components/portfolios/portfolio-sort.tsx` — `PortfolioReorderArrows` component (lines 178-214)
- `src/app/(dashboard)/dashboard/trade/trade-client.tsx` — arrows rendering (lines 296-306)
- `src/app/(dashboard)/dashboard/portfolios/portfolios-client.tsx` — same arrows rendering

**Fix:**
1. Add a **position number badge** between the up and down arrows (e.g., "1", "2", "3") — renders in a small circular badge. This immediately communicates "this card is #2 in the list" and makes the arrows' purpose obvious.
2. Extend `PortfolioReorderArrows` props with `position: number` and render the badge between arrows.
3. Pass `idx + 1` from both trade-client and portfolios-client where arrows are rendered.

Updated `PortfolioReorderArrows` layout:
```
  [▲]
  (2)    ← position number badge
  [▼]
```

---

### Task 11: Assign — optimistic position removal from pool

**Problem:** Assigning a position from pool to a portfolio takes 2-3 seconds to visually reflect because the only feedback is a full `router.refresh()` round-trip. FM clicks "assign" and nothing happens for several seconds.

**Files:**
- `src/components/positions/pool-pane.tsx` — the batch assign handler

**Fix:** After the fetch to `/api/positions/assign` returns successfully but BEFORE calling `router.refresh()`:
1. Add an `assigning` loading state to the assign button (show spinner + "assigning..." text).
2. On success, immediately hide the assigned positions from the pool list via local state filter (optimistic removal) and THEN call `onChanged()` → `router.refresh()` for the authoritative server state.
3. The pool positions are controlled by the parent via props, so the optimistic approach is: maintain a `Set<string>` of `hiddenIds` in PoolPane state. After successful assign, add the assigned IDs to `hiddenIds`. Filter them out of the rendered list. When `pool` prop changes (server refresh arrives), clear `hiddenIds`.

This makes the assign feel instant — position disappears from pool right away, spinner on the button during the API call, then server state catches up.

---

### Hotfix file summary

| File | Task | Change |
|------|------|--------|
| `expandable-portfolio-card.tsx` | 9 | `paddingAngle={2}` → `paddingAngle={0.5}` |
| `portfolio-sort.tsx` | 10 | Add position number badge to arrows |
| `trade-client.tsx` | 10 | Pass position index to arrows |
| `portfolios-client.tsx` | 10 | Pass position index to arrows |
| `pool-pane.tsx` | 11 | Optimistic removal + assign loading state |

### Hotfix smoke (on `dopl-app.vercel.app`)

1. Portfolio donut chart → slices have thin hairline gap, no thick dark wedges
2. Custom order → each portfolio card shows a position number (1, 2, 3) between arrows
3. Reorder arrows → number updates immediately when you move a card up/down
4. Assign position from pool → button shows spinner, position disappears from pool within ~0.5s, portfolio refreshes with the new position
