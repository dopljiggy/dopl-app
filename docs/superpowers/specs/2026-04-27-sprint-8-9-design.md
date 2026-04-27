# Sprint 8 + Sprint 9 Design Spec

## Context

Team reviewed the live site on 2026-04-27. Three categories of feedback:

1. **Regulatory** — dopler-side broker/bank OAuth connect may constitute regulated activity. Must be removed immediately. Doplers should only be redirected to their existing broker app.
2. **Performance** — every first page load is slow (2-5 sequential Supabase queries per page, no prefetch, no caching). Revisits are fast (browser-cached RSC payloads).
3. **UX polish** — notification popup overflows on mobile, Dynamic Island overlap on PWA, role-inappropriate CTAs on homepage, notification data not fully passed through.

Additional direction: Apple Sports app as design inspiration for Sprint 9 notification redesign. PWA push notifications for mobile (Safari "Add to Home Screen" on iOS 16.4+).

---

## Sprint 8: Regulatory + Polish + Performance

**Goal:** Remove regulated dopler trading connect, fix UI bugs from team review, improve page load speed.

### Task 1: Remove Dopler Trading Connect

**Delete files (7 API routes + 1 component):**
- `src/app/api/trading/snaptrade/register/route.ts`
- `src/app/api/trading/snaptrade/connect/route.ts`
- `src/app/api/trading/snaptrade/callback/route.ts`
- `src/app/api/trading/saltedge/register/route.ts`
- `src/app/api/trading/saltedge/connect/route.ts`
- `src/app/api/trading/saltedge/callback/route.ts`
- `src/app/api/trading/disconnect/route.ts`
- `src/components/connect/trading-connect.tsx`

**Modify files:**
- `src/app/welcome/welcome-client.tsx` — remove broker connect step from 3-step dopler onboarding (becomes 2-step: welcome → region/preference)
- `src/app/settings/page.tsx` — remove TradingConnect component
- `src/app/notifications/notifications-client.tsx` — remove "connect where you trade" CTA
- `src/components/ui/notification-popup.tsx` — remove "connect your broker to dopl instantly" CTA
- `src/components/ui/notification-bell.tsx` — stop passing `tradingConnected` state
- `src/components/dopler-shell.tsx` — stop fetching `trading_connected` from profiles

**Keep untouched:**
- All FM-side routes (`/api/snaptrade/*`, `/api/saltedge/*`)
- `src/lib/snaptrade.ts`, `src/lib/saltedge.ts` (shared libs)
- `src/lib/broker-deeplinks.ts` (still needed for CTAs)
- DB columns (`trading_provider`, `trading_connected`, `trading_connection_data`) — stay unused

### Task 2: Broker Preference Picker

**What:** Simple dropdown — "which broker do you use?" No OAuth, no account linking. Just stores a name.

**Choices:** Robinhood, Fidelity, Schwab, Webull, Interactive Brokers, Coinbase, Trading 212, Wealthsimple, Other

**Storage:** `profiles.trading_broker_preference` (text, nullable). New column via migration.

**Where it appears:**
- `/settings` page — in a "your broker" section (replaces TradingConnect)
- `/welcome` onboarding — step 2 after welcome message (optional, skippable)

**How it's used:**
- `dopler-shell.tsx` fetches the preference and passes broker name to NotificationBell → NotificationPopup
- `notification-popup.tsx` uses the preference + `buildBrokerTradeUrl()` for deep-link CTAs
- `notifications-client.tsx` uses it for inline "open [broker]" buttons
- If preference is null → show "set your broker" prompt instead of deep-link

### Task 3: Notification Popup Fixes

**Overflow fix:** Add `max-h-[85vh] overflow-y-auto` to the popup inner div to prevent content from going off-screen on mobile.

**Missing data fix:** `notifications-client.tsx` line 91-98 must pass `ticker` and `change_type` to the popup (same fix as Sprint 7 applied to `notification-bell.tsx`).

**Opaque background fix:** Replace `glass-card glass-card-strong` with `bg-[color:var(--dopl-deep-2)]` + border + shadow on the popup inner div (same fix as bell dropdown).

**CTA update:** Replace "connect your broker to dopl instantly" with either:
- Deep-link CTA using broker preference (if set)
- "set your broker" prompt linking to `/settings` (if not set)

### Task 4: Role-Aware Homepage CTAs

**File:** `src/app/marketing-landing.tsx`

**Behavior by role:**

| Element | Logged-out | Dopler | Fund Manager |
|---------|-----------|--------|--------------|
| Primary CTA | "launch your fund" → `/signup` | **"your feed"** → `/feed` | **"your dashboard"** → `/dashboard` |
| Secondary CTA | "get started" → `/signup` | **"discover fund managers"** → `/leaderboard` | "see fund managers" → `/leaderboard` |

The homepage component already receives `viewer.role` from the server page. The change is purely conditional rendering of button labels and hrefs.

### Task 5: PWA Safe Area Insets

