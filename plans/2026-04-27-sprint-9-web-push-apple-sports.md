**Created:** 2026-04-27
**Status:** approved
**Author:** Instance 1 (Architect)
**Reviewer:** Instance 2 (Reviewer)

# Sprint 9: Web Push + Apple Sports Design — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Real push notifications to mobile PWA (iOS Safari + Android Chrome + desktop), redesign in-app notification experience inspired by Apple Sports (bold tickers, glanceable hierarchy, tight spacing).

**Architecture:** Service worker push event handler + VAPID keys + `push_subscriptions` Supabase table. Push triggers fire after position-change notifications are inserted. Apple Sports-inspired card redesign across bell dropdown, notification popup, and /notifications page.

**Tech Stack:** Next.js 16, Supabase, `web-push` npm, Service Worker Push API, TypeScript, Tailwind CSS v4

**Prerequisites:** Sprint 8 complete (broker preference picker, popup fixes, performance work).

---

### Task 1: DB Migration — Create `push_subscriptions` Table

**Files:**
- Create: `supabase/migrations/20260427_push_subscriptions.sql`

- [ ] **Step 1: Write the migration**

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

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own push subscriptions"
  ON push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260427_push_subscriptions.sql
git commit -m "feat(db): create push_subscriptions table

Stores web push subscriptions per user. RLS ensures users can only
manage their own subscriptions. Used by Sprint 9 push notifications."
```

- [ ] **Step 3: Surfer runs the migration in Supabase SQL editor**

---

### Task 2: Generate VAPID Keys

- [ ] **Step 1: Generate a VAPID key pair**

```bash
npx web-push generate-vapid-keys
```

This outputs a public key and private key. Both are base64url strings.

- [ ] **Step 2: Add to environment**

Add to `.env.local`:
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public key from step 1>
VAPID_PRIVATE_KEY=<private key from step 1>
```

Add to `.env.example`:
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
```

- [ ] **Step 3: Add to Vercel environment variables**

Surfer adds both env vars in the Vercel dashboard. `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is exposed to the client. `VAPID_PRIVATE_KEY` is server-only.

- [ ] **Step 4: Install web-push package**

```bash
npm install web-push
npm install -D @types/web-push
```

- [ ] **Step 5: Commit**

```bash
git add .env.example package.json package-lock.json
git commit -m "feat: add web-push dependency and VAPID env var placeholders

web-push package for server-side push message signing.
VAPID keys stored as env vars — public key exposed to client."
```

---

### Task 3: Push Subscribe/Unsubscribe API Routes

**Files:**
- Create: `src/app/api/push/subscribe/route.ts`
- Create: `src/app/api/push/unsubscribe/route.ts`

- [ ] **Step 1: Write the subscribe route**

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { endpoint, keys } = body;

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json(
      { error: "Invalid subscription" },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
    { onConflict: "user_id,endpoint" }
  );

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Write the unsubscribe route**

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { endpoint } = body;

  if (!endpoint) {
    return NextResponse.json(
      { error: "Missing endpoint" },
      { status: 400 }
    );
  }

  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/push/
git commit -m "feat: add push subscribe/unsubscribe API routes

POST /api/push/subscribe upserts a push subscription.
POST /api/push/unsubscribe removes it by endpoint."
```

---

### Task 4: Shared Push Module + API Route

**Files:**
- Create: `src/lib/push.ts` (shared push logic)
- Create: `src/app/api/push/send/route.ts` (thin API wrapper — for manual/debug use only)

The core push logic lives in a shared module so `notification-fanout.ts` can call it directly without an HTTP round-trip. The API route wraps it for manual testing.

- [ ] **Step 1: Write the shared push module**

```typescript
// src/lib/push.ts
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase-admin";

let vapidConfigured = false;

function ensureVapid() {
  if (vapidConfigured) return;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return;
  webpush.setVapidDetails("mailto:pirates@teamdopl.com", pub, priv);
  vapidConfigured = true;
}

