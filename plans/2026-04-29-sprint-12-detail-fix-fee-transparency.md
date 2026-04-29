**Status:** under-review

# Sprint 12: Portfolio Detail Fix + Fee Transparency

## Context

Two items deferred from Sprint 10/11 smoke:

1. **"View full portfolio" link redirects back to /feed.** The user confirmed on the web version: clicking the link navigates to `/feed/{portfolio_id}` then immediately snaps back to `/feed`. Root cause identified: the detail page query uses `fund_managers!inner` (INNER JOIN) — if the FM join fails for any reason, the portfolio row returns null and `redirect("/feed")` fires. The feed list page doesn't have this problem because it queries FMs separately via `resolveFm()` with graceful fallbacks.

2. **Doplers see zero information about the fee split.** dopl takes 10% of every subscription via Stripe Connect (`DOPL_FEE_PERCENT = 10` in `src/lib/stripe.ts`). FMs see "dopl takes 10%, you keep 90%" in their billing dashboard. Doplers see only the total price — no breakdown at any point in the subscription flow.

No DB changes, no new API routes, no new dependencies.

---

## Task 1: Fix Portfolio Detail Redirect

**Root cause:** `src/app/feed/[portfolioId]/page.tsx` line 32 uses `fund_managers!inner` which performs an INNER JOIN. If the fund_manager row is missing, FK is broken, or any selected column doesn't exist, the entire portfolio row returns `null`. The `if (!portfolio) redirect("/feed")` on line 40 then fires silently — the Supabase `error` field is not checked.

The feed page (`src/app/feed/page.tsx`) avoids this by querying fund_managers separately (lines 88-95) and resolving via `resolveFm()` from `src/lib/fm-resolver.ts`, which returns fallback values for every field.

### Changes

**File 1: `src/app/feed/[portfolioId]/page.tsx`**

1. Remove `!inner` from the select — changes INNER JOIN to LEFT JOIN:
   ```
   Before: "*, fund_manager:fund_managers!inner(handle, display_name, ...)"
   After:  "*, fund_manager:fund_managers(handle, display_name, ...)"
   ```
   Portfolio row always returns. `fund_manager` will be `null` if join fails.

2. Capture and log the `error` field:
   ```tsx
   const { data: portfolio, error: portfolioErr } = await admin...
   if (portfolioErr) console.error("[portfolio-detail] lookup failed:", portfolioErr);
   ```
   Keep the existing `if (!portfolio) redirect("/feed")` after — genuine missing portfolios should still redirect.

**File 2: `src/app/feed/[portfolioId]/portfolio-detail-client.tsx`**

With the LEFT JOIN, `portfolio.fund_manager` can now be `null`. Use `resolveFm()` for consistent handling:

1. Import `resolveFm` from `@/lib/fm-resolver`

2. Replace line 49 `const fm = portfolio.fund_manager` with:
   ```tsx
   const fm = resolveFm(portfolio.fund_manager, null, portfolio.fund_manager_id);
   ```
   This gives a `ResolvedFm` with guaranteed `display_name` (falls back to "unknown"), nullable `handle` and `avatar_url`.

3. Guard the FM profile Link (line 147-148) — `handle` can be `null` after resolve:
   ```tsx
   // If handle exists → Link to /{handle}
   // If null → plain div (same markup, not clickable)
   ```

All other `fm.*` accesses are already safe: `fm.display_name` guaranteed non-null by `resolveFm`, `fm.avatar_url` uses conditional rendering, `fm.display_name?.[0]` already has optional chaining.

**Exit criteria:** Clicking "view full portfolio →" in the feed navigates to the detail page and renders it (no redirect back). If FM data is missing, the page still renders with fallback display name.

**Depends on:** None

---

## Task 2: Fee Split Transparency

### Step 1 — Extract `DOPL_FEE_PERCENT` to a shared module

`src/lib/stripe.ts` imports the server-only `Stripe` SDK, so client components can't import from it. Extract the constant:

