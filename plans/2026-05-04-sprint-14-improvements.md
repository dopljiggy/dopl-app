**Status:** implemented + hotfixed (2026-05-04)

# Sprint 14: Team Feedback Improvements

## Context

Sprint 13 shipped FM Doplers Page, Investment Calculator, CSV Export, and Profile/Tier Polish. Post-merge smoke testing + full page-by-page team review surfaced 30 improvement items (see `IMPROVEMENT.md`). This sprint batches all fixes into one implementation push — P1 broken items first, then UX fixes, then polish.

30 items across 11 tasks. No new dependencies. Two new pages (forgot-password, reset-password). One new component (stripe-loading-overlay). Portfolio PATCH API already exists. All other work is modifications to existing files.

**Manual prerequisite (Surfer):** Add `http://localhost:3000/reset-password` and `https://dopl-app.vercel.app/reset-password` to Supabase Auth → URL Configuration → Redirect URLs allow-list. Required for Task 3 forgot-password flow.

---

## Task 1: Undopl Overlay Redesign (Items #4, #26, #30)

**Why:** P1 broken — buttons don't work, layout overlaps, unusable on both profile and feed pages.

**Root cause:** The undopl modal in `undopl-button.tsx` has z-index issues causing click interception, and the overlay layout breaks when content behind it varies in height.

### Changes

**File: `src/components/ui/undopl-button.tsx`** (155 lines — full rewrite of modal section)
- Replace the current overlay with a proper fixed-position modal with backdrop
- Use `fixed inset-0 z-50` backdrop + centered modal card
- "Keep Dopling" button: `btn-lime` style (green, prominent — safe choice)
- "Undopl" button: red outline/ghost style (destructive — secondary)
- Ensure `onClick` handlers fire correctly (no z-index blocking)
- Apply same green-vs-red pattern from #26 globally
- **Global sweep:** audit ALL confirmation modals in the codebase — position removal confirm (`positions-client.tsx`), portfolio delete, any others. Wherever a red/destructive button appears, the cancel/safe option must be green (`btn-lime` or lime-bordered glass-card).

**Depends on:** Nothing — do first (P1)

---

## Task 2: Homepage Revamp (Items #6, #7, #8, #9, #15 partial)

**Why:** Landing page is the first impression. Hero has too much text, buttons aren't inviting, footer looks dead.

### Changes

**File: `src/app/marketing-landing.tsx`** (209 lines)

**Hero section (lines 68-118):**
- Remove the subtext paragraph ("connect your broker. create portfolio tiers...") — lines ~95-100
- Keep only: heading ("your audience. your fund. your price.") + CTA buttons
- "Launch Your Fund" button: keep `btn-lime` but Title Case
- "See Fund Managers" button: upgrade from plain text link to `glass-card-light` with gradient border, hover glow, arrow icon — make it feel equally clickable
- Title Case both button labels

**How It Works section (lines 120-156):**
- "How It Works" → Title Case
- Cards: replace plain `glass-card` with gradient border treatment + subtle hover scale/glow
- Add visual section separator (e.g. subtle gradient divider or increased spacing)
- Card headings: Title Case

**Math card + CTA (lines 158-195):**
- Remove subtext below math card ("from the audience you already have. the research you're already doing. the trades you're already taking.")
- Trim the CTA subtext ("your followers are already copying your positions manually. badly. and late. dopl makes it automatic.") — shorten to one punchy line
- Title Case button text

**Footer (lines 197-205):**
- Replace minimal footer with professional layout:
  - Large dopl logo (font-display, ~2xl)
  - "infrastructure for fund managers" tagline
  - Copyright line: "© dopl 2026"
  - Optional: Terms / Privacy links (placeholder hrefs for now)
  - Clean horizontal layout, subtle top border separator

**Depends on:** Nothing

---

## Task 3: Auth Flow + Forgot Password (Items #5, #10)

**Why:** No forgot-password flow exists. Signup bottom link is too dim. Auth edge cases unhandled.

### Changes

**File: `src/app/(auth)/login/page.tsx`** (129 lines)
- Add "Forgot Password?" link below password field → navigates to `/forgot-password`
- Title Case heading ("Log In" not "log in")
- Brighten "no account?" bottom link text — change from `/40` opacity to `/70`

**File: `src/app/(auth)/signup/page.tsx`** (257 lines)
- Title Case heading ("Get Started")
- Brighten "already have an account? log in" — `/40` → `/70`
- Add inline validation: email format, password strength hint, handle availability feedback
- Title Case button labels