export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  url: string
): Promise<{ sent: number; expired: number }> {
  ensureVapid();
  if (!vapidConfigured) return { sent: 0, expired: 0 };

  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (!subs?.length) return { sent: 0, expired: 0 };

  const payload = JSON.stringify({
    title,
    body,
    icon: "/apple-touch-icon.png",
    data: { url },
  });

  let sent = 0;
  const expired: string[] = [];

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload
      );
      sent++;
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 410 || status === 404) {
        expired.push(sub.id);
      }
    }
  }

  if (expired.length) {
    await admin.from("push_subscriptions").delete().in("id", expired);
  }

  return { sent, expired: expired.length };
}
```

- [ ] **Step 2: Write the API route wrapper**

```typescript
// src/app/api/push/send/route.ts
import { NextResponse, type NextRequest } from "next/server";
import crypto from "crypto";
import { sendPushToUser } from "@/lib/push";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`;
  const a = Buffer.from(authHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { userId, title, body: pushBody, url } = body;

  if (!userId || !title) {
    return NextResponse.json(
      { error: "Missing userId or title" },
      { status: 400 }
    );
  }

  const result = await sendPushToUser(
    userId,
    title,
    pushBody ?? "",
    url ?? "/notifications"
  );

  return NextResponse.json(result);
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 4: Commit**

```bash
git add src/lib/push.ts src/app/api/push/send/route.ts
git commit -m "feat: shared push module + API route wrapper

Core push logic in src/lib/push.ts — called directly from
notification-fanout.ts without HTTP round-trip. API route wraps
it for manual/debug use with timing-safe auth."
```

---

### Task 5: Service Worker Push Handler

**Files:**
- Modify: `public/sw.js`

- [ ] **Step 1: Add push event and notificationclick handlers**

Append to the end of `public/sw.js`:

```javascript
/* Web Push — Sprint 9 */
self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const payload = event.data.json();
    const options = {
      body: payload.body || "",
      icon: payload.icon || "/apple-touch-icon.png",
      badge: "/icons/icon-96x96.png",
      data: payload.data || {},
    };
    event.waitUntil(self.registration.showNotification(payload.title, options));
  } catch {
    // Malformed payload — ignore.
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            // iOS Safari doesn't support client.navigate() — use
            // postMessage and let the client-side handler navigate.
            client.postMessage({ type: "PUSH_NAV", url });
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      })
  );
});
```

Also bump the `CACHE_NAME` version:
```javascript
const CACHE_NAME = "dopl-shell-v22";
```

- [ ] **Step 2: Commit**

```bash
git add public/sw.js
git commit -m "feat(sw): add push event and notificationclick handlers

Service worker now shows notifications from push events and opens
the target URL on click. Bump cache version to v22."
```

---

### Task 6: Push Permission Prompt Component

**Files:**
- Create: `src/components/pwa/push-prompt.tsx`

- [ ] **Step 1: Write the push prompt component**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";

export default function PushPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (!("serviceWorker" in navigator)) return;
    if (Notification.permission !== "default") return;
    if (localStorage.getItem("dopl-push-dismissed")) return;

    const timer = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const subscribe = async () => {
    setShow(false);
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      userVisibleOnly: true,
    });

    const serialized = sub.toJSON();
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: serialized.endpoint,
        keys: serialized.keys,
      }),
    });
  };

  const dismiss = () => {
    setShow(false);
    localStorage.setItem("dopl-push-dismissed", "1");
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-32 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-80 z-50">
      <div className="bg-[color:var(--dopl-deep-2)] border border-[color:var(--glass-border-strong)] rounded-2xl p-4 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)]">
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 text-[color:var(--dopl-cream)]/40 hover:text-[color:var(--dopl-cream)]"
        >
          <X size={14} />
        </button>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[color:var(--dopl-lime)]/12 border border-[color:var(--dopl-lime)]/25 flex items-center justify-center text-[color:var(--dopl-lime)] shrink-0">
            <Bell size={18} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold mb-1">
              get notified when your fund managers trade
            </p>
            <p className="text-xs text-[color:var(--dopl-cream)]/50 mb-3">
              push notifications for position changes. works best as a home screen app.
            </p>
            <button
              onClick={subscribe}
              className="btn-lime text-xs px-4 py-2"
            >
              enable notifications
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into DoplerShell**

In `src/components/dopler-shell.tsx`, import and render `PushPrompt` inside the shell, and add a `useEffect` to listen for `PUSH_NAV` messages from the service worker (iOS Safari doesn't support `client.navigate()`, so the SW posts a message instead):

```tsx
import PushPrompt from "@/components/pwa/push-prompt";

