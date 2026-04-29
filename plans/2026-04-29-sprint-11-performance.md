**Status:** under-review

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

**Change:** Replace the timer with a dismiss-on-ready pattern:
- Keep a minimum display of **400ms** (prevents a jarring flash if content loads instantly)
- Set a maximum of **2000ms** (timeout fallback if content never signals ready)
- Listen for a custom event `dopl:content-ready` dispatched by the first meaningful page component

```tsx
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

  window.addEventListener("dopl:content-ready", dismiss, { once: true });
  const fallback = setTimeout(dismiss, MAX);
  return () => {
    window.removeEventListener("dopl:content-ready", dismiss);
    clearTimeout(fallback);
  };
}, [isStandalone]);
```

**Dispatch the event** from each page's client boundary component (DoplerShell, dashboard layout, etc.) after mount:
```tsx
useEffect(() => {
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

**File:** 8 page files that call `getUser()` directly.

`getCachedUser()` already exists in `src/lib/supabase-server.ts` — it uses React's `cache()` to deduplicate `getUser()` calls within a single server request. Currently only used by 2 files.

**Change in each of the 8 page files:**

Replace:
```tsx
const supabase = await createServerSupabase();
const { data: { user } } = await supabase.auth.getUser();
```

With:
```tsx
const { supabase, user } = await getCachedUser();
```

**Files to update:**
1. `src/app/page.tsx`
2. `src/app/feed/page.tsx`
3. `src/app/feed/[portfolioId]/page.tsx`
4. `src/app/settings/page.tsx`
5. `src/app/welcome/page.tsx`
6. `src/app/me/page.tsx`
7. `src/app/[handle]/page.tsx`
8. `src/app/(public)/leaderboard/page.tsx`

**Important:** Verify `getCachedUser()` returns both the supabase client AND user — the pages need the client for subsequent queries. If the current implementation only returns user, extend it to return `{ supabase, user }`.

**Do NOT change API routes** — they handle independent requests and should each create their own auth context.

**Exit criteria:** `grep -r "supabase.auth.getUser" src/app/` returns only API route files, not page files. Pages that share a layout (e.g., `/dashboard/*`) make only one auth round-trip per request.

**Depends on:** None

---

## Task 5: Aurora Loader — Reduce Minimum Display Times

**Modify:** `src/components/ui/aurora-loader.tsx`

**Current:**
- Route change: 420ms minimum animation (line ~58)
- Fetch: 200ms minimum display (line ~77)

**Change:**
- Route change: reduce to **150ms** — still visible for slow transitions, but doesn't add perceptible delay for fast ones
- Fetch: reduce to **0ms** (remove the minimum) — if a fetch completes in 50ms, don't show a spinner at all. The `loading.tsx` skeletons handle the initial page load; the aurora should only appear for genuinely slow navigations.

**Exit criteria:** Fast page navigations (sub-200ms server response) don't show the aurora loader. Slow navigations (>150ms) still show it. Fetch calls don't trigger a visible spinner unless they're genuinely slow.

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

**Modify (11):**
- `src/app/layout.tsx` — replace Google Fonts link with next/font imports
- `src/components/pwa/standalone-splash.tsx` — dismiss-on-ready
- `src/components/ui/aurora-loader.tsx` — reduce minimums
- `src/components/dopler-shell.tsx` — dispatch content-ready event
- `src/app/(dashboard)/dashboard/layout.tsx` — dispatch content-ready event
- `src/app/page.tsx` — getCachedUser + dispatch content-ready
- `src/app/feed/page.tsx` — getCachedUser
- `src/app/feed/[portfolioId]/page.tsx` — getCachedUser
- `src/app/settings/page.tsx` — getCachedUser
- `src/app/welcome/page.tsx` — getCachedUser
- `src/app/me/page.tsx` — getCachedUser
- `src/app/[handle]/page.tsx` — getCachedUser
- `src/app/(public)/leaderboard/page.tsx` — getCachedUser

**Unchanged but relevant:**
- `src/lib/supabase-server.ts` — getCachedUser() already exists (may need to return supabase client too)
- API route files — keep direct getUser() (independent requests)

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
