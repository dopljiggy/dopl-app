**Status:** implemented

# Sprint 13: FM Doplers Page + Investment Calculator + Polish

## Context

Sprint 12 wrapped the portfolio detail fix and fee transparency. The persistent `avatar_url` schema drift (column in `schema.sql` but never migrated) cost 4+ fix attempts. This sprint starts with a schema audit to prevent recurrence, then builds the two biggest remaining features: an FM-facing doplers page and a dopler-facing investment calculator. Profile/tier visual polish and CSV export round it out. Stripe E2E is a manual smoke — no code changes needed, just the checklist.

No new dependencies. One migration (schema audit cleanup). Two new pages. One new shared utility.

---

## Task 1: Schema Audit — DB vs schema.sql sync

**Why:** The `avatar_url` bug proved schema.sql can drift from the actual database. Prevent future surprises by reconciling now.

**Known drift:**
- `fund_managers.avatar_url` — exists in live DB (manually ALTERed), missing from `schema.sql` base CREATE
- `profiles.trading_provider`, `profiles.trading_connected`, `profiles.trading_connection_data` — exist in `schema.sql` (line 202-204) but the dopler trading feature was removed in Sprint 8. Dead columns in both schema and DB.
- `004_fm_activity_types.sql` added `notifications.event_type`, `notifications.metadata`, `notifications.event_source`, `notifications.related_id` — verify these are in the base CREATE or documented as migrations

### Changes

**File: `supabase/schema.sql`**
1. Add `avatar_url text` to `fund_managers` CREATE TABLE (after `bio`)
2. Remove the 3 dopler trading ALTER TABLEs (lines 202-204) — these columns were removed from the codebase in Sprint 8
3. Verify `notifications` base CREATE includes columns from migration 004

**File: `supabase/migrations/005_schema_audit.sql`** (new)
```sql
-- Reconcile schema drift found in Sprint 13 audit
-- avatar_url already exists in live DB (manually added 2026-04-30)
-- This migration is idempotent (IF NOT EXISTS) for safety
ALTER TABLE public.fund_managers ADD COLUMN IF NOT EXISTS avatar_url text;

-- Clean up dead dopler trading columns (feature removed Sprint 8, confirmed by Surfer)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS trading_provider;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS trading_connected;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS trading_connection_data;
```

**Migration delivery:** Surfer pastes SQL into Supabase editor. The `avatar_url` ADD is a no-op (already exists). The 3 DROP columns remove dead dopler trading fields (confirmed safe to drop).

**Depends on:** Nothing

---

## Task 2: FM Doplers Page

**What:** New dashboard page showing every dopler who subscribes to the FM's portfolios. Summary stat cards + sortable data table + CSV export.

### Data available

From `subscriptions` table (joined with `profiles` and `portfolios`):
- `profiles.full_name`, `profiles.email` — dopler identity
- `portfolios.name`, `portfolios.tier` — which portfolio
- `subscriptions.status` — active / cancelled
- `subscriptions.price_cents` — monthly price
- `subscriptions.created_at` — join date
- `subscriptions.cancelled_at` — churn date (if cancelled)

### Summary Stats (4 cards, matching dashboard overview style)

| Stat | Source |
|------|--------|
| total doplers | COUNT(DISTINCT user_id) |
| active | COUNT(*) WHERE status='active' |
| revenue/mo | SUM(price_cents) WHERE status='active', display as $ |
| churn (30d) | COUNT(*) WHERE status='cancelled' AND cancelled_at > now()-30d |

### Data Table Columns

| Column | Source | Notes |
|--------|--------|-------|
| dopler | full_name + email | Two-line cell |
| portfolio | portfolios.name | |
| tier | portfolios.tier | Badge styled per tier |
| status | subscriptions.status | Green "active" / gray "cancelled" badge |
| price | price_cents | $/mo |
| joined | created_at | Relative date |

### Changes

**File: `src/app/(dashboard)/dashboard/doplers/page.tsx`** (new — server component)
- Auth check via `getCachedUser()`
- Use cookie-bound `supabase` from `getCachedUser()` — NOT admin. RLS already covers both tables: profiles are publicly readable (`for select using (true)`), and subscriptions have `auth.uid() = fund_manager_id` policy for FM access.
- Query: `supabase.from("subscriptions").select("*, profile:profiles(full_name, email), portfolio:portfolios(name, tier)").eq("fund_manager_id", user.id).order("created_at", { ascending: false })`
- Compute summary stats server-side
- Pass to client component