**Create: `src/lib/constants.ts`**
```ts
export const DOPL_FEE_PERCENT = 10;
```

**Modify: `src/lib/stripe.ts`** — replace line 17 `export const DOPL_FEE_PERCENT = 10;` with:
```ts
export { DOPL_FEE_PERCENT } from "./constants";
```
Non-breaking — all existing `import { DOPL_FEE_PERCENT } from "@/lib/stripe"` continue to work (including the test at `src/lib/__tests__/stripe.test.ts`).

### Step 2 — Add disclosure on portfolio detail page

**Modify: `src/app/feed/[portfolioId]/portfolio-detail-client.tsx`**

Import `DOPL_FEE_PERCENT` from `@/lib/constants`.

One location — **price display only** (after line 189 `$X/mo` span). The subscribe CTA stays clean (no fee info at the conversion point):
```tsx
{portfolio.price_cents > 0 && (
  <p className="text-[10px] text-[color:var(--dopl-cream)]/30 font-mono mt-1">
    includes {DOPL_FEE_PERCENT}% platform fee
  </p>
)}
```

### Step 3 — Add disclosure on profile tier cards

**Modify: `src/app/[handle]/profile-tiers.tsx`**

Import `DOPL_FEE_PERCENT` from `@/lib/constants`.

After line 264-266 (`/month` text), add for paid tiers:
```tsx
<p className="text-[10px] text-[color:var(--dopl-cream)]/25 font-mono mt-0.5">
  includes {DOPL_FEE_PERCENT}% platform fee
</p>
```

### Step 4 (optional) — Fix hardcoded 0.9 in billing

**Modify: `src/app/(dashboard)/dashboard/billing/billing-client.tsx`**

Line 49 uses hardcoded `0.9` for the FM cut calculation. Update to use `DOPL_FEE_PERCENT` from `@/lib/constants` for consistency. Also update the prose on line 68 to reference the constant.

**Exit criteria:** Paid portfolios show "includes 10% platform fee" on both the detail page price display and the profile tier cards. Free portfolios show no fee disclosure. Subscribe CTA is clean. FM billing dashboard uses the shared constant.

**Depends on:** None (independent of Task 1)

---

## Task Dependency Graph

```
Task 1 (detail page fix) — independent
Task 2 (fee transparency)  — independent
```

Both are independent. Recommended order: Task 1 first (bug fix, smaller), then Task 2.

---

## Files Summary

**Create (1):**
- `src/lib/constants.ts` — shared `DOPL_FEE_PERCENT` constant

**Modify (5):**
- `src/app/feed/[portfolioId]/page.tsx` — remove `!inner`, add error logging
- `src/app/feed/[portfolioId]/portfolio-detail-client.tsx` — null FM handling via `resolveFm()`, fee disclosure
- `src/app/[handle]/profile-tiers.tsx` — fee disclosure on tier cards
- `src/lib/stripe.ts` — re-export constant from `constants.ts`
- `src/app/(dashboard)/dashboard/billing/billing-client.tsx` — use constant instead of hardcoded 0.9

**Unchanged but relevant:**
- `src/lib/fm-resolver.ts` — existing `resolveFm()` used as-is
- `src/lib/__tests__/stripe.test.ts` — re-export is transparent, test passes unchanged

---

## Verification

### Automated
- `npm test` — all existing tests pass (re-export doesn't break stripe test)
- `npm run build` — clean build

### Manual Smoke (Surfer on prod after merge)

1. Go to /feed → tap "view full portfolio →" on any card → detail page loads (not redirect back to /feed)
2. Detail page shows: FM info, positions grid, activity feed, "← back to feed" link
3. On the detail page, price area shows "includes 10% platform fee" below the price for paid portfolios
4. Subscribe CTA is clean — no fee info, just the SlideToDopl
5. Go to a fund manager's profile (/@handle) → tier cards show "includes 10% platform fee" below /month
6. Free portfolios don't show any fee disclosure
7. FM billing dashboard still shows correct "your cut" and "dopl takes 10%" text