**File: `src/app/(auth)/forgot-password/page.tsx`** (new)
- Email input + "Send Reset Link" button
- Calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: origin + '/reset-password' })`
- Success state: "check your email for a reset link"
- Glass card centered layout matching login/signup style

**File: `src/app/(auth)/reset-password/page.tsx`** (new)
- New password + confirm password inputs
- Calls `supabase.auth.updateUser({ password })`
- Success → redirect to `/login` with toast
- Wrap in `<Suspense>` (uses URL params from email link)

**Manual setup (Surfer):** Add both `http://localhost:3000/reset-password` and `https://dopl-app.vercel.app/reset-password` to Supabase Dashboard → Authentication → URL Configuration → Redirect URLs. Without this, the email link fails with "redirect URL not allowed."

**Depends on:** Supabase redirect URL whitelist (manual step above)

---

## Task 4: FM Onboarding Polish (Items #11, #12, #13, #14)

**Why:** Unnecessary subtext, confusing defaults, awkward layouts in the onboarding flow.

### Changes

**File: `src/app/onboarding/onboarding-client.tsx`** (~1000 lines)

**Profile step (lines 487-553):**
- Remove subtitle "display name + handle are required. bio + avatar can come later from profile settings." (line 491)

**Region step (lines 555-592):**
- Remove subtitle "we route you to the right broker network for your region." (line 559)
- Add small helper text below the grid: "regions group broker networks — pick the closest match. you can always use manual entry."

**Portfolio step (lines 685-783):**
- Change `portfolioName` default from `"Main Portfolio"` (line 142) to `""` (empty)
- Add placeholder text `"e.g. Growth Portfolio"` on the input
- Price input (lines 731-745): reduce field width, move `/mo` closer to the dollar amount (inline suffix, not right-aligned)
- Shorten Stripe notice (lines 747-751): "paid tiers go live after Stripe setup"
- Title Case all headings and buttons

**Stripe step (lines 786-857):**
- Tighten button/text alignment — ensure "Set Up Stripe →" and "I'm Done — Check Status" are visually balanced

**Depends on:** Nothing

---

## Task 5: Broker Page Fixes (Items #19, #20, #25, #28)

**Why:** Layout is dense, change-provider and disconnect show the same popup (bug), "not listed" flow is redundant, dopler region step is pointless.

### Changes

**File: `src/app/(dashboard)/dashboard/connect/connect-client.tsx`** (~400 lines)

**Broker type selector:**
- Stack three cards vertically (single column) instead of side-by-side, even on desktop
- "My broker isn't listed" card: instead of navigating to separate `/dashboard/connect` manual entry page, redirect to `/dashboard/portfolios` with a toast "add positions directly in your portfolio"

**Connected state — change provider vs disconnect:**
- "Change provider": show a DIFFERENT modal — "Switch Broker?" with text "this will disconnect your current broker and let you connect a new one" + "Keep Current" (green) / "Switch" (amber) buttons
- "Disconnect broker": keep existing disconnect modal but fix:
  - Remove weird icon in top-left corner
  - "Keep Connected" button → green (`btn-lime` or glass-card with lime border)
  - "Disconnect" button → red outline (existing)

**Dopler region step removal:**
- Doplers ARE asked "where do you trade?" today — confirmed by smoke test. Remove this step entirely.
- The dopler onboarding flow uses `dopler-shell.tsx` and the welcome page at `/welcome`. Find the region step there and remove it. Doplers have no broker connection (removed Sprint 8), so region serves no purpose.

**File: `src/components/broker-preference-picker.tsx`** (9 hardcoded brokers)
- Expand the hardcoded broker list to include all major brokers across regions (at minimum: add DeGiro, Trade Republic, IG, Hargreaves Lansdown, CommSec, SelfWealth, Zerodha, Upstox, Groww, Emirates NBD, FAB, ADCB Securities)
- Or better: fetch available brokers dynamically from SnapTrade API if feasible

**Depends on:** Nothing

---

## Task 6: Portfolio Edit UI (Item #21)

**Why:** FM can't edit portfolio name/details after creation — stuck with typos. Frustration point.

**Note:** PATCH API already exists at `src/app/api/portfolios/[id]/route.ts:27-53` with full auth + ownership checks (`.eq("fund_manager_id", user.id)`). This task is purely UI.