**File: `src/app/(dashboard)/dashboard/doplers/doplers-client.tsx`** (new — client component)
- Summary stat cards (reuse `GlassCard` from `@/components/ui/glass-card`)
- Data table — custom HTML table matching existing `PositionTable` pattern in `feed-sections.tsx`
- Tier badges — same styling as `profile-tiers.tsx` (lines 133-144)
- Status badges — green/gray pill
- CSV export button (top-right) — client-side blob download (see Task 4 for shared utility)
- Empty state if no subscribers

**File: `src/app/(dashboard)/dashboard-chrome.tsx`** — add "doplers" to `sideNav` array
```ts
{ href: "/dashboard/doplers", icon: Users, label: "doplers" },
```
Insert after "positions" (index 3), before "broker". `Users` icon already imported from lucide-react.

**Depends on:** Task 4 (CSV utility shared with positions export). Can be built in parallel — just import the utility once both are done.

---

## Task 3: Dopler Investment Calculator

**What:** A calculator that shows doplers "if I put $X into my broker for this portfolio, here's exactly what to buy to mirror it." Available at **two stages**:

1. **Pre-dopl** (profile tier cards) — visible when positions are already visible (free tiers, or tiers the dopler is already subscribed to). Helps the dopler decide whether to dopl.
2. **Post-dopl** (portfolio detail page) — visible while the dopler is actively subscribed. Primary location with full breakdown.

When unsubscribed from a paid tier, calculator is not shown (positions are locked anyway). Pure client-side math, no API, no regulatory concern — it's a reference calculator, not a trade instruction.

**Example:** Dopler enters $10,000. Position AAPL has 30% allocation → shows "$3,000 in AAPL (≈12.5 shares at $240)".

### Changes

**File: `src/components/ui/investment-calculator.tsx`** (new — shared client component)

Extracted as a reusable component since it appears in two places:

```tsx
type CalcPosition = {
  ticker: string;
  name: string | null;
  allocation_pct: number | null;
  current_price: number | null;
};

export function InvestmentCalculator({ positions }: { positions: CalcPosition[] }) { ... }
```

Components:
1. **Input:** Dollar amount field with `$` prefix, placeholder "enter your amount"
2. **Breakdown table:** Only renders when amount > 0. Columns: ticker, allocation %, your allocation ($), estimated shares (amount × allocation% / current_price)
3. **Disclaimer:** `"for reference only — dopl does not execute trades"` in muted text

State: single `useState<number | null>(null)` for the dollar amount. Computation is inline map over positions.

**File: `src/app/feed/[portfolioId]/portfolio-detail-client.tsx`**

Import and render `<InvestmentCalculator>` below the positions table. Guard: only render when `canView` is true and `positions.length > 0`.

**File: `src/app/[handle]/profile-tiers.tsx`**

For tiers where `can_view` is true and `positions.length > 0`, add a collapsible "calculate your allocation" section below the positions preview. Uses the same `<InvestmentCalculator>` component. Collapses by default — tap to expand — keeps the tier card clean.

**Depends on:** Nothing

---

## Task 4: CSV Export Utility + Positions Export

**What:** Shared CSV generation utility. Used by both the doplers page (Task 2) and the FM positions dashboard.

### Changes

