**Status:** implemented

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

---

## Plan Review (Instance 2)

**Reviewed:** 2026-04-29
**Reviewer focus:** PostgREST `!inner` semantics, `resolveFm()` signature match, fm.* null safety, stripe re-export test impact, fee disclosure guard

### Verified ✓

1. **PostgREST `!inner` → LEFT JOIN claim correct.** Removing `!inner` from `fund_manager:fund_managers!inner(...)` reverts the embed to PostgREST's default LEFT JOIN behavior — parent rows are returned even when the embedded resource has no match (`fund_manager` becomes `null`). `!inner` is the explicit INNER JOIN modifier; without it, missing FM rows no longer filter out the portfolio. Plan's diagnosis matches PostgREST docs.

2. **`resolveFm()` signature match.** Verified `src/lib/fm-resolver.ts:35-39`:
   ```typescript
   export function resolveFm(
     fm: FmRow | null | undefined,
     profile: ProfileRow | null | undefined,
     id?: string | null
   ): ResolvedFm
   ```
   Plan's call `resolveFm(portfolio.fund_manager, null, portfolio.fund_manager_id)` matches all three arg types. The selected `fund_manager` shape (`{handle, display_name, avatar_url, bio, subscriber_count, stripe_onboarded}`) has extra fields beyond `FmRow` (`bio`, `subscriber_count`, `stripe_onboarded`) — TypeScript accepts since extra properties on a value being passed to a typed parameter are fine (excess-property checking only fires on literal arguments).

3. **fm.* accesses are mostly null-safe after `resolveFm`.** Audited every `fm.*` access in `portfolio-detail-client.tsx`:
   - Line 55, 167, 206 (`fm.display_name`): `display_name` is guaranteed non-null `string` by `resolveFm` ✓
   - Lines 57, 161 (`fm.display_name?.[0]`): optional chain redundant but harmless ✓
   - Line 152, 155 (`fm.avatar_url`): conditional render guards null ✓
   - Line 148 (`<Link href={`/${fm.handle}`}>`): plan adds the guard ✓
   - **Line 170 (`@{fm.handle}`): NOT addressed by the plan** — see Finding 1

4. **`fmStripeOnboarded` already null-safe.** `src/app/feed/[portfolioId]/page.tsx:87` uses `!!portfolio.fund_manager?.stripe_onboarded` — optional chain handles `fund_manager: null` after the LEFT JOIN switch. No change needed.

5. **Stripe re-export doesn't break the test.** Verified `src/lib/__tests__/stripe.test.ts`:
   - Line 11-13: import-without-key test — re-export adds nothing that requires the key ✓
   - Line 18-20: `expect(mod.DOPL_FEE_PERCENT).toBe(10)` — re-export forwards the value from `constants.ts`, so `mod.DOPL_FEE_PERCENT === 10` still holds ✓
   - Line 22-25: `getStripe()` throws — unchanged ✓
   - Line 28-35: `getStripe()` returns Stripe instance — unchanged ✓
   All 4 tests pass post-refactor.

6. **Fee disclosure guard `price_cents > 0` correctly excludes free portfolios.** Free tier has `price_cents === 0`; the guard skips disclosure. ✓

7. **profile-tiers.tsx insertion point verified.** Line 264-266 is the `/month` text, already inside an `{!isFree && (...)}` block (line 263). Plan's "after line 264-266 ... for paid tiers" intent matches the existing structure — see Finding 2 for an implementation clarification.

8. **billing-client.tsx Step 4 anchor verified.** Line 49 has `(mrrCents * 0.9) / 100`. Line 68 has `dopl takes 10% ... you keep 90%`. Both are correct anchor points for the constant migration.

### Findings

**Finding 1 — [NIT] Line 170 `@{fm.handle}` not explicitly guarded**

The plan's null-safety guard covers line 147-148 (the profile Link `href={`/${fm.handle}`}`) but doesn't mention line 170:
```tsx
<p className="text-xs text-[color:var(--dopl-cream)]/40 font-mono">
  @{fm.handle}
</p>
```

When `handle` is `null`, JSX renders this as `@` followed by nothing (React skips `null` children). Visually a stray `@` symbol.

**In practice this won't happen** — `resolveFm` falls back to an `idStub` (`fm_${id.slice(0, 6)}`) when the FM has no handle and no profile email, and the plan passes `portfolio.fund_manager_id` (always non-null FK) as the third arg. So `handle` will be at minimum `fm_abc123` for an orphaned FM.

But TypeScript's `ResolvedFm.handle: string | null` still allows null at the type level. **Suggested fix:** wrap line 170 in the same conditional pattern as line 148:
```tsx
{fm.handle && (
  <p className="text-xs text-[color:var(--dopl-cream)]/40 font-mono">
    @{fm.handle}
  </p>
)}
```
Two lines added; eliminates the stray-`@` edge case at the type level.

**Finding 2 — [NIT] profile-tiers.tsx Step 3 insertion-point ambiguity**

Plan says "After line 264-266 (`/month` text), add for paid tiers". The current structure is:
```tsx
{!isFree && (
  <p>/month</p>      // line 263-267
)}
```
"After line 264-266" could mean (a) outside the `!isFree` block but inside the parent div (would render the fee disclosure even for free portfolios — BAD), or (b) inside the same `!isFree` block (correct).

The implementer can figure out (b) is the intent from "for paid tiers", but the plan should spell out the structure to remove ambiguity:
```tsx
{!isFree && (
  <>
    <p className="...">/month</p>
    <p className="text-[10px] text-[color:var(--dopl-cream)]/25 font-mono mt-0.5">
      includes {DOPL_FEE_PERCENT}% platform fee
    </p>
  </>
)}
```
Or split into two separate `{!isFree && (...)}` blocks. Either works; just specify which.

### Other observations (no action)

- **`broker_provider` not in select.** The page's `select(...)` doesn't include `broker_provider`, so post-resolveFm `fm.broker_provider` is always `null`. Detail page doesn't use this field today, so no regression — but if a future feature wants the broker badge on the detail page, the select needs to be extended.
- **Step 4 marked "optional".** Step 4 (billing-client.tsx hardcoded 0.9 cleanup) is technically separable from the user-facing fee transparency. Plan correctly hedges as optional, but landing it together prevents drift between the constant and the displayed math. Minor.
- **PostgREST `error` field logging.** Task 1's added `console.error` for `portfolioErr` is good defensive instrumentation — surfaces the real reason if a future query fails for a different reason than missing FM.

### Verdict: APPROVED

Both findings are nits — small clarifications that prevent ambiguity at implementation time. Plan's core architectural claims (PostgREST INNER vs LEFT JOIN, resolveFm signature, re-export pattern, fee guard) all verified correct. No restructuring needed.

**Implementer notes:**
- Address Finding 1 by guarding line 170 with `{fm.handle && ...}` — same pattern as line 148.
- For Finding 2, place the fee disclosure inside the existing `{!isFree && (...)}` block on line 263 (use a fragment or extend the conditional).
- Step 4 is recommended (not optional) — keeps `DOPL_FEE_PERCENT` as the single source of truth for fee math and prose.
- This is a small sprint (2 tasks, 5 modify + 1 create) — single-PR merge is fine. Per merge policy, regular sprint = Surfer merges + pushes manually.