### Changes

**File: `src/app/(dashboard)/dashboard/portfolios/expandable-portfolio-card.tsx`**
- Add "Edit" button/icon in the portfolio card header (pencil icon next to portfolio name)
- On click: inline edit mode OR modal with name, description, tier, price fields (matching the onboarding portfolio step layout)
- Save calls existing `PATCH /api/portfolios/[id]` with `{ name, description, tier, price_cents }`
- Cancel reverts to current values

**File: `src/app/(dashboard)/dashboard/portfolios/portfolios-client.tsx`**
- Pass `onUpdated` callback to trigger `router.refresh()` after edit

**Depends on:** Nothing

---

## Task 7: Auto-Rebalance (Item #3)

**Why:** FM shouldn't manually click "rebalance to 100%" — allocations should reflect actual market value proportions automatically.

**Note:** `recalculateAllocations()` helper already exists at `assign/route.ts:144-167`. Currently gated by `existingCount <= 1` (line 78) — only runs on first position insert. Task is mostly removing gates + adding calls.

### Changes

**File: `src/app/api/positions/assign/route.ts`**
- Remove the `existingCount <= 1` gate at line 78 — call `recalculateAllocations` after EVERY position assignment
- The helper already does: `allocation_pct = (market_value / total) * 100` per position

**File: `src/app/api/positions/manual/route.ts`**
- On position INSERT: call `recalculateAllocations` (import or duplicate the helper)
- On position DELETE (lines 124-127): remove the comment "Don't auto-recalc on delete" and ADD a call to `recalculateAllocations` so remaining positions rebalance to 100%

**Null/zero behavior:** Positions with null/zero `market_value` receive 0% allocation; siblings absorb the proportional share. This matches the existing helper's `Number(p.market_value) || 0` coercion. When ALL positions have zero `market_value`, the helper no-ops (existing behavior, acceptable).

**File: `src/app/(dashboard)/dashboard/portfolios/expandable-portfolio-card.tsx`**
- Remove "rebalance to 100%" button (lines 431-437)
- Keep the allocation % display but make it read-only (auto-calculated)

**Depends on:** Nothing

---

## Task 8: Dashboard Visual Polish (Items #16, #17, #18, #22, #23, #27)

**Why:** FM dashboard pages feel bland/monochromatic. Stat cards have visual artifacts. Positions are data-poor.

### Changes

**File: `src/components/ui/sparkline.tsx`** (77 lines)
- The "weird lines" on stat cards are sparkline SVG paths — the stroke/area renders at the card edge
- Fix: add proper clipping, or reduce opacity, or constrain the SVG viewBox so paths don't bleed to card edges
- Alternatively: if data is all zeros (new FM), hide the sparkline entirely

**File: `src/app/(dashboard)/dashboard/page.tsx`** (overview)
- Post-setup empty state: when checklist is complete and stats are all 0, show a helpful message ("you're set up — share your profile to start getting doplers") instead of bare stat cards

**File: `src/app/(dashboard)/dashboard/share/share-client.tsx`**
- Remove subtext from "copy link", "download PNG", "share on X" action cards — keep only the label
- Remove "1200 × 630 · og-ready" description from download PNG — just "Download PNG"
- Remove heading subtext ("download a premium card and drop it anywhere")
- Remove bottom helper text about PNG dimensions
- Keep float animation if subtle

**File: `src/app/(dashboard)/dashboard/profile/profile-client.tsx`** (186 lines)
- Add gradient border treatment to form sections (display name, handle, bio, links)
- Links section redesign: replace dropdown + "https://" input with:
  - Fixed platform rows: X, Instagram, YouTube, Discord, Website
  - Each row: platform icon + "@" prefix + handle input (not full URL)
  - We construct the full URL on save (e.g. `https://x.com/{handle}`)
  - Remove "+ add link" button — all platforms always visible, empty = not set

**File: `src/app/(dashboard)/dashboard/positions/positions-client.tsx`**
- Position cards in "assigned" section: show real-time price, shares, market value, gain/loss %
- Add allocation % badge per position
- Use the same mini card layout from `profile-tiers.tsx` position previews (ticker + trend icon + allocation %)
- Consider clarifying or removing the "unassigned" section label (rename to "synced from broker — not yet in a portfolio" or similar)

**File: `src/app/(dashboard)/dashboard/doplers/doplers-client.tsx`**
- Increase text opacity: table text from `/60` → `/80`, stat labels from `/40` → `/60`

