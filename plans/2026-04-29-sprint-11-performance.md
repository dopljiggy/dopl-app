**Status:** implemented

# Sprint 11: Performance — Perceived Load Speed

## Context

Post-Sprint-10 smoke revealed a slow app launch sequence: black screen → white screen → dopl logo splash → content. Investigation identified 5 independent layers stacking additive delay. On a cold PWA launch, the user waits 2-4 seconds before seeing any content.

**Root causes (5 independent layers):**
1. Zero `loading.tsx` files — user sees blank white while server components resolve auth + DB queries
2. `StandaloneSplash` shows the dopl logo for a hard-coded **1500ms** on top of everything else
3. Google Fonts loaded via external `<link>` — DNS + CSS manifest + font file download adds 200-500ms FOIT
4. 8 pages call `getUser()` directly instead of the existing `getCachedUser()` — duplicate auth round-trips within the same request
5. Aurora loader enforces a 420ms minimum animation on every route change and 200ms on every fetch — even sub-100ms loads show a spinner

All 5 are independent fixes. No new features, no DB changes, no API changes.

## Prerequisites

None.

---

## Task 1: Skeleton Loading Files

**Create** `loading.tsx` in 5 key route directories:

- `src/app/(dashboard)/dashboard/loading.tsx`
- `src/app/(dashboard)/dashboard/portfolios/loading.tsx`
- `src/app/feed/loading.tsx`
- `src/app/notifications/loading.tsx`
- `src/app/settings/loading.tsx`

Each file exports a default React component showing a shimmer skeleton that roughly matches the page layout. Next.js automatically shows this component while the server component resolves.

**Skeleton design pattern** (consistent across all 5):
- Use the existing glass-card style: `glass-card-light rounded-2xl`
- Animated shimmer: `animate-pulse` on placeholder blocks
- Blocks use `bg-[color:var(--dopl-sage)]/20 rounded` with varying widths/heights to suggest the page structure
- No text content — just shapes suggesting headers, cards, tables

**Per-page skeletons:**

### Dashboard (`/dashboard`)
- Header block (h-8, w-48) for "dashboard" title
- 2 stat cards side by side (glass-card, h-24 each)
- Activity list: 4 rows of h-4 blocks with gaps

### Portfolios (`/dashboard/portfolios`)
- Header row: h-8 w-48 title + h-10 w-32 button placeholder (right)
- 2 portfolio card skeletons (glass-card, h-20 each) with inner line blocks

### Feed (`/feed`)
- Header block (h-8, w-32) + subtext (h-4, w-64)
- 2 portfolio card skeletons matching the feed card layout: header row (avatar circle + text lines) + table rows (5 lines of h-4)

### Notifications (`/notifications`)
- Header block (h-8, w-48)
- Tab bar placeholder (h-10, full width)
- 4 notification row skeletons (h-16 each, glass-card)

### Settings (`/settings`)
- Header block (h-8, w-32)
- 3 settings section skeletons: label (h-4, w-24) + input placeholder (h-10, full width), spaced

**Exit criteria:** Navigating to any of these 5 routes shows an instant shimmer skeleton before the server component data resolves. No blank white screen.

**Depends on:** None

---

## Task 2: StandaloneSplash — Dismiss on Ready

**Modify:** `src/components/pwa/standalone-splash.tsx`

**Current:** Hard-coded `setTimeout(() => setShow(false), 1500)`.

**Change:** Replace the timer with a dismiss-on-ready pattern using a defensive global flag (eliminates React effect-ordering dependency):
- Keep a minimum display of **400ms** (prevents a jarring flash if content loads instantly)
- Set a maximum of **2000ms** (timeout fallback if content never signals ready)
- Listen for a custom event `dopl:content-ready` dispatched by the first meaningful page wrapper after mount
- Use a global `__doplContentReady` flag so the splash handles the case where content mounts before the splash's effect runs (concurrent mode, Suspense streaming, JSX reordering)