**File: `src/lib/csv.ts`** (new)
```ts
type CellValue = string | number | null | undefined;

export function downloadCsv(filename: string, headers: string[], rows: CellValue[][]) {
  const escape = (v: CellValue) => {
    const s = String(v ?? "").replace(/[\r\n]+/g, " ");
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines = [headers.map(escape).join(",")];
  for (const row of rows) lines.push(row.map(escape).join(","));
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

**File: `src/app/(dashboard)/dashboard/positions/positions-client.tsx`**
- Import `downloadCsv` from `@/lib/csv`
- Add "export CSV" button in the header area (next to the sync button)
- Columns: ticker, name, portfolio, shares, price, market value, allocation %, gain/loss %
- Filename: `dopl-positions-YYYY-MM-DD.csv`

**Depends on:** Nothing

---

## Task 5: Profile Card + Tier Badge Polish

### Profile Card (`src/app/[handle]/profile-hero.tsx`)

Improvements inspired by Netlify preview — subtle, no structural changes:

1. **Subscriber count card:** Add "across N portfolios" subtext (data already passed — count from `tiers` prop on parent page)
2. **Avatar fallback glow:** Make the conic gradient subtler on the letter-fallback state
3. **Handle line:** Add a "copy link" toast confirmation matching the existing `copyLink()` pattern

### Tier Badge (`src/app/[handle]/profile-tiers.tsx`)

Current badges are flat colored spans. Refresh:

1. **Distinct per tier:** free = lime outline + sparkle icon (already has Sparkles), basic = sage fill, premium = gradient border, vip = lime fill + glow
2. **Font weight + letter spacing:** Already `font-mono font-semibold tracking-wider` — just adjust colors per tier

Both are CSS-only changes, no new props or data requirements.

**File: `src/app/[handle]/profile-hero.tsx`** — subtext + avatar glow tweak
**File: `src/app/[handle]/profile-tiers.tsx`** — tier badge class map
**File: `src/app/[handle]/page.tsx`** — pass portfolio count to ProfileHero (1 new prop)

**Depends on:** Nothing

---

## Task Dependency Graph

```
Task 1 (schema audit)         — independent, do first
Task 2 (FM doplers page)      — uses Task 4's CSV utility
Task 3 (investment calculator) — independent
Task 4 (CSV utility + export) — independent, enables Task 2's export
Task 5 (profile/tier polish)  — independent
```

Recommended order: 1 → 4 → 2 → 3 → 5

---

## Files Summary

**Create (5):**
- `supabase/migrations/005_schema_audit.sql` — reconcile DB drift
- `src/app/(dashboard)/dashboard/doplers/page.tsx` — FM doplers server page
- `src/app/(dashboard)/dashboard/doplers/doplers-client.tsx` — doplers table + stats
- `src/lib/csv.ts` — shared CSV download utility
- `src/components/ui/investment-calculator.tsx` — shared calculator component (used on detail page + tier cards)

**Modify (7):**
- `supabase/schema.sql` — add `avatar_url`, remove dead trading columns
- `src/app/(dashboard)/dashboard-chrome.tsx` — add "doplers" nav item
- `src/app/(dashboard)/dashboard/positions/positions-client.tsx` — CSV export button
- `src/app/feed/[portfolioId]/portfolio-detail-client.tsx` — investment calculator section
- `src/app/[handle]/profile-tiers.tsx` — tier badge per-tier styling + collapsible calculator for visible tiers
- `src/app/[handle]/profile-hero.tsx` — subscriber subtext, avatar glow
- `src/app/[handle]/page.tsx` — pass portfolio count to hero

**Reuse (existing):**
- `@/components/ui/glass-card` — stat cards on doplers page
- `@/components/ui/count-up` — animated numbers on stat cards
- `@/lib/fm-resolver` — no changes needed
- PositionTable pattern from `feed-sections.tsx` — reference for table markup

---

## Verification

### Automated
- `npm test` — all existing tests pass (no existing tests broken)
- `npm run build` — clean build, no type errors

### Manual Smoke (Surfer on prod after merge)

**Schema audit:**
1. Run migration SQL in Supabase editor — all statements succeed (no-ops for existing columns)

**Doplers page:**
2. Log in as FM → sidebar shows "doplers" link between positions and broker
3. Click "doplers" → page loads showing summary stats and subscriber table
4. If no subscribers yet: shows empty state message
5. Click "export CSV" → downloads CSV file with correct columns

**Investment calculator (post-dopl):**
6. Go to /feed → open a subscribed portfolio → scroll below positions
7. Investment calculator section visible with dollar input
8. Enter a dollar amount → breakdown table shows per-ticker allocation ($) and estimated shares
9. Clear the input → breakdown disappears
10. Disclaimer text visible: "for reference only — dopl does not execute trades"

**Investment calculator (pre-dopl on profile):**
11. Visit /@handle → on a free tier card (positions visible), see "calculate your allocation" toggle
12. Tap toggle → calculator expands inline on the tier card
13. Enter an amount → same breakdown as portfolio detail page
14. Paid tier you're NOT subscribed to → no calculator (positions locked)

**Positions CSV:**
15. FM dashboard → positions page → click "export CSV" → downloads file with all assigned positions

**Profile polish:**
16. Visit /@handle page → subscriber count card shows "across N portfolios"
17. Tier badges have distinct styling per tier level (free/basic/premium/vip)

### Stripe E2E Smoke (separate — requires Stripe test mode)

This is a manual verification, no code changes. Surfer runs through after Stripe is configured:

1. FM goes to /dashboard/billing → clicks "set up payments" → Stripe Connect onboarding completes
2. Dopler visits /@handle → slides to dopl a paid tier → Stripe Checkout opens
3. Complete test payment → webhook fires → subscription row created → dopler sees portfolio in /feed
4. Dopler cancels subscription → webhook fires → status flips to cancelled → portfolio removed from /feed
5. FM billing page shows updated MRR and dopler count

---

## Plan Review (Instance 2)

**Reviewed:** 2026-04-30
**Reviewer focus:** Task 2 RLS/admin necessity, Task 3 can_view guards in both calculator locations, Task 4 CSV edge cases, Task 1 trading-column residuals, cross-task dependency ordering

### Verified ✓

1. **Task 1 — Trading column references gone.** `grep -rn "trading_provider\|trading_connected\|trading_connection_data" src --include="*.ts" --include="*.tsx"` returns zero matches. The Sprint 8 removal was thorough; the migration's three uncommented `DROP COLUMN IF EXISTS` statements are safe to run. The `IF EXISTS` guards make the SQL idempotent if the columns were already gone.

2. **Task 3 — Calculator can_view guards are robust.** Verified `src/app/[handle]/page.tsx:152` — `positions: canView ? ps : []` — the positions array is **forced empty** when `can_view` is false. So the plan's `can_view && positions.length > 0` guard is doubly safe: even a hypothetical bug that flipped `can_view` true wouldn't leak data because the array would still be empty. Same robust gate on the detail page where `canView = isOwner || isFree || subscribed` and the calculator only renders for the real `positions` prop (not the blurred placeholder array generated when `!canView`).

3. **Task 4 — Cross-task ordering correct.** Plan's recommended order `1 → 4 → 2 → 3 → 5` puts the CSV utility (Task 4) before the doplers page (Task 2) which imports `downloadCsv`. Build resolution happens at compile time across all committed files, so the order is just for clean per-commit builds — both end states are valid.

4. **Task 4 — Safari URL.createObjectURL.** Supported back to Safari 6.0 (2012). No polyfill needed on any modern target.

### Findings

**Finding 1 — [IMPORTANT] Task 2 doesn't need the admin client**

The plan says: *"Admin client to bypass RLS (FM needs to see subscriber emails — RLS policy on profiles only allows users to see their own)"*. **This claim is incorrect.** Verified directly against `supabase/schema.sql:103-150`:

```sql
-- Profiles: users can read all, update own
create policy "Profiles are viewable by everyone" on public.profiles for select using (true);