**Depends on:** Nothing

---

## Task 9: Discover Page Redesign (Item #29)

**Why:** Leaderboard ranking by doplers penalizes new FMs and doesn't reflect strategy quality.

### Changes

**File: `src/app/(public)/leaderboard/page.tsx`** (57 lines)
- Rename page title from "Leaderboard" to "Discover Fund Managers" (or just "Discover")
- Remove "top fund managers by dopler count" subtitle
- Remove ranking numbers

**File: `src/app/(public)/leaderboard/leaderboard-list.tsx`** (128 lines)
- Remove the rank/position counter and podium glow effects (gold/silver/bronze)
- Convert from ranked list to card grid (2-col on desktop, 1-col mobile)
- Each FM card shows: avatar, display name, handle, bio excerpt, portfolio count, subscriber count
- Sort: randomized or by most recently active (not by subscriber count)
- Keep the existing query but change `order` from subscriber_count to `created_at` desc or random

**Depends on:** Nothing

---

## Task 10: Slide-to-Dopl + Stripe Transition Polish (Items #1, #2, #24)

**Why:** Slider feels snappy, Stripe redirect is jarring.

### Changes

**File: `src/components/ui/slide-to-dopl.tsx`** (154 lines)
- Research: study iOS-style slide-to-unlock physics
- Improvements:
  - Softer spring config: reduce stiffness, increase damping for buttery feel
  - Add momentum: if user swipes fast, let it coast (increase `dragElastic` slightly)
  - Parallax fill: make the gradient fill slightly lag behind the handle for depth
  - Haptic: keep `navigator.vibrate` pattern but make it more subtle
  - Visual: add subtle scale pulse on the handle during active drag
  - Completion: smooth gradient wash across the entire track on complete

**File: `src/components/ui/stripe-loading-overlay.tsx`** (new)
- Full-screen fixed overlay with `z-50`
- dopl logo + "connecting to Stripe..." text
- Subtle aurora/pulse animation (reuse `aurora-pulse` from globals.css)
- Shown between slider completion and browser navigation

**File: `src/app/feed/[portfolioId]/portfolio-detail-client.tsx`**
- In `handleSubscribe`: show overlay before `window.location.href = url`

**File: `src/app/[handle]/profile-tiers.tsx`**
- In `doplPaid`: show overlay before `window.location.href = url`