Note: the dispatch fires when the client wrapper mounts, not when data finishes loading. For pages with server-side data fetches that suspend, the wrapper renders after suspense resolves — so the signal is effectively "page content is visible," which is the right dismiss trigger for the splash.

```tsx
// StandaloneSplash — dismiss-on-ready with defensive flag:
useEffect(() => {
  if (!isStandalone) return;
  setShow(true);
  const start = Date.now();
  const MIN = 400;
  const MAX = 2000;

  const dismiss = () => {
    const elapsed = Date.now() - start;
    const remaining = Math.max(0, MIN - elapsed);
    setTimeout(() => setShow(false), remaining);
  };

  // If content already mounted before this effect ran, dismiss immediately.
  if ((window as any).__doplContentReady) {
    dismiss();
    return;
  }

  window.addEventListener("dopl:content-ready", dismiss, { once: true });
  const fallback = setTimeout(dismiss, MAX);
  return () => {
    window.removeEventListener("dopl:content-ready", dismiss);
    clearTimeout(fallback);
  };
}, [isStandalone]);
```

**Dispatch the event** from each page's client boundary component after mount — set the global flag BEFORE dispatching so the splash can check it synchronously:
```tsx
useEffect(() => {
  (window as any).__doplContentReady = true;
  window.dispatchEvent(new Event("dopl:content-ready"));
}, []);
```

Add the dispatch to:
- `src/components/dopler-shell.tsx` (covers /feed, /notifications, /settings, /leaderboard)
- `src/app/(dashboard)/dashboard/layout.tsx` or the dashboard client wrapper (covers all /dashboard pages)
- `src/app/page.tsx` client component (homepage)

**Exit criteria:** PWA launch shows splash for ~400-600ms (until content mounts), not the full 1500ms. Maximum 2s if content is slow.

**Depends on:** None

---

## Task 3: Self-Host Fonts via next/font

**Modify:** `src/app/layout.tsx`