-- Subscriptions: user can see own, fund manager can see theirs
create policy "Fund managers can view their subscribers" on public.subscriptions
  for select using (auth.uid() = fund_manager_id);
```

- **Profiles** are **publicly readable** for select (`using (true)`) — any authenticated session can read `full_name` and `email`.
- **Subscriptions** already has an FM-scoped policy that returns rows where `fund_manager_id = auth.uid()`.

So the cookie-bound client from `getCachedUser()` reaches both — no admin needed. The portfolios join in the same query is also fine (active portfolios are publicly readable; the FM owns these so the owner clause kicks in regardless).

**Suggested fix:**
```ts
const { supabase, user } = await getCachedUser();
if (!user) redirect("/login");
const { data: rows } = await supabase
  .from("subscriptions")
  .select("*, profile:profiles(full_name, email), portfolio:portfolios(name, tier)")
  .eq("fund_manager_id", user.id)
  .order("created_at", { ascending: false });
```

**Why this matters:**
- Matches the codebase's prevailing pattern: admin only for cross-cutting reads where RLS forces it (notification fanout traversals, the LEFT JOIN escape hatch on portfolio detail). Owner-scoped reads should use the cookie client.
- Reduces the surface where the service role key is referenced in code paths that don't need it. Defense in depth.
- Avoids future drift: someone reading the doplers page later might assume admin was needed for *something* and propagate the pattern to other FM-scoped reads.

**Update Task 2's "Changes" section:** drop the admin client instantiation, switch the query to `supabase` from `getCachedUser`, and replace the comment about "bypass RLS" with "FM-scoped read via the existing RLS policy on subscriptions".

**Finding 2 — [NIT] Task 4 CSV utility null handling**

```ts
export function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  ...
}
```

Type signature requires `string[][]`, but real callers will pass DB row data where `full_name`, `email`, `name`, etc. are often `string | null`. TypeScript catches this only if the caller is strict — an `as any` somewhere upstream slips it through. At runtime, `null.replace` throws.

**Suggested fix — pick one:**

(a) **Defensive coercion inside the utility** (more robust):
```ts
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][]
) {
  const escape = (v: string | number | null | undefined) =>
    `"${String(v ?? "").replace(/"/g, '""')}"`;
  ...
}
```
Trades a tiny bit of type strictness for caller convenience. Also handles numeric fields (`price_cents`, `gain_loss_pct`) without forcing every caller to `.toString()`.

(b) **Document the contract** (less invasive): Add a sentence to the plan — "callers must coerce nullable fields to '' before passing". Implementer remembers when wiring up Task 2 (doplers) and the positions export.

**Recommendation:** (a). Same line count, eliminates a class of runtime errors, and lets callers pass numbers directly which matches what the doplers/positions tables actually have.

**Finding 3 — [NIT] Task 4 CSV — newlines in values**

`escape` quotes values, which is RFC 4180-correct (newlines inside quoted fields are valid). But Excel and Numbers handle this inconsistently across versions. If FM-facing data ever includes a multi-line note (today's positions don't, but doplers' future profile fields or thesis notes might), some consumers will misparse.

Practical mitigation:
```ts
const escape = (v: string | number | null | undefined) =>
  `"${String(v ?? "").replace(/"/g, '""').replace(/[\r\n]+/g, " ")}"`;