// Inside the component body, add the SW message listener:
useEffect(() => {
  const onMessage = (event: MessageEvent) => {
    if (event.data?.type === "PUSH_NAV" && event.data.url) {
      window.location.href = event.data.url;
    }
  };
  navigator.serviceWorker?.addEventListener("message", onMessage);
  return () => navigator.serviceWorker?.removeEventListener("message", onMessage);
}, []);

// ... at the end of the return, before closing </NotificationsProvider>:
<PushPrompt />
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 4: Commit**

```bash
git add src/components/pwa/push-prompt.tsx src/components/dopler-shell.tsx
git commit -m "feat: add push notification permission prompt

Shows a dismissable prompt to doplers after 3 seconds if push
permission is 'default'. Subscribes to push via service worker
and saves subscription to /api/push/subscribe."
```

---

### Task 7: Push Trigger After Notification Insert

**Files:**
- Modify: `src/lib/notification-fanout.ts`

The centralized notification fan-out lives in `src/lib/notification-fanout.ts`. The function `fanOutPortfolioUpdate()` inserts notification rows at line 181 (`admin.from("notifications").insert(notifRows)`). Each row has a `user_id` (the subscriber). After the insert, we fan out push to each unique subscriber.

- [ ] **Step 1: Import sendPushToUser and add push fan-out after the notification insert**

In `src/lib/notification-fanout.ts`, add the import at the top:

```typescript
import { sendPushToUser } from "@/lib/push";
```

Then after line 181 (`await admin.from("notifications").insert(notifRows)`), add the push fan-out. Calls the shared module directly — no HTTP round-trip:

```typescript
  if (notifRows.length > 0) {
    await admin.from("notifications").insert(notifRows);

    // Best-effort web push to every notified subscriber.
    const uniqueUserIds = [...new Set(notifRows.map((r) => r.user_id))];
    await Promise.allSettled(
      uniqueUserIds.map((uid) => {
        const row = notifRows.find((r) => r.user_id === uid);
        return sendPushToUser(
          uid,
          row?.title ?? "Portfolio Update",
          row?.body ?? "",
          `/feed/${input.portfolio_id}`
        );
      })
    );
  }
```

`Promise.allSettled` ensures a failing push to one subscriber doesn't block others.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/
git commit -m "feat: trigger web push after dopler notification insert

After position-change notifications are written to the DB, fan out
web push to all of the subscriber's push subscriptions. Best-effort —
push failures don't block the sync."
```

---

### Task 8: Extract Shared `timeAgo` Utility

**Files:**
- Create: `src/lib/time-ago.ts`
- Modify: `src/components/ui/notification-popup.tsx` (remove local `timeAgo`, import shared)
- Modify: `src/app/notifications/notifications-client.tsx` (remove local `timeAgo`, import shared)

`timeAgo` is duplicated in notification-popup.tsx (format: "5m ago") and notifications-client.tsx (format: "5m"). The bell dropdown will also need it. Extract to one shared function with a consistent format (short, no "ago" suffix — matches Apple Sports' terse style).

- [ ] **Step 1: Create the shared utility**

```typescript
// src/lib/time-ago.ts
export function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
```

- [ ] **Step 2: Replace local copies in notification-popup.tsx and notifications-client.tsx**

In both files, delete the local `function timeAgo(...)` definition and add:

```typescript
import { timeAgo } from "@/lib/time-ago";
```

In `notification-popup.tsx`, update the call from `timeAgo(notification.created_at)` — it currently returns `"5m ago"` format. The shared version returns `"5m"`. No other changes needed since the surrounding UI just renders the string.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 4: Commit**

```bash
git add src/lib/time-ago.ts src/components/ui/notification-popup.tsx src/app/notifications/notifications-client.tsx
git commit -m "refactor: extract timeAgo to shared utility