**Current (lines 57-65):**
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@300..700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
```

**Replace with `next/font/google`:**

```tsx
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});
```

Apply CSS variables to `<body>`:
```tsx
<body className={`${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
```

**Update CSS references:** Check `src/app/globals.css` or Tailwind config for font-family declarations that reference these fonts by name. Update them to use the CSS variables (`var(--font-fraunces)`, etc.) if not already.

Remove the 3 `<link>` tags from `<head>`.

**Exit criteria:** No external font requests on page load. Fonts are bundled and served from the same origin. No FOIT flash. Text renders with correct fonts on first paint.

**Depends on:** None

---

## Task 4: Auth Dedup — Use getCachedUser() Everywhere

`getCachedUser()` already exists in `src/lib/supabase-server.ts` — it uses React's `cache()` to deduplicate `getUser()` calls within a single server request. Currently only used by 2 files (`(dashboard)/layout.tsx` and `(dashboard)/dashboard/page.tsx`), and returns `user` only.

**Step 1 — Extend `getCachedUser()` signature** (required, not conditional):

Current (`src/lib/supabase-server.ts:27-33`):
```tsx
export const getCachedUser = cache(async () => {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});
```

Change to:
```tsx
export const getCachedUser = cache(async () => {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
});
```

**Step 2 — Fix the 2 existing callers** (they currently destructure the bare user):
- `src/app/(dashboard)/layout.tsx:11` — `const user = await getCachedUser()` → `const { user } = await getCachedUser()`
- `src/app/(dashboard)/dashboard/page.tsx:12` — same change

**Step 3 — Migrate all 17 page/layout files** calling `getUser()` directly:

Replace:
```tsx
const supabase = await createServerSupabase();
const { data: { user } } = await supabase.auth.getUser();
```

With:
```tsx
const { supabase, user } = await getCachedUser();
```

**Files to update** (verified via grep — includes pages AND layouts, not just the 8 originally listed):
1. `src/app/page.tsx`
2. `src/app/feed/page.tsx`
3. `src/app/feed/[portfolioId]/page.tsx`
4. `src/app/settings/page.tsx`
5. `src/app/welcome/page.tsx`
6. `src/app/me/page.tsx`
7. `src/app/[handle]/page.tsx`
8. `src/app/(public)/leaderboard/page.tsx`
9. `src/app/notifications/page.tsx`
10. `src/app/onboarding/page.tsx`
11. `src/app/(dashboard)/dashboard/portfolios/page.tsx`
12. `src/app/(dashboard)/dashboard/profile/page.tsx`
13. `src/app/(dashboard)/dashboard/positions/page.tsx`
14. `src/app/(dashboard)/dashboard/connect/page.tsx`
15. `src/app/(dashboard)/dashboard/billing/page.tsx`
16. `src/app/(dashboard)/dashboard/share/page.tsx`
17. `src/app/(dashboard)/fund-manager/activity/page.tsx`

**Do NOT change:**
- API routes (`src/app/api/...`) — they handle independent requests and should each create their own auth context
- `src/app/auth/callback/route.ts` — API route, not a page

**Exit criteria:** `grep -rn "supabase.auth.getUser" src/app/ --include="*.tsx" | grep -v "/api/"` returns zero results. All pages/layouts use `getCachedUser()`. Pages that share a layout (e.g., `/dashboard/*`) make only one auth round-trip per request.

**Depends on:** None

---

## Task 5: Aurora Loader — Reduce Minimum Display Times

**Modify:** `src/components/ui/aurora-loader.tsx`

**Current:**
- Route change: 420ms minimum animation (line ~58)
- Fetch: 200ms minimum display (line ~77)

**Change:**
- Route change: reduce to **150ms** — still visible for slow transitions, but doesn't add perceptible delay for fast ones
- Fetch: replace the 200ms post-fetch extension with a **150ms start delay** pattern — only show the spinner if the fetch is still pending after 150ms. Sub-150ms fetches show no spinner at all; longer fetches get the full smooth CSS transition (`opacity 420ms ease` in globals.css:320) without flicker.

  Implementation: instead of calling `start()` immediately on fetch, set a 150ms timeout. If the fetch resolves before the timeout fires, cancel it — no spinner shown. If the timeout fires, call `start()`. On fetch complete, call `stop()` immediately (no artificial extension needed since the spinner only appeared for genuinely slow fetches).

  This avoids the flicker problem: with 0ms stop delay, a fast fetch would trigger the CSS opacity ramp-up then immediately reverse it, producing a visible flash. The start delay eliminates the flash entirely by never starting the animation for fast fetches.

**Exit criteria:** Fast page navigations (sub-150ms server response) don't show the aurora loader at all. Slow navigations (>150ms) show a smooth spinner. No flicker on fast fetches.

**Depends on:** None

---

## Task Dependency Graph

```
Task 1 (loading.tsx skeletons)  — independent
Task 2 (splash dismiss-on-ready) — independent
Task 3 (next/font migration)    — independent
Task 4 (auth dedup)              — independent
Task 5 (aurora loader tuning)    — independent
```

All 5 tasks are independent. Execute in any order. Recommended: 3, 4, 5 first (smallest), then 1, 2 (larger).

---

## Files Summary

**Create (5):**
- `src/app/(dashboard)/dashboard/loading.tsx`
- `src/app/(dashboard)/dashboard/portfolios/loading.tsx`
- `src/app/feed/loading.tsx`
- `src/app/notifications/loading.tsx`
- `src/app/settings/loading.tsx`

**Modify (25):**
- `src/lib/supabase-server.ts` — extend getCachedUser() to return `{ supabase, user }` (Task 4 Step 1)
- `src/app/layout.tsx` — replace Google Fonts link with next/font imports; optionally clean up literal font names from font-family stacks after CSS variable swap
- `src/app/globals.css` — update font-family references to use `var(--font-inter)`, `var(--font-fraunces)`, `var(--font-jetbrains-mono)`
- `src/components/pwa/standalone-splash.tsx` — dismiss-on-ready with defensive global flag
- `src/components/ui/aurora-loader.tsx` — reduce route-change min, add 150ms fetch start delay
- `src/components/dopler-shell.tsx` — dispatch content-ready event + set global flag
- `src/app/(dashboard)/dashboard/layout.tsx` — dispatch content-ready event + set global flag; fix existing getCachedUser destructuring
- `src/app/(dashboard)/dashboard/page.tsx` — fix existing getCachedUser destructuring
- `src/app/page.tsx` — getCachedUser + dispatch content-ready
- `src/app/feed/page.tsx` — getCachedUser
- `src/app/feed/[portfolioId]/page.tsx` — getCachedUser
- `src/app/settings/page.tsx` — getCachedUser
- `src/app/welcome/page.tsx` — getCachedUser
- `src/app/me/page.tsx` — getCachedUser
- `src/app/[handle]/page.tsx` — getCachedUser
- `src/app/(public)/leaderboard/page.tsx` — getCachedUser
- `src/app/notifications/page.tsx` — getCachedUser
- `src/app/onboarding/page.tsx` — getCachedUser
- `src/app/(dashboard)/dashboard/portfolios/page.tsx` — getCachedUser
- `src/app/(dashboard)/dashboard/profile/page.tsx` — getCachedUser
- `src/app/(dashboard)/dashboard/positions/page.tsx` — getCachedUser
- `src/app/(dashboard)/dashboard/connect/page.tsx` — getCachedUser
- `src/app/(dashboard)/dashboard/billing/page.tsx` — getCachedUser
- `src/app/(dashboard)/dashboard/share/page.tsx` — getCachedUser
- `src/app/(dashboard)/fund-manager/activity/page.tsx` — getCachedUser

**Unchanged but relevant:**
- API route files — keep direct getUser() (independent requests)
- `src/app/auth/callback/route.ts` — API route, not a page

---

## Verification

### Automated
- `npm test` — all existing tests pass
- `npm run build` — clean build, no font warnings

### Manual Smoke (Surfer on prod after merge)

**Skeleton loading:**
1. Navigate to /dashboard → shimmer skeleton appears instantly before content loads
2. Navigate to /feed → shimmer skeleton appears
3. Navigate to /notifications → shimmer skeleton appears
4. Navigate to /dashboard/portfolios → shimmer skeleton appears
5. Hard-refresh any page → skeleton visible during server render, not blank white

**Splash:**
6. Close app fully → reopen from home screen → splash shows for ~400-600ms (not 1.5s)
7. If content loads fast, splash dismisses early. If slow, splash shows max 2s.

**Fonts:**
8. Hard-refresh → text renders immediately with correct fonts (no flash of system font)
9. Network tab: no requests to fonts.googleapis.com or fonts.gstatic.com

**General:**
10. Fast page navigations don't show a loading spinner
11. Overall app feels significantly snappier — no 1.5s+ splash, no blank white, no font flash

---

## Plan Review (Instance 2)

**Reviewed:** 2026-04-29
**Reviewer focus:** Task 2 event-race, Task 3 Tailwind v4 + globals.css fonts, Task 4 getCachedUser signature, Task 5 fetch-flicker

### Verified ✓

1. **Task 1 — `loading.tsx` is the canonical Next.js pattern.** Each route directory's `loading.tsx` exports a default component used as Suspense fallback while the page server-renders. No risk; standard usage.

2. **Task 3 — globals.css font references confirmed.** Verified directly: line 64 (`'Inter'`), line 71 (`'Fraunces'`), line 76 (`'JetBrains Mono'`) all reference the fonts by literal name in font-family stacks. The plan's instruction to update them to `var(--font-inter)`, `var(--font-fraunces)`, `var(--font-jetbrains-mono)` is correct. No `tailwind.config.ts/js` exists — Tailwind v4 uses the `@import "tailwindcss"` directive at globals.css line 1, with theme tokens defined inline. The font CSS variables work seamlessly with this setup.

3. **Task 5 route-change to 150ms is fine.** Once Task 1 (skeletons) lands, the aurora becomes redundant for navigation — `loading.tsx` already covers initial render. 150ms minimum is just for tail-end transition shimmer.

4. **`StandaloneSplash` placement verified.** It's rendered as a direct child of `<body>` in `src/app/layout.tsx:79`, BEFORE `<LoadingProvider>` containing `{children}`. In React's standard sibling effect ordering, StandaloneSplash's `useEffect` fires before content's effects — which is the saving grace that makes Task 2 partially work (see Finding 1).

### Findings

**Finding 1 — [IMPORTANT] Task 2's event-listener race is plausible; needs defensive guard**

The plan's pattern relies on React firing StandaloneSplash's `useEffect` (which adds the `dopl:content-ready` listener) BEFORE any descendant component's `useEffect` (which dispatches the event). Verified that the current JSX has StandaloneSplash as the first child of `<body>` (`src/app/layout.tsx:79`), so React's sibling source-order rule should put its effect first — listener registered before content dispatches.

**However**, this is brittle against:
- Future JSX reordering (someone moves `<StandaloneSplash />` after `<LoadingProvider>` and the event quietly stops firing)
- Suspense/streaming SSR delaying the splash subtree's hydration
- React concurrent-mode scheduling changes in future versions
- Cold-launch with iOS PWA where SW-controlled hydration can interleave unpredictably

**Defensive fix** — set a global flag in the dispatcher BEFORE firing the event, and have the splash check it on mount:

```tsx
// In each dispatcher (DoplerShell, dashboard/layout, app/page):
useEffect(() => {
  (window as any).__doplContentReady = true;
  window.dispatchEvent(new Event("dopl:content-ready"));
}, []);

// In StandaloneSplash:
useEffect(() => {
  if (!isStandalone) return;
  setShow(true);
  const start = Date.now();
  const dismiss = () => { /* ... */ };

  if ((window as any).__doplContentReady) {
    dismiss();
    return;
  }

  window.addEventListener("dopl:content-ready", dismiss, { once: true });
  const fallback = setTimeout(dismiss, MAX);
  return () => { /* cleanup */ };
}, [isStandalone]);
```

Three lines added; eliminates the ordering dependency entirely. Also covers the case where a navigation re-mounts the splash after content already dispatched.

**Finding 2 — [IMPORTANT] Task 4's `getCachedUser()` signature must be extended (not optional)**

Verified directly against `src/lib/supabase-server.ts:27-33`:

```typescript
export const getCachedUser = cache(async () => {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  return user;  // ← returns user only, NOT { supabase, user }
});
```

The plan's destructuring `const { supabase, user } = await getCachedUser()` will fail at runtime — `user` would resolve to the user object, and `supabase` would be undefined. The plan flags this in an "Important:" callout but reads as conditional ("If the current implementation only returns user, extend it…"). It's not conditional — the extension is required.

**Fix:** Make Step 1 of Task 4 explicit:
```typescript
export const getCachedUser = cache(async () => {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
});
```

Then update the 2 existing callers (whatever currently uses `const user = await getCachedUser()`) to `const { user } = await getCachedUser()`. Run grep to find them; the plan's "Currently only used by 2 files" claim should be verified by the implementer before changing the signature.

**Finding 3 — [IMPORTANT] Task 5's 0ms fetch minimum creates flicker for fast fetches**

Current LoadingProvider patches `window.fetch`:
```typescript
start();
try { return await orig(...args); }
finally { setTimeout(() => stop(), 200); }  // ← 200ms artificial extension
```

The 200ms is an extension AFTER the fetch resolves, not a startup delay. So a 50ms fetch shows the spinner for 250ms total — long enough to register visually.

The aurora itself uses CSS `transition: opacity 420ms ease` (globals.css:320). With 0ms minimum, a 50ms fetch:
- t=0: `start` → count=1 → `active=true` → CSS opacity transition begins
- t=50: fetch resolves → `setTimeout(stop, 0)` scheduled
- t=~54: `stop` → count=0 → `active=false` → opacity transitions back

The spinner gets ~50ms into a 420ms ramp-up, then immediately fades back. Net visible: a soft flicker. For fetches in the 100-300ms band the user flagged, this gets worse — spinner reaches mid-opacity then cuts off. **More jarring than no spinner at all.**

**Suggested fix — pick one:**
- **Option A (simplest):** Reduce min to **100ms** instead of 0ms. Spinner visible for `actualFetchTime + 100ms`, smooths transition without adding meaningful delay.
- **Option B (cleaner UX):** Keep 0ms STOP min but add a **start delay** — only show spinner if the fetch is still pending after ~150ms. Sub-150ms fetches show no spinner at all; longer fetches get the full smooth transition. ~10 lines.

Option B is the standard "loading indicator delay" pattern. Either resolves the flicker; the plan should pick one.

### Other observations

**Nit 1 — Task 4 misses layouts.** Plan modifies 8 page files but none of the layout files. If `src/app/(dashboard)/layout.tsx` (or any layout) calls `supabase.auth.getUser()` directly, those calls share the same request and would benefit from `getCachedUser()` too. Implementer should `grep -rn "supabase.auth.getUser" src/app/` and apply the same fix to layouts. Plan's exit criteria acknowledges this implicitly ("returns only API route files") — just make the layout sweep explicit.

**Nit 2 — Task 3 font-stack literals are redundant after next/font.** After the `var(--font-inter)` swap, the literal `'Inter'` in the body's font-family stack can be removed — next/font's variable already includes Inter and adjusted fallbacks. Optional cleanup; plan can mention it as a follow-on or skip it.

**Nit 3 — Task 2 dispatch semantics.** Dispatching from DoplerShell / dashboard layout / app/page on mount signals "client wrapper mounted," not "content loaded." For pages with heavy server data fetches that suspend, the dispatch fires AFTER the suspense resolves (because the wrapper renders below the suspense boundary). Acceptable for splash-dismiss UX, but worth being honest about in the plan's framing.

### Sprint Containment Check

5 independent perf tasks, no new features, no DB/API/schema changes. Cleanly scoped. ✓

### Verdict: NEEDS REVISION

- **3 important findings**, all small fixes:
  1. Task 2: add the `__doplContentReady` global flag for race-safety (3 lines per dispatcher + 3 lines in splash).
  2. Task 4: make `getCachedUser()` signature extension a required Step 1, not a "verify if needed."
  3. Task 5: replace 0ms with either a 100ms min OR a 150ms start-delay; 0ms causes flicker.
- **3 nits:** layout sweep in Task 4, font-stack cleanup in Task 3, splash event-semantics framing.

All resolvable with plan edits — no task restructuring needed. Re-review after Architect addresses the 3 important findings.

---

## Revision Notes (Round 1 → Round 2)

**Finding 1 addressed:** Task 2 now includes the `__doplContentReady` global flag pattern. Splash checks the flag synchronously on mount before adding the event listener. Dispatchers set the flag before firing the event. Added clarifying note that the dispatch signals "client wrapper mounted" (post-suspense), not "raw data loaded" — which is the correct semantics for splash dismissal.

**Finding 2 addressed:** Task 4 restructured into 3 explicit steps: (1) extend `getCachedUser()` to return `{ supabase, user }`, (2) fix 2 existing callers, (3) migrate all 17 page files (not 8 — grep revealed dashboard sub-pages, notifications, onboarding were missing from the original list). Exit criteria updated to grep verification.

**Finding 3 addressed:** Task 5 now uses Option B — 150ms start delay for fetches. No spinner appears for sub-150ms fetches. Longer fetches get the full smooth CSS transition. Implementation approach specified (setTimeout on fetch start, cancel if fetch resolves first).

**Nit 1 addressed:** Task 4 file list expanded to include layouts and all dashboard sub-pages.
**Nit 2 addressed:** Task 3 files summary mentions optional font-stack literal cleanup.
**Nit 3 addressed:** Task 2 adds explicit note about dispatch semantics.

---

## Plan Review — Round 2 (Instance 2)

**Reviewed:** 2026-04-29
**Round 1 findings:** 3 important, 3 nits

### Round 1 Fix Verification

1. **[IMPORTANT] Task 2 race — RESOLVED.** Defensive flag pattern is complete:
   - Splash useEffect (lines 86-114) checks `(window as any).__doplContentReady` BEFORE adding the listener; dismisses immediately if true.
   - Dispatcher pattern (lines 116-122) sets the flag BEFORE `dispatchEvent` — guaranteeing that even if the event fires before the splash mounts, the splash sees the flag on its first run.
   - Three dispatch sites listed (lines 124-127): DoplerShell, dashboard layout, app/page.
   - Eliminates dependency on React's sibling effect ordering, Suspense streaming, or future scheduler changes. The "set flag THEN dispatch" order is correct.

2. **[IMPORTANT] Task 4 signature — RESOLVED.** Three explicit steps (lines 189-247):
   - Step 1: signature change with full before/after diff. Required, not conditional.
   - Step 2: lists the 2 existing callers (`(dashboard)/layout.tsx:11` and `(dashboard)/dashboard/page.tsx:12`) — verified directly via grep against the codebase, both files do exist and currently destructure the bare user.
   - Step 3: 17-file migration list — **verified exhaustive** via `grep -rln "supabase.auth.getUser" src/app --include="*.tsx"`. Returns exactly 18 files; the 17 in the plan plus `auth/callback/route.ts` which is correctly excluded as a route handler. No missing files.

3. **[IMPORTANT] Task 5 fetch flicker — RESOLVED.** Plan adopts Option B (start delay) over Option A (small min). Lines 265-269 specify: 150ms timeout before `start()` fires; cancel timeout if fetch resolves early; immediate `stop()` after fetch completes if `start()` already fired. The implementation pattern is clear enough — implementer can write it with one boolean flag and one timer. Eliminates the flicker by never starting the animation for fast fetches, rather than starting and immediately reversing it.

### Nits Resolution

- **Nit 1 (layouts in Task 4):** Resolved — list now includes layouts plus all dashboard sub-pages. Verified count matches grep.
- **Nit 2 (font-stack literals):** Resolved — Files Summary line 302 mentions optional cleanup; globals.css explicitly listed as a modify target on line 303.
- **Nit 3 (event semantics):** Resolved — line 84 honestly notes the dispatch fires when the client wrapper mounts, which is "page content is visible" not "data loaded."

### New Issues Check

No critical new issues. Two minor observations (no action needed):

**Observation 1 — Files Summary count off-by-2.** Header says "Modify (23)" but the bullet list contains 25 items (lines 301-325). Trivial counting error; no functional impact. Implementer can fix in passing.

**Observation 2 — Edge-case entry points without dispatchers.** Pages that don't render through DoplerShell, dashboard layout, or app/page (e.g., `/onboarding`, `/welcome`) won't fire the content-ready event. The splash will fall back to the MAX 2000ms timeout for those rare cold-launch entry paths. Acceptable: most users land on `/feed` (dopler) or `/dashboard` (FM); the defensive flag pattern still works for the common path. Could be improved later by adding dispatchers to those routes if it shows up in real usage.

### Verdict: APPROVED

All 3 Round 1 important findings resolved correctly. All 3 nits addressed. Plan is ready for Instance 3.

**Implementer notes:**
- Task 4 Step 1 (signature change) MUST land in the same commit as Step 2 (existing-caller fixes) — separating them produces a TypeScript error in the existing 2 callers between commits.
- Task 4 Step 3 (17-file migration) can be a separate commit after Steps 1+2.
- Task 5 implementation needs: `let pending = false; let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => { pending = true; start(); }, 150);` then in finally: `if (timer) clearTimeout(timer); if (pending) stop();`.
- Task 2 set the global flag BEFORE `dispatchEvent` (order matters — splash checks the flag synchronously before adding its listener).
- Files Summary count is off by 2 (says 23, actually 25) — fix in passing.