```
Lossy but consistent across all spreadsheet tools. Acceptable for export-to-spreadsheet use cases. Not blocking — flag for the implementer.

### Other observations (no action)

- **Task 5 — `Sparkles` icon already imported** per the plan (`profile-tiers.tsx:11`). ✓
- **Task 2 — `Users` icon for the sidebar.** Plan asserts `Users` is already imported in `dashboard-chrome.tsx`. Worth a quick verify in implementation since `dashboard-chrome.tsx` was just created in Sprint 11; if it isn't imported, just add it to the lucide-react import line. Trivial.
- **Migration delivery via Supabase editor paste** is correct per the team's migrations-flow convention.
- **The 3 `DROP COLUMN` statements are now uncommented** (lines 37-39) — confirmed safe by grep above.

### Verdict: NEEDS REVISION

- **1 important:** Task 2's admin-client justification is wrong; cookie client suffices. Update the plan to use `getCachedUser` for the doplers page query.
- **2 nits:** CSV null/numeric handling and newline escaping — both small, both implementer-facing.

All resolvable with plan edits — no task restructuring. Re-review after Task 2 query approach is corrected.

---

## Plan Review — Round 2 (Instance 2)

**Reviewed:** 2026-04-30
**Round 1 findings:** 1 important, 2 nits

### Round 1 Fix Verification

1. **[IMPORTANT] Task 2 admin client — RESOLVED.** Verified line 86: *"Use cookie-bound `supabase` from `getCachedUser()` — NOT admin. RLS already covers both tables: profiles are publicly readable (`for select using (true)`), and subscriptions have `auth.uid() = fund_manager_id` policy for FM access."* Query at line 87 now reads `supabase.from("subscriptions")...` directly. The reasoning is documented inline so a future maintainer doesn't re-introduce admin out of habit. ✓

2. **[NIT] CSV null/numeric handling — RESOLVED.** Verified lines 164-181:
   - Type alias `CellValue = string | number | null | undefined` (line 164)
   - Signature `rows: CellValue[][]` (line 166)
   - Coercion `String(v ?? "")` inside `escape` (line 168)
   
   Doplers and positions exports can now pass numeric `price_cents`, `gain_loss_pct`, etc. directly without `.toString()`, and DB nulls coerce cleanly to empty strings. ✓

3. **[NIT] CSV newlines — RESOLVED.** Verified line 168: `.replace(/[\r\n]+/g, " ")` runs BEFORE the quote-doubling on line 169 — correct ordering, since multi-line content gets flattened first, then any embedded quotes get escaped. The Excel/Numbers misparse risk is eliminated for any field that might contain a thesis note or multi-line description. ✓

### New Issues Check

No new issues. The escape function ordering is subtle but correct:
1. Coerce to string with null fallback — handles nulls and numbers
2. Replace newlines with spaces — flattens multi-line content
3. Wrap in quotes with internal quotes doubled — RFC 4180 escape

Each transform handles a distinct concern; none interferes with the others.

### Verdict: APPROVED

All 3 Round 1 findings resolved correctly. Plan is ready for Instance 3.

**Implementer notes:**
- Task 2 query: use `supabase` from `getCachedUser()`, not admin. The plan now reflects this.
- Task 4 utility: pass DB rows directly — `null`/`number`/`string` all handled by the type and coercion. No need to pre-stringify in the caller.
- Task 1 migration: paste into Supabase editor; `IF NOT EXISTS` / `IF EXISTS` guards make all 4 statements idempotent. Surfer is the only one who runs this.
- Tasks 1–5 are independent; recommended order is `1 → 4 → 2 → 3 → 5` for cleanest per-commit builds (CSV utility before its caller).
- This is a regular sprint — Surfer merges + pushes manually after Instance 3 hands off, then runs the manual smoke checklist on `dopl-app.vercel.app`.