**Problem:** `viewport-fit: cover` is set (correct) and `safe-area-inset-bottom` is handled in 4 places, but `safe-area-inset-top` is handled **nowhere**. Content renders behind the Dynamic Island on iPhone PWA.

**Fix:** Add `padding-top: env(safe-area-inset-top)` to the root layout's `<body>` element via inline style or a global CSS rule on `html`/`body`. This pushes all content below the status bar / Dynamic Island.

Also verify the marketing landing page, dopler shell top nav, and dashboard chrome top bar all respect the inset.

### Task 6: Performance

**6a — Parallelize queries:**
Convert sequential Supabase calls to `Promise.all()` on these pages:
- Dashboard page (`page.tsx`): 4 sequential → 2 batches
- Feed page: 5 sequential → 2-3 batches
- Positions page: 3-4 sequential → 2 batches
- Settings page: 3-4 sequential → 2 batches
- Portfolio detail page: 4-5 sequential → 2 batches

**6b — Remove redundant `getUser()`:**
Dashboard layout calls `getUser()`. Every child page calls it again. Options:
- Pass user ID from layout to children (React Server Component prop drilling isn't straightforward across layouts, but we can use a shared cache pattern with `React.cache()`)
- Or use Next.js `unstable_cache` / `React.cache` to deduplicate the Supabase call within a single request

**6c — Link prefetch:**
Enable eager prefetch on primary nav links in `dopler-shell.tsx` and `dashboard-chrome.tsx`. Next.js 16 `<Link>` defaults to viewport-based prefetch; adding `prefetch={true}` eagerly fetches on render.

---

## Sprint 9: Web Push + Apple Sports Design

**Goal:** Real push notifications to mobile PWA, redesign in-app notification experience inspired by Apple Sports.

### Task 1: Web Push Infrastructure

**Dependencies:** `web-push` npm package, VAPID key pair

**New files:**
- `public/sw.js` — service worker: listen for push events, show notification, handle notificationclick → open dopl to relevant page
- `src/app/api/push/subscribe/route.ts` — save push subscription to DB
- `src/app/api/push/unsubscribe/route.ts` — remove push subscription
- `src/app/api/push/send/route.ts` — send push to a user's subscriptions (internal, called by sync logic)
- `src/components/pwa/push-prompt.tsx` — one-time permission prompt in dopler shell

**DB migration:**
```sql
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, endpoint)
);
```

**Env vars:**
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — public, sent to browser
- `VAPID_PRIVATE_KEY` — server-only, signs push messages

**Client flow:**
1. Dopler loads app → `push-prompt.tsx` checks if push is supported and not yet subscribed
2. Shows dismissable prompt: "get notified when your fund managers trade"
3. On accept → `Notification.requestPermission()` → `pushManager.subscribe()` → POST to `/api/push/subscribe`
4. Subscription saved to `push_subscriptions` table

### Task 2: Push Triggers

**When position changes are detected** (SnapTrade sync or manual FM update):
1. Existing notification insert logic writes to `notifications` table
2. After insert, query `push_subscriptions` for all affected subscribers
3. Send web push via `web-push` package with payload:
   - `title`: "AAPL added to [FM name]'s portfolio"
   - `body`: notification body text
   - `icon`: `/apple-touch-icon.png`
   - `data.url`: `/feed/[portfolioId]` or `/notifications`
4. Handle expired/invalid subscriptions (remove from DB on 410 response)

**Service worker notification click:** Opens dopl to the URL in `data.url`.

### Task 3: Apple Sports Card Redesign

**Design language to apply:**
- Bold, large ticker text (mono, 2xl+)
- Tight spacing, minimal chrome
- Buy/sell color accents (lime for buy, a warm tone for sell)
- Glanceable hierarchy: ticker is the largest element, time ago is smallest
- No decorative borders — clean card backgrounds with subtle shadows

**Components to redesign:**
- Bell dropdown notification rows — larger ticker, bolder typography
- Notification popup — cleaner layout, larger ticker card, streamlined CTA stack
- `/notifications` page cards — visual hierarchy refresh, card-based layout
- Consider FM avatar/color theming on cards (stretch goal)

### Task 4: PWA Manifest + Safari Push Verification

**Verify `manifest.json`:**
- `"id": "/"` present (required for iOS push)
- `"display": "standalone"` (required)
- Proper icon sizes (192x192, 512x512)
- `"start_url": "/"` set

**Test matrix:**
- iOS Safari PWA (16.4+): push subscribe, receive notification, tap to open
- Android Chrome: push subscribe, receive, tap
- Desktop: push subscribe, receive, tap

**Badge API:** `navigator.setAppBadge(count)` for unread notification count on the PWA app icon.

**Documentation:** Note in CLAUDE.md or README that push only works via Safari "Add to Home Screen" on iOS, not Chrome on iOS.

---

## What's NOT in scope

- Live Activities / Dynamic Island integration (native iOS only, no web API)
- Custom notification banner styling (iOS always uses system style)
- Stripe US platform account (deferred)
- Write-API mirror trades (regulatory, future)
- Vercel region change (config toggle, no code — Surfer handles separately)