Removes 2 duplicate definitions. Consistent terse format (5m, 2h, 3d)
across popup, notifications page, and bell dropdown."
```

---

### Task 9: Apple Sports Card Redesign — Notification Bell Dropdown

**Files:**
- Modify: `src/components/ui/notification-bell.tsx`

The Apple Sports design language: bold mono ticker as largest element, minimal chrome, tight spacing, buy/sell color accents (lime for buy, warm for sell), time-ago is smallest.

- [ ] **Step 1: Redesign the notification row in the bell dropdown**

Replace the inner content of the `<div className="max-h-[70vh] overflow-y-auto space-y-1">` wrapper (lines 135-167 in `notification-bell.tsx`). Keep the `max-h-[70vh] overflow-y-auto space-y-1` wrapper div itself — only replace the `.map()` block inside it:

```tsx
{notifications.slice(0, 8).map((n) => {
  const ticker = n.ticker;
  const isSell = n.change_type === "sell";
  return (
    <button
      key={n.id}
      type="button"
      onClick={() => {
        setPopup({
          id: n.id,
          title: n.title,
          body: n.body,
          created_at: n.created_at,
          actionable: n.actionable,
          meta: n.meta,
          ticker: n.ticker,
          change_type: n.change_type,
        });
        setOpen(false);
      }}
      className={`w-full text-left p-3 rounded-xl hover:bg-[color:var(--dopl-sage)]/25 transition-colors ${
        !n.read
          ? "border-l-2 border-[color:var(--dopl-lime)]"
          : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        {ticker ? (
          <span
            className={`font-mono text-lg font-bold ${
              isSell
                ? "text-amber-400"
                : "text-[color:var(--dopl-lime)]"
            }`}
          >
            {ticker}
          </span>
        ) : (
          <span className="text-sm font-semibold">{n.title}</span>
        )}
        <span className="text-[10px] text-[color:var(--dopl-cream)]/30 font-mono shrink-0">
          {timeAgo(n.created_at)}
        </span>
      </div>
      {ticker && (
        <p className="text-xs font-semibold text-[color:var(--dopl-cream)]/70">
          {n.title}
        </p>
      )}
      {n.body && (
        <p className="text-[11px] text-[color:var(--dopl-cream)]/40 mt-0.5 line-clamp-1">
          {n.body}
        </p>
      )}
    </button>
  );
})}
```

Import the shared `timeAgo` at the top of the file:

```typescript
import { timeAgo } from "@/lib/time-ago";
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/notification-bell.tsx
git commit -m "design: Apple Sports-inspired bell dropdown notification cards

Bold mono ticker as largest element, buy/sell color accents (lime/amber),
time-ago smallest, tight spacing. Minimal chrome."
```

---

### Task 10: Apple Sports Card Redesign — Notification Popup

**Files:**
- Modify: `src/components/ui/notification-popup.tsx`

- [ ] **Step 1: Redesign the ticker card**

Replace the ticker card section (the `glass-card-light` div around lines 153-168) with a bolder Apple Sports-style card:

```tsx
{ticker && (
  <div className="rounded-xl p-4 mb-5 bg-[color:var(--dopl-sage)]/15">
    <div className="flex items-baseline justify-between">
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/40 mb-1">
          {notification.change_type === "sell" ? "sold" : "added"}
        </p>
        <p
          className={`font-mono text-3xl font-bold ${
            notification.change_type === "sell"
              ? "text-amber-400"
              : "text-[color:var(--dopl-lime)]"
          }`}
        >
          {ticker}
        </p>
      </div>
      <span className="text-[10px] text-[color:var(--dopl-cream)]/30 font-mono">
        {timeAgo(notification.created_at)}
      </span>
    </div>
  </div>
)}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/notification-popup.tsx
git commit -m "design: Apple Sports-inspired notification popup ticker card

Larger 3xl bold mono ticker, buy/sell color accents, cleaner bg,
tighter layout. Time-ago in smallest size."
```

---

### Task 11: Apple Sports Card Redesign — Notifications Page

**Files:**
- Modify: `src/app/notifications/notifications-client.tsx`

- [ ] **Step 1: Redesign the notification card rows**

Replace the notification card content inside the `motion.div` (lines 82-185) with bolder Apple Sports-inspired cards:

```tsx
{notifications.map((n) => {
  const ticker = n.ticker ?? extractTicker(n.body);
  const isCopied = copied === n.id;
  const isSell = n.change_type === "sell";
  return (
    <motion.div
      key={n.id}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={`rounded-xl p-4 cursor-pointer transition-colors bg-[color:var(--dopl-sage)]/10 hover:bg-[color:var(--dopl-sage)]/20 ${
        !n.read ? "border-l-2 border-[color:var(--dopl-lime)]" : ""
      }`}
      onClick={() =>
        setPopup({
          id: n.id,
          title: n.title,
          body: n.body,
          created_at: n.created_at,
          actionable: n.actionable,
          meta: n.meta,
          ticker: n.ticker,
          change_type: n.change_type,
        })
      }
    >
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-3">
          {ticker ? (
            <span
              className={`font-mono text-2xl font-bold ${
                isSell
                  ? "text-amber-400"
                  : "text-[color:var(--dopl-lime)]"
              }`}
            >
              {ticker}
            </span>
          ) : (
            <span className="text-sm font-semibold">{n.title}</span>
          )}
          {n.meta?.manual === true && (
            <span className="text-[9px] uppercase tracking-[0.2em] font-mono text-[color:var(--dopl-cream)]/40 border border-[color:var(--dopl-cream)]/20 px-1.5 py-0.5 rounded-md">
              manual
            </span>
          )}
        </div>
        <span className="text-[10px] text-[color:var(--dopl-cream)]/30 font-mono shrink-0">
          {timeAgo(n.created_at)}
        </span>
      </div>

      {ticker && (
        <p className="text-sm font-semibold text-[color:var(--dopl-cream)]/70 mb-0.5">
          {n.title}
        </p>
      )}

      {n.body && (
        <p className="text-xs text-[color:var(--dopl-cream)]/40">
          {n.body}
        </p>
      )}

      {n.actionable === false ? (
        <div className="mt-2 text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/40 font-mono">
          informational
        </div>
      ) : (
        <div
          className="mt-3 flex flex-wrap gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          {ticker && (
            <button
              onClick={() => copyTicker(ticker, n.id)}
              className="px-3 py-1.5 text-xs rounded-lg bg-[color:var(--dopl-sage)]/20 hover:bg-[color:var(--dopl-sage)]/40 transition-colors inline-flex items-center gap-1.5"
            >
              {isCopied ? (
                <>
                  <Check
                    size={12}
                    className="text-[color:var(--dopl-lime)]"
                  />
                  copied
                </>
              ) : (
                <>
                  <Copy size={12} />
                  copy {ticker}
                </>
              )}
            </button>
          )}

          {brokerPreference && brokerPreference !== "Other" ? (
            <a
              href={
                buildBrokerTradeUrl(
                  brokerPreference,
                  getBrokerHomepage(brokerPreference),
                  ticker
                ) ?? getBrokerHomepage(brokerPreference) ?? "#"
              }
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 text-xs rounded-lg bg-[color:var(--dopl-lime)]/10 hover:bg-[color:var(--dopl-lime)]/20 transition-colors inline-flex items-center gap-1.5 text-[color:var(--dopl-lime)]"
            >
              <ExternalLink size={12} />
              open {brokerPreference}
            </a>
          ) : !brokerPreference ? (
            <Link
              href="/settings"
              className="px-3 py-1.5 text-xs rounded-lg hover:bg-[color:var(--dopl-lime)]/10 transition-colors inline-flex items-center gap-1.5 text-[color:var(--dopl-cream)]/50 hover:text-[color:var(--dopl-lime)]"
            >
              <Link2 size={12} />
              set your broker
            </Link>
          ) : null}
        </div>
      )}
    </motion.div>
  );
})}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add src/app/notifications/notifications-client.tsx
git commit -m "design: Apple Sports-inspired notification page cards

Bold 2xl mono ticker, buy/sell color accents (lime/amber),
cleaner card backgrounds, tighter spacing. Glanceable hierarchy
with ticker largest, time-ago smallest."
```

---

### Task 12: Badge API for PWA App Icon

**Files:**
- Modify: `src/components/dopler-shell.tsx`

- [ ] **Step 1: Add badge count sync**

In `dopler-shell.tsx`, add a `useEffect` that sets the app badge when unread count changes:

```tsx
useEffect(() => {
  if ("setAppBadge" in navigator) {
    if (unreadCount > 0) {
      navigator.setAppBadge(unreadCount).catch(() => {});
    } else {
      navigator.clearAppBadge().catch(() => {});
    }
  }
}, [unreadCount]);
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add src/components/dopler-shell.tsx
git commit -m "feat(pwa): sync unread notification count to app badge

Uses navigator.setAppBadge/clearAppBadge to show unread count
on the PWA home screen icon."
```

---

### Task 13: Final Build + Test

- [ ] **Step 1: Full build verification**

```bash
npm run build
```

Expected: Clean build, no TypeScript errors.

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 3: Final commit if any cleanup needed**

---

## Manual Smoke Checks (Surfer on prod after merge)

### Push Notifications
1. Open dopl on iPhone Safari → Add to Home Screen → open PWA
2. See push permission prompt after 3 seconds
3. Tap "enable notifications" → iOS permission dialog appears → allow
4. Trigger a position change (fund manager side) → receive push notification on phone
5. Tap the push notification → dopl opens to the relevant portfolio page
6. Check unread badge count appears on the PWA app icon

### Apple Sports Design
7. Open bell dropdown — notification cards show bold mono ticker, lime/amber accents
8. Tap a notification — popup shows large 3xl ticker, clean opaque background
9. Open /notifications page — card rows show bold 2xl ticker, tighter layout
10. Sell notifications show amber color, buy notifications show lime

### Cross-Platform
11. Android Chrome: install PWA, enable push, receive notification, tap to open
12. Desktop browser: enable push, receive notification, tap to open

### Edge Cases
13. Dismiss push prompt → doesn't reappear on refresh (localStorage)
14. Deny push permission → prompt doesn't show again (Notification.permission check)
15. Push while app is open → toast listener still fires (push is supplementary)

---

## Review Notes (Instance 2, Round 1)

**Date:** 2026-04-28
**Reviewed against:** Current codebase on main (post-Sprint 8 hotfixes)

### Critical 1: iOS Safari `client.navigate()` not supported in service worker notificationclick

**Severity:** Critical
**Location:** Task 5, `notificationclick` handler

`Client.navigate()` is not implemented in Safari's service worker (iOS 16.4+). The plan's `client.navigate(url)` call will throw silently on iPhone, meaning tapping a push notification does nothing — the app's primary mobile target is broken.

**Fix:** Replace `client.navigate(url)` with `client.postMessage({ type: "dopl-navigate", url })` + `client.focus()`. Add a corresponding `message` event listener in `dopler-shell.tsx` that handles `dopl-navigate` by setting `window.location.href`. Example:

Service worker:
```javascript
for (const client of clientList) {
  if (client.url.includes(self.location.origin) && "focus" in client) {
    client.postMessage({ type: "dopl-navigate", url });
    return client.focus();
  }
}
return self.clients.openWindow(url);
```

DoplerShell (new useEffect):
```typescript
useEffect(() => {
  const handler = (e: MessageEvent) => {
    if (e.data?.type === "dopl-navigate") {
      window.location.href = e.data.url;
    }
  };
  navigator.serviceWorker?.addEventListener("message", handler);
  return () => navigator.serviceWorker?.removeEventListener("message", handler);
}, []);
```

This needs a new task (or additions to Tasks 5 and 6) for the client-side listener.

---

### Important 1: Self-HTTP-request pattern for push fan-out is fragile and slow

**Severity:** Important
**Location:** Task 7

`fanOutPortfolioUpdate()` calls `fetch(\`${appUrl}/api/push/send\`)` — the server calling itself over HTTP. Problems:
- On Vercel, this spawns a *separate* serverless invocation per subscriber, doubling cold-start cost
- 500 subscribers = 500 HTTP round-trips inside `Promise.allSettled`, likely hitting function timeout
- `NEXT_PUBLIC_APP_URL` mismatches on preview deployments
- Unnecessary — the push logic can be imported directly since both run server-side with admin credentials

**Fix:** Extract push logic into `src/lib/push-send.ts`:
```
export async function sendPushToUser(admin, userId, { title, body, url })
  → reads push_subscriptions, calls webpush.sendNotification, cleans expired
```

Call directly from `fanOutPortfolioUpdate`. Keep the HTTP route as a thin wrapper for debugging. This eliminates the self-HTTP pattern and the per-user round-trips.

---

### Important 2: Push send route needs timing-safe comparison

**Severity:** Important
**Location:** Task 4, line 228

`authHeader !== \`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}\`` is vulnerable to timing attacks. The route is publicly reachable (not "internal-only" in practice). An attacker can oracle the service role key byte-by-byte.

**Fix:** Use `crypto.timingSafeEqual`:
```typescript
import { timingSafeEqual } from "crypto";
const expected = Buffer.from(`Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`);
const actual = Buffer.from(authHeader ?? "");
if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

---

### Important 3: Task 8 bell dropdown snippet misaligned with current code

**Severity:** Important
**Location:** Task 8

The plan says "Replace the notification row button (lines 140-170)" but:
- Current rows are at lines 136-166 inside `<div className="max-h-[70vh] overflow-y-auto space-y-1">`
- The plan's snippet includes `{notifications.slice(0, 8).map(...)}` which already exists at line 136
- Taking the snippet literally would either nest the map or lose the `max-h-[70vh]` overflow wrapper

**Fix:** Clarify that the replacement target is the `<button>` element inside the existing `.map()` callback (lines 137-165), not the entire map. Keep the existing `<div className="max-h-[70vh] overflow-y-auto space-y-1">` and `notifications.slice(0, 8).map(...)` wrapper intact.

---

### Important 4: `timeAgo` duplicated 3× with inconsistent format

**Severity:** Important
**Location:** Tasks 8, 9, 10

The plan adds a *third* copy of `timeAgo` to `notification-bell.tsx`. Current state:
- `notification-popup.tsx:260` → returns `"5m ago"` (with " ago" suffix)
- `notifications-client.tsx:206` → returns `"5m"` (no suffix)
- New in Task 8 → returns `"5m"` (no suffix)

The popup will say "5m ago" while the bell and page say "5m" — looks like a bug.

**Fix:** Extract to `src/lib/time-ago.ts` with a single consistent format. Import in all three files. Pick one format (recommend `"5m"` — shorter, Apple Sports style).

---

### Minor issues (non-blocking)

1. **Task 7 step numbering:** Steps go 1, 3, 4 — Step 2 is missing.
2. **Task 7 git add:** Says `git add src/app/api/` but the modified file is `src/lib/notification-fanout.ts`.
3. **Task 10 line range:** Says "lines 82-185" but the notification map in current `notifications-client.tsx` spans lines 75-191.
4. **Task 11 TypeScript:** `navigator.setAppBadge` / `navigator.clearAppBadge` are not on the standard `Navigator` type. Build will fail without a global type augmentation (e.g., `declare global { interface Navigator { setAppBadge?(count: number): Promise<void>; clearAppBadge?(): Promise<void>; } }`). Plan should specify the approach.

---

### Approval summary

1 critical issue (iOS notificationclick), 4 important issues. The push infrastructure is solid in concept but the self-HTTP pattern and iOS Safari incompatibility need to be addressed before implementation.

**Status: needs-revision.** Awaiting Round 2.

---

## Review Notes (Instance 2, Round 2)

**Date:** 2026-04-28
**Reviewed against:** Revised plan (all 5 Round 1 findings addressed)

### Critical 1 (iOS `client.navigate()`) — VERIFIED FIXED

Task 5 now uses `client.postMessage({ type: "PUSH_NAV", url })` + `client.focus()` instead of `client.navigate(url)`. Task 6 Step 2 adds the matching `PUSH_NAV` message listener in `dopler-shell.tsx` that navigates via `window.location.href`. Message type `"PUSH_NAV"` is consistent between SW and client. Both the service worker side and client-side handler are in the correct tasks.

---

### Important 1 (self-HTTP pattern) — VERIFIED FIXED

Task 4 now creates `src/lib/push.ts` with `sendPushToUser()` as a direct-import module. Task 7 imports and calls it inline from `fanOutPortfolioUpdate()` — no HTTP round-trip, no self-request, no Vercel double-invocation. The API route in Task 4 Step 2 is explicitly scoped as "thin API wrapper — for manual/debug use only." Clean separation.

---

### Important 2 (timing-safe comparison) — VERIFIED FIXED

Task 4 Step 2 API route uses `crypto.timingSafeEqual` with `Buffer.from` on both operands and a length pre-check. Correct implementation.

---

### Important 3 (bell dropdown snippet alignment) — VERIFIED FIXED

Task 9 Step 1 now explicitly says "Keep the `max-h-[70vh] overflow-y-auto space-y-1` wrapper div itself — only replace the `.map()` block inside it." Correct — the implementer knows the wrapper stays and only the inner map content changes.

---

### Important 4 (`timeAgo` duplication) — VERIFIED FIXED

New Task 8 extracts `timeAgo` to `src/lib/time-ago.ts` with terse format (`"5m"`, no " ago" suffix). Step 2 removes local copies from both `notification-popup.tsx` and `notifications-client.tsx`. Task 9 imports the shared version for the bell. All three consumers will use the same format. Correct.

---

### Minor issues from Round 1 (still present, still non-blocking)

1. **Task 7 step numbering** still skips Step 2 (goes 1, 3, 4). Cosmetic.
2. **Task 7 git add** still says `git add src/app/api/` — should be `git add src/lib/notification-fanout.ts`. Implementer will notice.
3. **Task 11 line range** still says "lines 82-185" — after Task 8's `timeAgo` extraction shifts line numbers, this will be even more off. Snippet itself is clear enough.
4. **Task 12 `navigator.setAppBadge` TypeScript** — no type augmentation specified. Implementer should add a global declaration or `@ts-expect-error`. Build will catch this.

None of these are blocking. The implementer can handle all four without ambiguity.

---

### New observations (non-blocking)

1. **Task 4 `push.ts` creates its own admin client** via `createAdminClient()` rather than accepting the caller's `admin` parameter. This is fine — `fanOutPortfolioUpdate`'s `admin` is typed as `FanoutClient` (narrowed to `Pick<SupabaseClient, "from">`), and the push module needs the full admin client. Separate admin creation keeps concerns clean.

2. **Push fan-out is `Promise.allSettled` per unique user, but `sendPushToUser` is sequential per subscription** (the `for...of` loop inside `push.ts`). For a user with many devices (3-4 subscriptions), the inner loop is negligible. For a portfolio with 500 subscribers, the outer `allSettled` runs 500 concurrent `sendPushToUser` calls, each creating its own admin client. This is fine for launch scale but worth revisiting if subscriber counts grow significantly — a batched approach or queue would be more efficient. Not a blocker for Sprint 9.

3. **`ensureVapid()` with module-level `let vapidConfigured`** — correct pattern for Vercel serverless (module state persists within a warm invocation but resets on cold start). `ensureVapid` re-checks env vars each time if not yet configured. No issue.

---

### Approval summary

All 5 Round 1 issues resolved correctly. No new critical or important issues found. The plan has 13 well-ordered tasks with proper dependency sequencing: DB migration → VAPID setup → subscribe/unsubscribe routes → shared push module → service worker → push prompt + client listener → fan-out trigger → timeAgo extraction → Apple Sports redesign (bell → popup → page) → badge API → final build.

Ready for implementation on a feature branch.

>>> REPORT FOR ARCHITECT >>> Plan review Round 2 complete. All 5 findings verified fixed. Status set to `approved`. 4 non-blocking minor notes carried forward for implementer awareness. Ready for Instance 3.