**File: `src/app/(dashboard)/dashboard/billing/billing-client.tsx`** (Item #24)
- In `handleSetupStripe` (lines 22-28): show overlay before `window.location.href = json.url`
- Same pattern — FM Stripe Connect onboarding redirect also benefits from the branded transition

**Depends on:** Nothing

---

## Task 11: Global Text Capitalization Pass (Item #15)

**Why:** Inconsistent casing across the app — some headings lowercase, some capitalized.

### Changes

All headings, button labels, section titles → Title Case. Key files:
- `src/app/marketing-landing.tsx` — already covered in Task 2
- `src/app/(auth)/signup/page.tsx` — already covered in Task 3
- `src/app/(auth)/login/page.tsx` — already covered in Task 3
- `src/app/onboarding/onboarding-client.tsx` — already covered in Task 4
- `src/app/(dashboard)/dashboard/page.tsx` — "welcome back" → "Welcome Back"
- `src/app/(dashboard)/dashboard/connect/connect-client.tsx` — "connect broker" → "Connect Broker"
- `src/app/(dashboard)/dashboard/share/share-client.tsx` — covered in Task 8
- `src/app/(dashboard)/dashboard/profile/profile-client.tsx` — "edit profile" → "Edit Profile"
- `src/app/(dashboard)/dashboard/portfolios/portfolios-client.tsx` — "portfolios" → "Portfolios"
- `src/app/(dashboard)/dashboard/positions/positions-client.tsx` — "positions" → "Positions"
- `src/app/(dashboard)/dashboard/doplers/doplers-client.tsx` — "doplers" → "Doplers"
- `src/app/(dashboard)/dashboard/billing/billing-client.tsx` — "billing" → "Billing"
- `src/components/ui/undopl-button.tsx` — "stop dopling?" → "Stop Dopling?"

This is a sweep task — touch every page heading + button label.

**Depends on:** All other tasks (do last to avoid merge conflicts)

---

## Task Dependency Graph

```
Task 1 (undopl)           — P1, do first
Task 2 (homepage)         — independent
Task 3 (auth + forgot pw) — independent
Task 4 (onboarding)       — independent
Task 5 (broker fixes)     — independent
Task 6 (portfolio edit)   — independent
Task 7 (auto-rebalance)   — independent
Task 8 (dashboard polish) — independent
Task 9 (discover)         — independent
Task 10 (slider + stripe) — independent
Task 11 (capitalization)  — do LAST (touches all files)
```

Recommended order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11

---

## Files Summary

**Create (3):**
- `src/app/(auth)/forgot-password/page.tsx`
- `src/app/(auth)/reset-password/page.tsx`
- `src/components/ui/stripe-loading-overlay.tsx`

**Unchanged but relevant:**
- `src/app/api/portfolios/[id]/route.ts` — PATCH already exists with auth+ownership, Task 6 is UI-only

**Modify (18):**
- `src/components/ui/undopl-button.tsx` — modal redesign
- `src/app/marketing-landing.tsx` — hero, how it works, CTA, footer
- `src/app/(auth)/login/page.tsx` — forgot pw link, capitalization
- `src/app/(auth)/signup/page.tsx` — validation, capitalization, link brightness
- `src/app/onboarding/onboarding-client.tsx` — remove subtexts, portfolio defaults, price layout
- `src/app/(dashboard)/dashboard/connect/connect-client.tsx` — vertical layout, fix modals
- `src/components/broker-preference-picker.tsx` — expand broker list
- `src/app/(dashboard)/dashboard/portfolios/expandable-portfolio-card.tsx` — edit button, remove rebalance
- `src/app/(dashboard)/dashboard/portfolios/portfolios-client.tsx` — edit callback
- `src/app/api/positions/assign/route.ts` — auto-rebalance
- `src/app/api/positions/manual/route.ts` — auto-rebalance
- `src/components/ui/sparkline.tsx` — fix edge artifacts
- `src/app/(dashboard)/dashboard/page.tsx` — empty state
- `src/app/(dashboard)/dashboard/share/share-client.tsx` — strip subtext
- `src/app/(dashboard)/dashboard/profile/profile-client.tsx` — links UX, gradients
- `src/app/(dashboard)/dashboard/positions/positions-client.tsx` — richer cards
- `src/app/(dashboard)/dashboard/doplers/doplers-client.tsx` — text brightness
- `src/app/(public)/leaderboard/leaderboard-list.tsx` — card grid, no ranking
- `src/app/(public)/leaderboard/page.tsx` — rename to Discover
- `src/components/ui/slide-to-dopl.tsx` — physics polish
- `src/app/feed/[portfolioId]/portfolio-detail-client.tsx` — stripe overlay
- `src/app/[handle]/profile-tiers.tsx` — stripe overlay
- `src/app/(dashboard)/dashboard/billing/billing-client.tsx` — stripe overlay for Connect redirect

**Reuse (existing):**
- `glass-card`, `glass-card-light`, `btn-lime` — design system
- `aurora-pulse` animation — for stripe overlay
- `fireToast` — success/error feedback
- `GlassCard` component — dashboard cards

---

## Verification

### Automated
- `npm test` — all existing tests pass
- `npm run build` — clean build, no type errors

### Manual Smoke (Surfer on prod after merge)

**Undopl (Task 1):**
1. Dopler feed page → click X on a subscription → modal appears centered, no overlap
2. "Keep Dopling" button works (green, dismisses modal)
3. "Undopl" button works (red, removes subscription)
4. Same behavior from FM profile page tier card undopl

**Homepage (Task 2):**
5. Landing page hero: no subtext paragraph, just heading + two buttons
6. Both CTA buttons look interactive with gradient treatment
7. "How It Works" cards elevated with gradient borders
8. Math card: no long subtext below
9. Footer: logo, copyright, clean professional layout

**Auth (Task 3):**
10. Login page: "Forgot Password?" link visible below password field
11. Click it → forgot-password page → enter email → "check your email" confirmation
12. Signup: "Already have an account?" text clearly visible (not dim)
13. Reset password page works after clicking email link

**Onboarding (Task 4):**
14. FM profile step: no subtext about required fields
15. Region step: no subtext, helper text about broker groupings visible
16. Portfolio step: name field empty with placeholder, price input compact with /mo inline
17. Stripe step: buttons aligned cleanly

**Broker (Task 5):**
18. Broker page: three cards stacked vertically
19. "Change provider" shows different modal from "Disconnect broker"
20. "Keep Connected" button is green in disconnect modal
21. No weird icon in disconnect modal

**Portfolio Edit (Task 6):**
22. Click edit icon on portfolio card → edit modal/inline fields appear
23. Change name → save → name updated
24. Price and tier changes persist

**Auto-Rebalance (Task 7):**
25. Add a position to a portfolio → all allocations auto-recalculate to 100%
26. Remove a position → remaining allocations rebalance
27. No manual "rebalance to 100%" button visible

**Dashboard Polish (Task 8):**
28. Overview stat cards: no weird line artifacts
29. Share page: action buttons have no subtext, just labels
30. Profile page: links section shows platform icons + handle inputs
31. Positions page: cards show price, shares, market value

**Discover (Task 9):**
32. /leaderboard: no ranking numbers, FM cards in a grid
33. Each card shows stats (portfolios, doplers) without rank

**Slider + Stripe (Task 10):**
34. Slide to dopl on paid tier: smooth, buttery feel
35. After completing slide → full-screen "connecting to Stripe..." overlay appears before redirect
36. FM billing page → "Set Up Payments" → same branded overlay before Stripe Connect redirect

**Capitalization (Task 11):**
37. Spot-check 5+ pages: all headings and buttons are Title Case

---

## Plan Review (Instance 2)

**Reviewed:** 2026-05-04
**Reviewer focus:** 30-item coverage, file paths, over-engineering, Task 7 edge cases, Task 1 z-index/layout, Task 6 auth+ownership, Task 3 Supabase redirect URL

### Coverage Audit (30 items)

All 30 IMPROVEMENT.md items have at least one task touching them:

| Item | Task | | Item | Task |
|------|------|---|------|------|
| 1 (slider polish) | 10 ✓ | | 16 (stat artifacts) | 8 ✓ |
| 2 (Stripe transition) | 10 ✓ | | 17 (share subtext) | 8 ✓ |
| 3 (auto-rebalance) | 7 ✓ | | 18 (profile bland + links) | 8 ✓ |
| 4 (undopl P1) | 1 ✓ | | 19 (broker layout) | 5 ✓ |
| 5 (forgot pw) | 3 ✓ | | 20 (change vs disconnect bug) | 5 ✓ |
| 6 (hero) | 2 ✓ | | 21 (portfolio edit) | 6 ⚠ |
| 7 (how it works) | 2 ✓ | | 22 (positions cards) | 8 ✓ |
| 8 (CTA + math) | 2 ✓ | | 23 (doplers brightness) | 8 ✓ |
| 9 (footer) | 2 ✓ | | 24 (billing Stripe overlay) | 10 ⚠ |
| 10 (signup capitalization) | 3 ✓ | | 25 ("not listed" redundant) | 5 ✓ |
| 11 (profile step) | 4 ✓ | | 26 (destructive pattern) | 1 partial ⚠ |
| 12 (region step) | 4 ✓ | | 27 (FM dashboard polish) | 8 ✓ |
| 13 (portfolio step) | 4 ✓ | | 28 (dopler region + brokers) | 5 ⚠ |
| 14 (Stripe step) | 4 ✓ | | 29 (discover redesign) | 9 ✓ |
| 15 (capitalization) | 11 ✓ | | 30 (feed undopl) | 1 ✓ |

**Coverage gaps marked ⚠ — see Findings below.**

### Verified ✓

1. **All file paths in the plan exist** — verified via shell. Notable: `(auth)` route group with `login` + `signup` (forgot-password and reset-password are correctly marked "new"). All other modify-target paths confirmed.

2. **Task 1 — undopl modal fix addresses both issues:**
   - Z-index/click interception: "Use `fixed inset-0 z-50` backdrop + centered modal card. Ensure `onClick` handlers fire correctly (no z-index blocking)." ✓
   - Layout overlap: "proper fixed-position modal with backdrop" — replaces the absolutely-positioned overlay that was breaking against varying content heights. ✓
   - Bonus: applies the green/red pattern from #26 in the same task.

3. **Task 3 — forgot-password redirect URL pattern is correct.** `redirectTo: origin + '/reset-password'` works for both `http://localhost:3000` and `https://dopl-app.vercel.app` because `origin` is dynamic. (See Finding 4 for the manual Supabase setup step.)

4. **Task 7 edge cases — mostly handled by the existing helper** (see Finding 2 for the surprise that the helper already exists):
   - Empty portfolio: `if (!positions?.length) return;` — no-op ✓
   - Single position with `market_value > 0`: 100% allocation ✓
   - All-zero `market_value`: existing helper does `if (total === 0) return;` (no-op). Plan's "fall back to equal distribution" is a NEW feature beyond the existing behavior. See Finding 3.

5. **No over-engineering** spotted. Each task maps to its minimal scope. Task 11 (capitalization sweep) is correctly placed last to avoid merge conflicts. The plan correctly reuses existing primitives (`glass-card`, `aurora-pulse`, `fireToast`, `GlassCard`) rather than introducing new design tokens.

### Findings

**Finding 1 — [CRITICAL] Task 6 PATCH endpoint already exists**

Plan says: *"Add `PATCH` handler: accepts `{ name, description, tier, price_cents }`"* and lists `src/app/api/portfolios/[id]/route.ts` (PATCH for portfolio edit) under "Create (4)".

Verified `src/app/api/portfolios/[id]/route.ts:27-53` — **PATCH is already implemented**:

```typescript
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { error } = await supabase
    .from("portfolios")
    .update(body)
    .eq("id", id)
    .eq("fund_manager_id", user.id);
  ...
}
```

Auth + ownership are both in place (line 33-37 + line 48 `.eq("fund_manager_id", user.id)`). The handler accepts the full body, so `{name, description, tier, price_cents}` works as-is.

**Fix:**
- Move `src/app/api/portfolios/[id]/route.ts` from the "Create (4)" list to "Unchanged but relevant".
- Update Context line 7: "One new API route (portfolio PATCH)" — false. Plan creates 3 new files, not 4.
- Task 6 is purely a UI task: pencil-icon edit button + edit modal/inline + PATCH call from existing endpoint.

This is the kind of "phantom file in the create list" drift that the Sprint 13 audit was supposed to prevent. Worth a quick grep next time before listing as new.

**Finding 2 — [CRITICAL] Task 7 `recalculateAllocations` helper already exists**

Plan says: *"Logic: `allocation_pct = market_value / total_portfolio_market_value * 100` for each position"* — implies fresh implementation.

Verified `src/app/api/positions/assign/route.ts:144-167` — the helper already exists:

```typescript
async function recalculateAllocations(supabase: any, portfolioId: string) {
  const { data: positions } = await supabase
    .from("positions")
    .select("id, market_value")
    .eq("portfolio_id", portfolioId);
  if (!positions?.length) return;
  const total = positions.reduce((a, p) => a + (Number(p.market_value) || 0), 0);
  if (total === 0) return;
  await Promise.all(
    positions.map((p) =>
      supabase.from("positions").update({
        allocation_pct: ((Number(p.market_value) || 0) / total) * 100,
      }).eq("id", p.id)
    )
  );
}
```

Currently invoked only on **first position insert** in the same file (line 78: `if ((existingCount ?? 0) <= 1)`).

Task 7 needs to:
1. Remove the `existingCount <= 1` gate at line 78 — call `recalculateAllocations` after EVERY insert.
2. Add a call to `recalculateAllocations` in the DELETE path (line 124-127). The current comment at line 125-126 explicitly says *"Don't auto-recalc on delete — fund manager's custom allocations stay intact; the 'rebalance to 100%' button in the UI lets them fix sums."* — this comment must be removed/inverted to match the new auto-rebalance behavior.
3. Apply the same pattern in `src/app/api/positions/manual/route.ts` (which currently has its own inline allocation logic — should refactor to call the shared helper, OR copy the helper).
4. Decide on the all-zero edge case: existing helper does **no-op**, plan describes "equal distribution" — these conflict. Pick one.

**Fix:** Update Task 7's "Changes" to:
- Reuse the existing `recalculateAllocations` helper in `assign/route.ts`.
- Drop the conditional gate; call it on every insert AND every delete.
- Reverse the "Don't auto-recalc on delete" comment.
- Specify all-zero behavior: either keep the existing no-op (simplest, matches reality) OR add equal distribution (extra logic, niche case).

**Finding 3 — [IMPORTANT] Task 7 mixed null/zero behavior unspecified**

The existing helper coerces null `market_value` to 0 via `Number(p.market_value) || 0`. So a position with null market_value gets `0 / total * 100 = 0%` allocation while siblings with values get their proportional share. Plan doesn't address this — implementer needs to confirm this is acceptable.

For the FM trading terminal flow: the position has a price + shares at insert time, so market_value is computed and non-null. For SnapTrade-synced positions: market_value comes from the broker. So the null case is rare but possible (e.g., a manual entry where price was unavailable from the dual-fallback in Sprint 10). Acceptable to treat as 0% allocation, but worth documenting.

**Fix:** Add a one-liner to Task 7: "Positions with null/zero market_value receive 0% allocation; their siblings absorb the proportional share."

**Finding 4 — [IMPORTANT] Task 3 missing manual Supabase setup step**

Task 3 uses `supabase.auth.resetPasswordForEmail(email, { redirectTo: origin + '/reset-password' })`. For the email link to work, both URLs must be added to Supabase Auth → URL Configuration → Redirect URLs:

- `http://localhost:3000/reset-password` (local dev)
- `https://dopl-app.vercel.app/reset-password` (prod)

Without the whitelist, the password reset email's link fails with "redirect URL not allowed in Allow List." The plan should note this as a manual setup step Surfer must do once before the feature works in either environment.

**Fix:** Add to Task 3 (or Prerequisites section): "**Surfer**: add `http://localhost:3000/reset-password` and `https://dopl-app.vercel.app/reset-password` to Supabase Auth Redirect URLs allow-list (Dashboard → Authentication → URL Configuration)."

**Finding 5 — [IMPORTANT] Item #24 (billing Stripe overlay) not actually wired**

IMPROVEMENT.md item #24 explicitly references Stripe overlay for the **FM billing page** ("Set Up Payments" button → Stripe Connect onboarding redirect). Plan's Task 10 creates the overlay component and wires it into:
- `src/app/feed/[portfolioId]/portfolio-detail-client.tsx` (subscribe checkout)
- `src/app/[handle]/profile-tiers.tsx` (subscribe checkout)

But NOT into `src/app/(dashboard)/dashboard/billing/billing-client.tsx`'s `handleSetupStripe` function (lines 22-28 of billing-client.tsx — which has the same `window.location.href = url` pattern after `/api/stripe/connect`).

**Fix:** Add `src/app/(dashboard)/dashboard/billing/billing-client.tsx` to Task 10's file list. Wire the overlay into `handleSetupStripe` before the redirect, same pattern as the other two.

**Finding 6 — [NIT] Task 5 dopler region step uses conditional language**

Plan says: *"Check if dopler onboarding includes a region step — if so, remove it."* But IMPROVEMENT.md item #28 is definite — doplers ARE asked the region step today. The plan should be a definite remove, not an investigate.

**Fix:** Reword to: "Remove the dopler region step from `onboarding-client.tsx` (Sprint 8 removed dopler broker connection; the region question now serves no purpose)." Implementer doesn't need to confirm; it's a known gap.

**Finding 7 — [NIT] Item #26 destructive-button pattern not audited globally**

Plan applies the green/red pattern in Task 1 (undopl) and Task 5 (disconnect broker). Other confirmation modals exist in the codebase that may not match:

- Position removal confirmation (`positions-client.tsx:332-371` — the inline amber confirm row from Sprint 10) — uses red destructive button + plain ghost cancel.
- Portfolio delete (if exists in `expandable-portfolio-card.tsx`).
- The Sprint 10 trash-icon confirm flow (`positions-client.tsx`) and any others.

Item #26 says "apply consistently across all confirmation modals" — plan covers two specific modals but doesn't sweep. Worth a one-line addition to Task 11 (the global sweep): "While doing the capitalization sweep, also audit destructive-button modals — wherever a red/destructive button appears, the cancel option should be `btn-lime`-style green per item #26."

### Verdict: NEEDS REVISION

- **2 critical:** Task 6 PATCH and Task 7 `recalculateAllocations` helper both already exist. Plan creates a phantom file (Finding 1) and reimplements existing logic (Finding 2). Both fixes shrink the plan rather than expand it.
- **3 important:** Task 7 null/zero spec gap (Finding 3), Task 3 Supabase redirect-URL allow-list step missing (Finding 4), Task 10 billing-client.tsx not wired (Finding 5).
- **2 nits:** Task 5 conditional language (Finding 6), Task 11 destructive-button sweep (Finding 7).

All resolvable with plan edits — no task restructuring. The two critical findings make the plan smaller, not larger. Re-review after Architect updates Tasks 6, 7, 10, 3.
