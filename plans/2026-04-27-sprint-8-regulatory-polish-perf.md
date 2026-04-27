**Created:** 2026-04-27
**Status:** implemented
**Author:** Instance 1 (Architect)
**Reviewer:** Instance 2 (Reviewer)

# Sprint 8: Regulatory + Polish + Performance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove dopler-side broker/bank OAuth connect (regulatory), add broker preference picker, fix notification popup bugs, make homepage CTAs role-aware, fix PWA Dynamic Island overlap, and parallelize Supabase queries for faster page loads.

**Architecture:** Delete 7 API routes + 1 component for regulatory compliance. Replace with a simple broker preference picker (text column, no OAuth). Fix three notification popup bugs (overflow, missing data, opaque background). Add role-aware CTAs to homepage. Add `safe-area-inset-top` to root layout. Convert sequential Supabase queries to `Promise.all()` batches on 5 pages.

**Tech Stack:** Next.js 16, Supabase, TypeScript, Tailwind CSS v4

---

### Task 1: Delete Dopler Trading API Routes

**Files:**
- Delete: `src/app/api/trading/snaptrade/register/route.ts`
- Delete: `src/app/api/trading/snaptrade/connect/route.ts`
- Delete: `src/app/api/trading/snaptrade/callback/route.ts`
- Delete: `src/app/api/trading/saltedge/register/route.ts`
- Delete: `src/app/api/trading/saltedge/connect/route.ts`
- Delete: `src/app/api/trading/saltedge/callback/route.ts`
- Delete: `src/app/api/trading/disconnect/route.ts`

- [ ] **Step 1: Delete the 7 API route files**

```bash
rm src/app/api/trading/snaptrade/register/route.ts
rm src/app/api/trading/snaptrade/connect/route.ts
rm src/app/api/trading/snaptrade/callback/route.ts
rm src/app/api/trading/saltedge/register/route.ts
rm src/app/api/trading/saltedge/connect/route.ts
rm src/app/api/trading/saltedge/callback/route.ts
rm src/app/api/trading/disconnect/route.ts
```

- [ ] **Step 2: Remove empty directories**

```bash
rmdir src/app/api/trading/snaptrade
rmdir src/app/api/trading/saltedge
rmdir src/app/api/trading
```

- [ ] **Step 3: Verify build still passes**

Run: `npm run build`
Expected: Clean build. These routes had no importers — they were only hit via `fetch()` from the `TradingConnect` client component.

- [ ] **Step 4: Commit**

```bash
git add -A src/app/api/trading/
git commit -m "fix(regulatory): delete dopler-side trading connect API routes

7 routes removed: snaptrade register/connect/callback, saltedge
register/connect/callback, disconnect. Doplers should never OAuth
through dopl — they open their own broker app instead."
```

---

### Task 2: Delete TradingConnect Component

**Files:**
- Delete: `src/components/connect/trading-connect.tsx`

- [ ] **Step 1: Delete the component**

```bash
rm src/components/connect/trading-connect.tsx
```

- [ ] **Step 2: Verify no remaining imports**

```bash
grep -r "trading-connect" src/ --include="*.ts" --include="*.tsx"
```

Expected: Hits in `welcome-client.tsx` and `settings/page.tsx` — these will be fixed in Tasks 3 and 4. No other files should import it.

- [ ] **Step 3: Commit**

```bash
git add src/components/connect/trading-connect.tsx
git commit -m "fix(regulatory): delete TradingConnect dopler component

Component offered broker/bank OAuth connect to doplers via
/api/trading/* routes. Removed for regulatory compliance."
```

---

### Task 3: Remove Proxy Gate for Dopler Feed Access

**Files:**
- Modify: `src/proxy.ts`
- Modify: `src/lib/proxy-gates.ts`
- Modify: `src/lib/__tests__/proxy-gates.test.ts`

The proxy currently redirects subscribers to `/welcome` when `trading_connected` is false. With broker OAuth removed, `trading_connected` is never set for new doplers — creating an infinite redirect loop (/feed → /welcome → region pick → /feed → /welcome). Remove the gate entirely. The welcome page is informational, not a prerequisite for viewing the feed.

- [ ] **Step 1: Remove `doplerNeedsOnboarding` from proxy.ts**

In `src/proxy.ts`:

Remove the import (line 3):
```typescript
import { doplerNeedsOnboarding } from "@/lib/proxy-gates";
```

Remove `tradingConnected` variable (line 57) and the profile select of `trading_connected` (line 62). The profile select becomes:
```typescript
const { data: profile } = await supabase
  .from("profiles")
  .select("role")
  .eq("id", user.id)
  .maybeSingle();
```

Remove the `tradingConnected = !!profile?.trading_connected;` line (70).

Remove the `doplerNeedsOnboarding` redirect block (lines 87-91):
```typescript
// DELETE THIS BLOCK:
if (doplerNeedsOnboarding({ role, tradingConnected, path })) {
  const url = request.nextUrl.clone();
  url.pathname = "/welcome";
  return NextResponse.redirect(url);
}
```

- [ ] **Step 2: Delete proxy-gates.ts and its test**

The file only exports `doplerNeedsOnboarding` which is no longer used.

```bash
rm src/lib/proxy-gates.ts
rm src/lib/__tests__/proxy-gates.test.ts
```

- [ ] **Step 3: Verify build and tests**

Run: `npm run build && npm test`
Expected: Clean build. Tests pass (proxy-gates tests are deleted, not failing).

- [ ] **Step 4: Commit**

```bash
git add src/proxy.ts src/lib/proxy-gates.ts src/lib/__tests__/proxy-gates.test.ts
git commit -m "fix(regulatory): remove dopler feed access gate on trading_connected

The proxy gate redirected subscribers to /welcome when
trading_connected was false. With broker OAuth removed for doplers,
this created an infinite redirect loop. Feed access is now ungated
for all authenticated subscribers."
```

---

### Task 4: Simplify Welcome Onboarding (3-step → 2-step)

**Files:**
- Modify: `src/app/welcome/welcome-client.tsx`
- Modify: `src/app/welcome/page.tsx`

The welcome flow currently has 3 steps: welcome → region → connect. Remove the "connect" step entirely. The dopler onboarding becomes: welcome → region pick → redirect to feed. The region selection is cosmetic (informational) — doplers don't have a region column.

- [ ] **Step 1: Rewrite welcome-client.tsx**

Remove the `TradingConnect` import, the `Initial` type, the `"connect"` step, and the `initial` prop. The component becomes a 2-step flow.

```tsx
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Globe, ArrowRight } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { REGIONS } from "@/components/connect/region-selector";

const STEPS = ["welcome", "region"] as const;

export default function WelcomeClient({
  firstName,
}: {
  firstName: string;
}) {
  const [step, setStep] = useState(0);
  const [region, setRegion] = useState<string | null>(null);

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const chooseRegion = (key: string) => {
    setRegion(key);
    // Region selected — onboarding is done, redirect to feed.
    window.location.href = "/feed";
  };

  return (
    <main className="min-h-screen relative overflow-hidden flex items-center justify-center px-6 py-10">
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(800px 400px at 50% -10%, rgba(197,214,52,0.1), transparent 60%), radial-gradient(700px 400px at 100% 100%, rgba(45,74,62,0.5), transparent 60%)",
        }}
      />

      <div className="relative w-full max-w-xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35 }}
          >
            {step === 0 && (
              <GlassCard className="p-10 md:p-12 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[color:var(--dopl-lime)]/12 border border-[color:var(--dopl-lime)]/25 flex items-center justify-center text-[color:var(--dopl-lime)] mx-auto mb-6">
                  <Sparkles size={22} />
                </div>
                <h1 className="font-display text-4xl md:text-5xl font-semibold leading-tight tracking-tight">
                  welcome to dopl
                  {firstName ? `, ${firstName}` : ""}
                </h1>
                <p className="text-[color:var(--dopl-cream)]/60 text-sm md:text-base mt-4 mb-6 max-w-md mx-auto">
                  find a fund manager worth dopling. when they trade, you&apos;ll
                  see it live — tap to execute in your own broker.
                </p>
                <button
                  onClick={next}
                  className="btn-lime text-sm px-7 py-3 inline-flex items-center gap-2"
                >
                  let&apos;s go
                  <ArrowRight size={14} />
                </button>
              </GlassCard>
            )}

            {step === 1 && (
              <GlassCard className="p-8 md:p-10">
                <div className="w-12 h-12 rounded-2xl bg-[color:var(--dopl-lime)]/12 border border-[color:var(--dopl-lime)]/25 flex items-center justify-center text-[color:var(--dopl-lime)] mb-5">
                  <Globe size={22} />
                </div>
                <h2 className="font-display text-2xl md:text-3xl font-semibold leading-tight tracking-tight">
                  where do you trade?
                </h2>
                <p className="text-[color:var(--dopl-cream)]/55 text-sm mt-2 mb-6">
                  pick your region so we show you the right fund managers.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {REGIONS.map((r) => {
                    const selected = region === r.key;
                    return (
                      <button
                        key={r.key}
                        onClick={() => chooseRegion(r.key)}
                        className={`text-left p-3 rounded-xl border transition-all ${
                          selected
                            ? "border-[color:var(--dopl-lime)]/60 bg-[color:var(--dopl-lime)]/10"
                            : "border-[color:var(--dopl-sage)]/30 bg-[color:var(--dopl-deep)] hover:border-[color:var(--dopl-lime)]/40"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="text-2xl leading-none">{r.flag}</div>
                          <div className="flex-1 min-w-0">
                            <div className="font-display text-sm font-semibold">
                              {r.label}
                            </div>
                            <div className="text-[11px] text-[color:var(--dopl-cream)]/45 truncate">
                              {r.subtitle}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={prev}
                  className="text-xs text-[color:var(--dopl-cream)]/50 hover:text-[color:var(--dopl-cream)] mt-6"
                >
                  ← back
                </button>
              </GlassCard>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Rewrite welcome/page.tsx**

Replace the entire file. Remove the trading queries, trading_connected redirect, connectionData derivation, and `initial` prop:

```tsx
import { createServerSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import WelcomeClient from "./welcome-client";

export default async function WelcomePage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role === "fund_manager") redirect("/onboarding");

  const firstName = profile?.full_name?.split(" ")[0] ?? "";
  return <WelcomeClient firstName={firstName} />;
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Clean build, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/welcome/
git commit -m "fix(regulatory): simplify dopler onboarding to 2 steps

Removed broker connect step from welcome flow. Onboarding is now:
welcome → region pick → redirect to feed. No more OAuth for doplers."
```

---

### Task 5: DB Migration — Add `trading_broker_preference` Column

**Files:**
- Create: `supabase/migrations/20260427_add_broker_preference.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Add broker preference column to profiles (doplers only).
-- Stores a simple broker name string for deep-link CTAs.
-- No OAuth, no account linking — just "which broker do you use?"
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS trading_broker_preference TEXT;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260427_add_broker_preference.sql
git commit -m "feat(db): add trading_broker_preference column to profiles

Simple text column for dopler broker preference. Used for deep-link
CTAs — no OAuth, no account linking."
```

- [ ] **Step 3: Surfer runs the migration in Supabase SQL editor**

Surfer pastes the SQL into the Supabase SQL editor and executes it.

---

### Task 6: Create Broker Preference API Route

**Files:**
- Create: `src/app/api/broker-preference/route.ts`

- [ ] **Step 1: Write the API route**

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("profiles")
    .select("trading_broker_preference")
    .eq("id", user.id)
    .maybeSingle();

  return NextResponse.json({
    broker: data?.trading_broker_preference ?? null,
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const broker = typeof body.broker === "string" ? body.broker.trim() : null;

  const { error } = await supabase
    .from("profiles")
    .update({ trading_broker_preference: broker || null })
    .eq("id", user.id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ broker: broker || null });
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/broker-preference/route.ts
git commit -m "feat: add broker preference GET/POST API route

Simple endpoint for doplers to get/set their preferred broker name.
Stored as text in profiles.trading_broker_preference."
```

---

### Task 7: Create Broker Preference Picker Component

**Files:**
- Create: `src/components/broker-preference-picker.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useState } from "react";
import { ChevronDown, Check } from "lucide-react";

const BROKERS = [
  "Robinhood",
  "Fidelity",
  "Schwab",
  "Webull",
  "Interactive Brokers",
  "Coinbase",
  "Trading 212",
  "Wealthsimple",
  "Other",
] as const;

export function BrokerPreferencePicker({
  initial,
  onSaved,
}: {
  initial: string | null;
  onSaved?: (broker: string | null) => void;
}) {
  const [value, setValue] = useState(initial ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async (broker: string) => {
    setValue(broker);
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/broker-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ broker: broker || null }),
      });
      setSaved(true);
      onSaved?.(broker || null);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--dopl-cream)]/40 mb-2">
        your broker
      </p>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => save(e.target.value)}
          disabled={saving}
          className="w-full appearance-none bg-[color:var(--dopl-deep)] border border-[color:var(--dopl-sage)]/30 rounded-xl px-4 py-3 text-sm text-[color:var(--dopl-cream)] pr-10 focus:outline-none focus:border-[color:var(--dopl-lime)]/50 transition-colors"
        >
          <option value="">select your broker</option>
          {BROKERS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[color:var(--dopl-cream)]/40">
          {saved ? (
            <Check size={16} className="text-[color:var(--dopl-lime)]" />
          ) : (
            <ChevronDown size={16} />
          )}
        </div>
      </div>
      <p className="text-[11px] text-[color:var(--dopl-cream)]/40 mt-2">
        used to open your broker when a fund manager trades. no account linking.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add src/components/broker-preference-picker.tsx
git commit -m "feat: add BrokerPreferencePicker dropdown component

Simple dropdown for doplers to pick their broker. Saves to
profiles.trading_broker_preference via /api/broker-preference."
```

---

### Task 8: Replace TradingConnect in Settings Page

**Files:**
- Modify: `src/app/settings/page.tsx`

- [ ] **Step 1: Replace TradingConnect with BrokerPreferencePicker**

Remove the `TradingConnect` import, the `ProfileRow` trading fields, the `tradingName` derivation, and the `<TradingConnect>` JSX. Replace with `BrokerPreferencePicker`.

The `ProfileRow` type simplifies to:

```typescript
type ProfileRow = {
  full_name?: string | null;
  email?: string | null;
  role?: string | null;
  trading_broker_preference?: string | null;
};
```

The profile query simplifies — remove the `withNew`/fallback pattern for trading columns. Replace with a single select:

```typescript
const { data: profile } = await supabase
  .from("profiles")
  .select("full_name, email, role, trading_broker_preference")
  .eq("id", user.id)
  .maybeSingle();
```

Replace the `<TradingConnect>` section (lines 121-131) with:

```tsx
import { BrokerPreferencePicker } from "@/components/broker-preference-picker";

// ... in JSX, replacing the TradingConnect div:
<GlassCard className="p-6 mb-8">
  <BrokerPreferencePicker
    initial={profile?.trading_broker_preference ?? null}
  />
</GlassCard>
```

Also remove the `searchParams` logic for `connected`/`error` banners (lines 79-90) — those were for broker connect callbacks. And remove the `params` variable.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "feat(settings): replace TradingConnect with broker preference picker

Settings page now shows a simple dropdown instead of OAuth connect.
Simplified profile query — removed trading_connected/trading_connection_data."
```

---

### Task 9: Update DoplerShell — Fetch Broker Preference

**Files:**
- Modify: `src/components/dopler-shell.tsx`

- [ ] **Step 1: Replace trading state with broker preference**

Remove the `trading` state (lines 31-35) and the profile fetch that reads `trading_connected`/`trading_connection_data` (lines 51-65). Replace with a simple `brokerPreference` state.

Replace lines 31-35:
```tsx
const [brokerPreference, setBrokerPreference] = useState<string | null>(null);
```

Replace the profile fetch block (lines 51-65) with:
```tsx
try {
  const { data: profile } = await supabase
    .from("profiles")
    .select("trading_broker_preference")
    .eq("id", uid)
    .maybeSingle();
  setBrokerPreference(profile?.trading_broker_preference ?? null);
} catch {
  /* ignore — column may not exist yet */
}
```

Update NotificationBell props (lines 144-149) — replace `tradingConnected`, `tradingName`, `tradingWebsite` with `brokerPreference`:

```tsx
<NotificationBell
  userId={userId}
  brokerPreference={brokerPreference}
/>
```

- [ ] **Step 2: Verify build**

This will cause TypeScript errors in `notification-bell.tsx` — expected, fixed in Task 9.

- [ ] **Step 3: Commit**

```bash
git add src/components/dopler-shell.tsx
git commit -m "refactor(dopler-shell): fetch broker preference instead of trading connect state

Replaced trading_connected/trading_connection_data fetch with simple
trading_broker_preference. Passes brokerPreference to NotificationBell."
```

---

### Task 10: Update NotificationBell Props

**Files:**
- Modify: `src/components/ui/notification-bell.tsx`

- [ ] **Step 1: Replace trading props with brokerPreference**

Change the component props from:
```tsx
export default function NotificationBell({
  userId: _userId,
  tradingConnected = false,
  tradingName = null,
  tradingWebsite = null,
}: {
  userId: string | null;
  tradingConnected?: boolean;
  tradingName?: string | null;
  tradingWebsite?: string | null;
}) {
```

To:
```tsx
export default function NotificationBell({
  userId: _userId,
  brokerPreference = null,
}: {
  userId: string | null;
  brokerPreference?: string | null;
}) {
```

Update the NotificationPopup call (lines 179-186). Import and use `buildBrokerTradeUrl` to derive the website URL from the broker name:

```tsx
import { buildBrokerTradeUrl } from "@/lib/broker-deeplinks";
```

Replace the popup component:
```tsx
<NotificationPopup
  notification={popup}
  brokerPreference={brokerPreference}
  activeSubscribedPortfolioIds={activeSubscribedPortfolioIds}
  onClose={() => setPopup(null)}
/>
```

- [ ] **Step 2: Verify build**

This will cause TypeScript errors in `notification-popup.tsx` — expected, fixed in Task 10.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/notification-bell.tsx
git commit -m "refactor(notification-bell): use brokerPreference instead of trading props

Single string prop replaces three trading-connect props."
```

---

### Task 11: Add Broker Homepage Map to broker-deeplinks.ts

**Files:**
- Modify: `src/lib/broker-deeplinks.ts`

`buildBrokerTradeUrl(brokerPreference, null, ticker)` returns `null` for 6 of 9 broker picker options (Webull, Interactive Brokers, Coinbase, Trading 212, Wealthsimple, Other) because they have no pattern in `BROKER_PATTERNS` and `websiteUrl` is `null`. Add a `BROKER_HOMEPAGES` map so unmatched brokers fall back to their homepage, and export a helper for callers.

- [ ] **Step 1: Add BROKER_HOMEPAGES and getBrokerHomepage**

Add after the existing `BROKER_PATTERNS` array in `src/lib/broker-deeplinks.ts`:

```typescript
const BROKER_HOMEPAGES: Record<string, string> = {
  Robinhood: "https://robinhood.com",
  Fidelity: "https://www.fidelity.com",
  Schwab: "https://www.schwab.com",
  Webull: "https://www.webull.com",
  "Interactive Brokers": "https://www.interactivebrokers.com",
  Coinbase: "https://www.coinbase.com",
  "Trading 212": "https://www.trading212.com",
  Wealthsimple: "https://www.wealthsimple.com",
};

export function getBrokerHomepage(name: string | null): string | null {
  if (!name) return null;
  return BROKER_HOMEPAGES[name] ?? null;
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add src/lib/broker-deeplinks.ts
git commit -m "feat: add BROKER_HOMEPAGES map for broker preference deep-links

Provides homepage URLs for all 8 named brokers in the picker.
Used as websiteUrl fallback when no ticker-specific deep-link pattern
exists (Webull, IB, Coinbase, Trading 212, Wealthsimple)."
```

---

### Task 12: Update NotificationPopup — Broker Preference + Bug Fixes

**Files:**
- Modify: `src/components/ui/notification-popup.tsx`

This task addresses three bugs AND the broker preference prop change:

1. **Overflow fix:** Add `max-h-[85vh] overflow-y-auto` to the popup inner div
2. **Opaque background fix:** Replace `glass-card glass-card-strong` with opaque background
3. **CTA update:** Replace trading connect CTA with broker preference CTA

- [ ] **Step 1: Update component props and CTA logic**

Replace the props interface:
```tsx
export function NotificationPopup({
  notification,
  brokerPreference,
  activeSubscribedPortfolioIds,
  onClose,
}: {
  notification: PopupNotification | null;
  brokerPreference: string | null;
  activeSubscribedPortfolioIds?: Set<string>;
  onClose: () => void;
}) {
```

Replace the inner div class (line 120) — fix overflow AND opaque background:

Old:
```tsx
className="relative w-full md:max-w-md glass-card glass-card-strong rounded-t-3xl md:rounded-3xl p-6 md:p-7 md:mx-4 pb-8 md:pb-7"
```

New:
```tsx
className="relative w-full md:max-w-md rounded-t-3xl md:rounded-3xl p-6 md:p-7 md:mx-4 pb-8 md:pb-7 max-h-[85vh] overflow-y-auto bg-[color:var(--dopl-deep-2)] border border-[color:var(--glass-border-strong)] shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)]"
```

Replace the CTA section (lines 184-213). The old logic was:
- `tradingConnected && tradingWebsite` → deep link
- else → "connect your broker to dopl instantly" link to /settings

New logic:
- `brokerPreference` is set → deep link using `buildBrokerTradeUrl(brokerPreference, null, ticker)`
- `brokerPreference` is null → "set your broker" link to /settings

Import `getBrokerHomepage` alongside `buildBrokerTradeUrl`:

```tsx
import { buildBrokerTradeUrl, getBrokerHomepage } from "@/lib/broker-deeplinks";
```

CTA logic — handle "Other" (no broker CTA) and use `getBrokerHomepage` as websiteUrl fallback:

```tsx
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
    className="btn-lime w-full text-sm py-3 inline-flex items-center justify-center gap-2"
  >
    <ExternalLink size={14} />
    {ticker
      ? `dopl ${ticker} on ${brokerPreference}`
      : `open ${brokerPreference}`}
  </a>
) : !brokerPreference ? (
  <Link
    href="/settings"
    onClick={onClose}
    className="btn-lime w-full text-sm py-3 inline-flex items-center justify-center gap-2"
  >
    <Link2 size={14} />
    set your broker in settings
  </Link>
) : null}
```

When `brokerPreference === "Other"`, no broker CTA renders — the "copy ticker" and "view portfolio" buttons below are sufficient.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/notification-popup.tsx
git commit -m "fix(popup): overflow + opaque bg + broker preference CTA

Three fixes: max-h-[85vh] overflow-y-auto prevents mobile overflow,
opaque bg-[dopl-deep-2] replaces semi-transparent glass-card, and
CTA now uses broker preference for deep-links instead of trading connect."
```

---

### Task 13: Update Notifications Page — Broker Preference + Missing Data

**Files:**
- Modify: `src/app/notifications/page.tsx`
- Modify: `src/app/notifications/notifications-client.tsx`

- [ ] **Step 1: Update the server page**

Replace the entire trading profile query in `page.tsx` with a broker preference query:

```tsx
import { createServerSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import NotificationsClient from "./notifications-client";
import DoplerShell from "@/components/dopler-shell";

export default async function NotificationsPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("trading_broker_preference")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <DoplerShell>
      <NotificationsClient
        brokerPreference={profile?.trading_broker_preference ?? null}
      />
    </DoplerShell>
  );
}
```

- [ ] **Step 2: Update the client component**

In `notifications-client.tsx`:

Replace the props:
```tsx
export default function NotificationsClient({
  brokerPreference,
}: {
  brokerPreference: string | null;
}) {
```

**Fix the missing data bug (lines 91-98):** Add `ticker` and `change_type` to the popup object:
```tsx
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
```

**Replace the inline CTA (lines 163-181):** Replace the `tradingConnected && tradingWebsite` block with broker preference logic:

```tsx
import { buildBrokerTradeUrl, getBrokerHomepage } from "@/lib/broker-deeplinks";

// ... in the inline CTA section:
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
    className="glass-card-light px-3 py-1.5 text-xs rounded-lg hover:bg-[color:var(--dopl-lime)]/15 transition-colors inline-flex items-center gap-1.5 text-[color:var(--dopl-lime)]"
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
```

Update the NotificationPopup call at the bottom:
```tsx
<NotificationPopup
  notification={popup}
  brokerPreference={brokerPreference}
  activeSubscribedPortfolioIds={activeSubscribedPortfolioIds}
  onClose={() => setPopup(null)}
/>
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 4: Commit**

```bash
git add src/app/notifications/
git commit -m "fix(notifications): broker preference + pass ticker/change_type to popup

Server page now fetches trading_broker_preference instead of
trading_connected. Client passes ticker and change_type to popup
(was missing — same bug Sprint 7 fixed in notification-bell).
Inline CTAs use broker preference for deep-links."
```

---

### Task 14: Role-Aware Homepage CTAs

**Files:**
- Modify: `src/app/marketing-landing.tsx`

- [ ] **Step 1: Add role-aware CTAs to the hero**

Replace the hero CTA section (lines 70-80):

```tsx
<div className="flex items-center justify-center gap-4">
  {viewer?.role === "subscriber" ? (
    <>
      <Link href="/feed" className="btn-lime text-base px-8 py-3.5">
        your feed
      </Link>
      <Link
        href="/leaderboard"
        className="text-sm text-dopl-cream/50 hover:text-dopl-cream transition-colors underline underline-offset-4"
      >
        discover fund managers →
      </Link>
    </>
  ) : viewer?.role === "fund_manager" ? (
    <>
      <Link href="/dashboard" className="btn-lime text-base px-8 py-3.5">
        your dashboard
      </Link>
      <Link
        href="/leaderboard"
        className="text-sm text-dopl-cream/50 hover:text-dopl-cream transition-colors underline underline-offset-4"
      >
        see fund managers →
      </Link>
    </>
  ) : (
    <>
      <Link href="/signup" className="btn-lime text-base px-8 py-3.5">
        launch your fund
      </Link>
      <Link
        href="/leaderboard"
        className="text-sm text-dopl-cream/50 hover:text-dopl-cream transition-colors underline underline-offset-4"
      >
        see fund managers →
      </Link>
    </>
  )}
</div>
```

- [ ] **Step 2: Update the bottom CTA (line 145)**

Replace the bottom CTA:

```tsx
{viewer?.role === "subscriber" ? (
  <Link href="/feed" className="btn-lime text-base px-8 py-3.5 inline-block">
    your feed
  </Link>
) : viewer?.role === "fund_manager" ? (
  <Link href="/dashboard" className="btn-lime text-base px-8 py-3.5 inline-block">
    your dashboard
  </Link>
) : (
  <Link href="/signup" className="btn-lime text-base px-8 py-3.5 inline-block">
    launch your fund
  </Link>
)}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 4: Commit**

```bash
git add src/app/marketing-landing.tsx
git commit -m "feat(homepage): role-aware CTAs for doplers and fund managers

Dopler sees 'your feed' + 'discover fund managers'. FM sees 'your
dashboard' + 'see fund managers'. Logged-out sees original CTAs.
No redirects — homepage stays as the brand page for everyone."
```

---

### Task 15: PWA Safe Area Inset Top

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Add safe-area-inset-top to the body**

In `src/app/layout.tsx`, add inline style to the `<body>` tag (line 75):

Old:
```tsx
<body className="min-h-screen text-dopl-cream antialiased">
```

New:
```tsx
<body
  className="min-h-screen text-dopl-cream antialiased"
  style={{ paddingTop: "env(safe-area-inset-top)" }}
>
```

- [ ] **Step 2: Verify the dopler shell top nav respects the inset**

The dopler shell nav is `sticky top-0` (line 96 of `dopler-shell.tsx`). With body padding-top, the nav will be pushed down below the Dynamic Island. The `sticky top-0` means it sticks at the top of the scrollable area, which now starts below the safe area. This is correct.

- [ ] **Step 3: Verify dashboard chrome**

The dashboard chrome sidebar is `sticky top-0 h-screen` (line 164 of `dashboard-chrome.tsx`). With body padding-top, the sidebar will also be pushed down. This is correct for mobile; on desktop there's no Dynamic Island so `env(safe-area-inset-top)` resolves to `0px`.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx
git commit -m "fix(pwa): add safe-area-inset-top to body for Dynamic Island

Content was rendering behind the Dynamic Island on iPhone PWA.
padding-top: env(safe-area-inset-top) pushes all content below
the status bar. safe-area-inset-bottom was already handled."
```

---

### Task 16: Performance — Parallelize Dashboard Page Queries

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Batch the 4 sequential queries into 2 parallel batches**

The page currently runs: getUser → fund_managers → portfolios → positions (sequential).

Batch 1: getUser (must be first — need user.id for the rest).
Batch 2: fund_managers + portfolios in parallel.
Then: positions query (depends on portfolio IDs).

Replace lines 12-36 with:

```typescript
const supabase = await createServerSupabase();
const {
  data: { user },
} = await supabase.auth.getUser();
if (!user) redirect("/login");

const [{ data: fm }, { data: portfolios }] = await Promise.all([
  supabase
    .from("fund_managers")
    .select("*")
    .eq("id", user.id)
    .maybeSingle(),
  supabase
    .from("portfolios")
    .select("id, price_cents, subscriber_count, is_active")
    .eq("fund_manager_id", user.id),
]);

const portfolioIds = (portfolios ?? []).map((p) => p.id);
const { count: positionCount } = portfolioIds.length
  ? await supabase
      .from("positions")
      .select("id", { count: "exact", head: true })
      .in("portfolio_id", portfolioIds)
  : { count: 0 };
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/dashboard/page.tsx
git commit -m "perf(dashboard): parallelize fund_managers + portfolios queries

Reduced from 4 sequential queries to 2 batches using Promise.all().
getUser → [fund_managers, portfolios] in parallel → positions."
```

---

### Task 17: Performance — Parallelize Feed Page Queries

**Files:**
- Modify: `src/app/feed/page.tsx`

- [ ] **Step 1: Batch queries into parallel groups**

The feed page runs 5 sequential queries. Restructure to:

Batch 1: getUser
Batch 2: subscriptions (needs user.id)
Batch 3: [fund_managers, profiles, positions] in parallel (all need data from batch 2)

Replace the query section. After getting user and subs, batch the remaining queries:

```typescript
// 2+2b+3) fund managers, profiles, positions — all in parallel.
const fmIds = Array.from(
  new Set(
    subs.flatMap((s) =>
      [s.fund_manager_id, s.portfolio?.fund_manager_id].filter(
        (id): id is string => typeof id === "string" && id.length > 0
      )
    )
  )
);
const portfolioIds = subs.map((s) => s.portfolio_id);

const [fmResult, profileResult, posResult] = await Promise.all([
  fmIds.length
    ? admin
        .from("fund_managers")
        .select(
          "id, handle, display_name, avatar_url, bio, subscriber_count, broker_provider"
        )
        .in("id", fmIds)
    : Promise.resolve({ data: [] }),
  fmIds.length
    ? admin.from("profiles").select("id, full_name, email").in("id", fmIds)
    : Promise.resolve({ data: [] }),
  portfolioIds.length
    ? admin
        .from("positions")
        .select(
          "id, portfolio_id, ticker, name, allocation_pct, current_price, gain_loss_pct, shares, market_value"
        )
        .in("portfolio_id", portfolioIds)
        .order("market_value", { ascending: false })
    : Promise.resolve({ data: [] }),
]);

const fmMap = new Map<string, FundManagerRow>();
for (const row of (fmResult.data ?? []) as FundManagerRow[]) {
  fmMap.set(row.id, row);
}

const profileMap = new Map<
  string,
  { full_name: string | null; email: string | null }
>();
for (const row of profileResult.data ?? []) {
  profileMap.set(
    (row as { id: string }).id,
    {
      full_name: (row as { full_name: string | null }).full_name,
      email: (row as { email: string | null }).email,
    }
  );
}

const positionsByPortfolio = new Map<string, PositionLike[]>();
for (const p of (posResult.data ?? []) as PositionRow[]) {
  const list = positionsByPortfolio.get(p.portfolio_id) ?? [];
  list.push(p);
  positionsByPortfolio.set(p.portfolio_id, list);
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add src/app/feed/page.tsx
git commit -m "perf(feed): parallelize fund_managers + profiles + positions queries

Reduced from 5 sequential queries to 3 batches. fund_managers,
profiles, and positions now run in parallel via Promise.all()."
```

---

### Task 18: Performance — Parallelize Positions Page

**Files:**
- Modify: `src/app/(dashboard)/dashboard/positions/page.tsx`

- [ ] **Step 1: Batch queries**

After getUser, run portfolios and fund_managers in parallel, then positions:

```typescript
const supabase = await createServerSupabase();
const {
  data: { user },
} = await supabase.auth.getUser();
if (!user) redirect("/login");

const [{ data: portfolios }, { data: fm }] = await Promise.all([
  supabase
    .from("portfolios")
    .select("id, name, tier, price_cents")
    .eq("fund_manager_id", user.id)
    .order("created_at", { ascending: false }),
  supabase
    .from("fund_managers")
    .select("broker_connected")
    .eq("id", user.id)
    .maybeSingle(),
]);

const portfolioIds = (portfolios ?? []).map((p) => p.id);
const { data: assignedPositions } = await supabase
  .from("positions")
  .select("id, ticker, name, shares, current_price, market_value, allocation_pct, portfolio_id")
  .in(
    "portfolio_id",
    portfolioIds.length
      ? portfolioIds
      : ["00000000-0000-0000-0000-000000000000"]
  );
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/dashboard/positions/page.tsx
git commit -m "perf(positions): parallelize portfolios + fund_managers queries

Reduced from 3 sequential queries to 2 batches using Promise.all()."
```

---

### Task 19: Performance — Parallelize Portfolio Detail Page

**Files:**
- Modify: `src/app/feed/[portfolioId]/page.tsx`

- [ ] **Step 1: Batch queries after getting portfolio**

After getUser and portfolio fetch, run subscription check, positions, and updates in parallel:

```typescript
const [subResult, { data: positions }, { data: updates }] = await Promise.all([
  !isOwner && !isFree
    ? supabase
        .from("subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .eq("portfolio_id", portfolioId)
        .eq("status", "active")
        .maybeSingle()
    : Promise.resolve({ data: null }),
  supabase
    .from("positions")
    .select("*")
    .eq("portfolio_id", portfolioId)
    .order("market_value", { ascending: false }),
  supabase
    .from("portfolio_updates")
    .select("*")
    .eq("portfolio_id", portfolioId)
    .order("created_at", { ascending: false })
    .limit(10),
]);

const subscribed = !!subResult.data;
const canView = isOwner || isFree || subscribed;
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add src/app/feed/[portfolioId]/page.tsx
git commit -m "perf(portfolio-detail): parallelize subscription + positions + updates

Three queries now run in parallel instead of sequentially."
```

---

### Task 20: Performance — Parallelize Settings Page

**Files:**
- Modify: `src/app/settings/page.tsx`

- [ ] **Step 1: Batch profile and subscription count queries**

After getUser, run profile and subscription count in parallel:

```typescript
const [{ data: profileData }, { count: activeSubs }] = await Promise.all([
  supabase
    .from("profiles")
    .select("full_name, email, role, trading_broker_preference")
    .eq("id", user.id)
    .maybeSingle(),
  supabase
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "active"),
]);

const profile = profileData as ProfileRow | null;
if (profile?.role === "fund_manager") redirect("/dashboard/profile");
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 3: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "perf(settings): parallelize profile + subscription count queries

Two queries now run in parallel instead of sequentially."
```

---

### Task 21: Performance — Link Prefetch

**Files:**
- Modify: `src/components/dopler-shell.tsx`
- Modify: `src/app/(dashboard)/dashboard-chrome.tsx`

- [ ] **Step 1: Add `prefetch={true}` to dopler shell nav links**

In `dopler-shell.tsx`, the `NavLink` components in both top nav (line 120) and bottom nav (line 184) should get `prefetch`:

For each `<NavLink>` in the navigation, add `prefetch`:
```tsx
<NavLink
  key={item.href}
  href={item.href}
  prefetch
  // ... rest of props
>
```

Check if `NavLink` passes `prefetch` through to `Link`. If it's a wrapper, ensure it spreads `...rest` props onto the underlying `<Link>`.

- [ ] **Step 2: Add `prefetch={true}` to dashboard chrome nav links**

In `dashboard-chrome.tsx`, add `prefetch` to `<NavLink>` in both `SideNav` (line 66) and `BottomNav` (line 108).

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 4: Commit**

```bash
git add src/components/dopler-shell.tsx src/app/(dashboard)/dashboard-chrome.tsx
git commit -m "perf: enable eager prefetch on primary nav links

Next.js 16 Link defaults to viewport-based prefetch. Adding prefetch
prop eagerly fetches on render for faster navigation."
```

---

### Task 22: Performance — Deduplicate getUser with React.cache

**Files:**
- Modify: `src/lib/supabase-server.ts` (or create a cached wrapper)

- [ ] **Step 1: Check current `supabase-server.ts` implementation**

Read the file to understand the current pattern.

- [ ] **Step 2: Add a cached getUser helper**

Create or modify to add a `React.cache`-wrapped getUser:

```typescript
import { cache } from "react";

export const getCachedUser = cache(async () => {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
```

- [ ] **Step 3: Update dashboard layout and child pages to use `getCachedUser()`**

In `src/app/(dashboard)/layout.tsx` and `src/app/(dashboard)/dashboard/page.tsx`, replace:
```typescript
const supabase = await createServerSupabase();
const { data: { user } } = await supabase.auth.getUser();
```
with:
```typescript
const user = await getCachedUser();
```

The `React.cache` deduplication means the Supabase auth call is only made once per request, even when called from both layout and page.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase-server.ts src/app/(dashboard)/layout.tsx src/app/(dashboard)/dashboard/page.tsx
git commit -m "perf: deduplicate getUser() with React.cache

Dashboard layout and child pages both call getUser(). React.cache
ensures the Supabase auth call is only made once per request."
```

---

### Task 23: Add Manifest `id` Field

**Files:**
- Modify: `public/manifest.json`

- [ ] **Step 1: Add the `id` field**

Add `"id": "/"` to `manifest.json`. This is required for iOS push notifications (Sprint 9 prep).

```json
{
  "id": "/",
  "name": "dopl",
  "short_name": "dopl",
  ...
}
```

- [ ] **Step 2: Commit**

```bash
git add public/manifest.json
git commit -m "fix(pwa): add id field to manifest.json

Required for iOS 16.4+ push notification support. Prep for Sprint 9."
```

---

### Task 24: Final Build + Test

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

- [ ] **Step 3: Verify no remaining references to deleted code**

```bash
grep -r "TradingConnect" src/ --include="*.ts" --include="*.tsx"
grep -r "/api/trading/" src/ --include="*.ts" --include="*.tsx"
grep -r "trading_connected" src/ --include="*.ts" --include="*.tsx"
grep -r "trading_connection_data" src/ --include="*.ts" --include="*.tsx"
grep -r "proxy-gates" src/ --include="*.ts" --include="*.tsx"
grep -r "doplerNeedsOnboarding" src/ --include="*.ts" --include="*.tsx"
```

Expected: No hits (or only in FM-side code which we're keeping). `proxy-gates` and `doplerNeedsOnboarding` should have zero hits — both files deleted in Task 3.

- [ ] **Step 4: Final commit if any cleanup needed**

---

## Manual Smoke Checks (Surfer on prod after merge)

1. Create a brand new dopler account — after signup, can reach the feed page without getting stuck in a redirect loop
2. Open dopl homepage logged out — see "launch your fund" + "see fund managers"
3. Log in as a dopler — homepage shows "your feed" + "discover fund managers"
4. Log in as a fund manager — homepage shows "your dashboard" + "see fund managers"
5. Open `/settings` as a dopler — see broker preference dropdown, no OAuth connect
6. Select "Robinhood" — saves without error, checkmark appears
7. Select "Coinbase" — deep-link CTA opens coinbase.com (homepage fallback, not dead link)
8. Select "Other" — no broker CTA appears, only "copy ticker" shows
9. Open `/notifications` — tap a notification — popup shows ticker, opaque background, no overflow on mobile
10. On mobile PWA: content does not render behind the Dynamic Island
11. Navigation between pages feels faster (prefetch + parallel queries)
12. `/welcome` flow is 2 steps (welcome → region), no broker connect step

---

## Revision Notes (Instance 1)

**Date:** 2026-04-27
**Addressing:** 2 critical + 2 important issues from Instance 2 review

### Critical 1 (proxy redirect loop) — FIXED
Added **Task 3: Remove Proxy Gate for Dopler Feed Access**. Deletes `proxy-gates.ts`, its test file, and removes the `doplerNeedsOnboarding` call + `trading_connected` query from `proxy.ts`. Feed access is now ungated for all authenticated subscribers. The welcome page is informational, not a prerequisite.

### Critical 2 (dead broker CTA links) — FIXED
Added **Task 11: Add Broker Homepage Map to broker-deeplinks.ts**. Adds `BROKER_HOMEPAGES` with URLs for all 8 named brokers and exports `getBrokerHomepage()`. Updated Task 12 and Task 13 CTA code to call `buildBrokerTradeUrl(brokerPreference, getBrokerHomepage(brokerPreference), ticker)`. For `"Other"`, no broker CTA renders — only "copy ticker" and "view portfolio" buttons.

### Important 1 (welcome/page.tsx) — FIXED
Task 4 Step 2 now includes the full rewritten `welcome/page.tsx` (15 lines). Removes `trading_connected` redirect, trading data queries, and `initial` prop.

### Important 2 (region not persisted) — INTENTIONAL
Region pick on the welcome page is cosmetic. Doplers don't have a region column — it's an FM concept. The welcome page is a friendly intro, not data collection. If we need dopler region data in the future, that's a new task.

### Task renumbering
Tasks renumbered 1–24 (was 1–22). New tasks: 3 (proxy gate), 11 (broker homepages). All subsequent tasks shifted +2.

---

## Review Notes (Instance 2, Round 1)

**Reviewed by:** Instance 2 (Reviewer)
**Date:** 2026-04-27
**Verdict:** needs-revision — 2 critical issues, 2 important issues

---

### CRITICAL 1: `proxy.ts` + `proxy-gates.ts` create an infinite redirect loop (SHOWSTOPPER)

**Files:** `src/proxy.ts:57-70,87`, `src/lib/proxy-gates.ts`

`proxy.ts` line 87 calls `doplerNeedsOnboarding({ role, tradingConnected, path })`. This gate redirects subscribers to `/welcome` when `tradingConnected` is `false`. After the regulatory changes:

1. `trading_connected` is never set by the new broker preference flow (different column entirely: `trading_broker_preference`)
2. New dopler completes welcome flow → region pick → `window.location.href = "/feed"`
3. Proxy intercepts `/feed`, reads `trading_connected = false` → redirects to `/welcome`
4. **Infinite redirect loop for ALL new doplers**

Existing doplers who previously connected via OAuth still have `trading_connected = true` — they'll keep working. But every new dopler after this sprint ships is permanently locked out of `/feed`.

**Required fix:** Add a task (before Task 3) to:
- Update `proxy.ts` to stop reading `trading_connected` from profiles
- Update `doplerNeedsOnboarding` in `src/lib/proxy-gates.ts` — either:
  - **(a) Remove the gate entirely** (simplest — onboarding is now 2 steps with no mandatory broker connect, so gating feed access on "connected" no longer makes sense), OR
  - **(b) Replace with a region/broker-preference check** — but this requires the welcome flow to persist something (see Important 2 below)

Recommendation: option (a). The welcome flow is informational, not a prerequisite for viewing the feed. Doplers who skip or re-visit `/welcome` should still reach their feed.

---

### CRITICAL 2: `buildBrokerTradeUrl` returns `null` for 6 of 9 broker options — dead CTA links

**Files:** `src/lib/broker-deeplinks.ts`, Tasks 9/10/11

The plan calls `buildBrokerTradeUrl(brokerPreference, null, ticker)` passing `null` as `websiteUrl`. The function's fallback chain:

1. Known broker + ticker → deep-link URL (works for Robinhood, Schwab, Fidelity)
2. Known broker + no ticker → `websiteUrl` fallback → **null** (no websiteUrl passed)
3. Unknown broker → `websiteUrl` fallback → **null**

Affected brokers (6 of 9 picker options):
- **Webull, Interactive Brokers** — explicitly removed from patterns (see broker-deeplinks.ts comments)
- **Coinbase, Trading 212, Wealthsimple** — no pattern exists
- **Other** — no pattern possible

Result: CTA shows `dopl AAPL on Coinbase` but `href="#"` — clicking does nothing. For "Other", the CTA reads `dopl AAPL on Other` which is nonsensical.

**Required fix:** Add a `BROKER_HOMEPAGES` mapping and pass it as the `websiteUrl` argument. Suggested addition to `broker-deeplinks.ts`:

```typescript
const BROKER_HOMEPAGES: Record<string, string> = {
  "Robinhood": "https://robinhood.com",
  "Fidelity": "https://www.fidelity.com",
  "Schwab": "https://www.schwab.com",
  "Webull": "https://www.webull.com",
  "Interactive Brokers": "https://www.interactivebrokers.com",
  "Coinbase": "https://www.coinbase.com",
  "Trading 212": "https://www.trading212.com",
  "Wealthsimple": "https://www.wealthsimple.com",
};

export function getBrokerHomepage(name: string | null): string | null {
  if (!name) return null;
  return BROKER_HOMEPAGES[name] ?? null;
}
```

Then in Tasks 10/11, call:
```tsx
buildBrokerTradeUrl(brokerPreference, getBrokerHomepage(brokerPreference), ticker)
```

For "Other": hide the broker-action CTA entirely and show "copy [ticker]" instead. CTA logic should be:
- `brokerPreference && brokerPreference !== "Other"` → broker CTA
- `brokerPreference === "Other"` or no preference → "set your broker" / "copy ticker"

---

### IMPORTANT 1: Task 3 Step 2 is ambiguous about `welcome/page.tsx` rewrite

**File:** `src/app/welcome/page.tsx`

Step 2 says "Remove the trading query and prop" but the server page has several things that need explicit treatment:

- **Line 14:** Query selects `trading_provider, trading_connected, trading_connection_data` — must be replaced with just `role, full_name`
- **Line 22:** `if (profile?.trading_connected) redirect("/feed")` — this redirect must be removed (with the proxy gate gone, this is the second place that assumes "connected = can access feed")
- **Lines 25-33:** `connectionData` derivation and `tradingName` — all deleted
- **Lines 35-43:** `initial` prop construction — deleted
- **Line 19:** `if (profile?.role === "fund_manager") redirect("/onboarding")` — keep this

Recommend: include the full rewritten `page.tsx` in the plan (same way Task 3 Step 1 includes the full `welcome-client.tsx`). The server page becomes ~15 lines:

```tsx
const { data: profile } = await supabase
  .from("profiles")
  .select("role, full_name")
  .eq("id", user.id)
  .maybeSingle();
if (profile?.role === "fund_manager") redirect("/onboarding");
const firstName = profile?.full_name?.split(" ")[0] ?? "";
return <WelcomeClient firstName={firstName} />;
```

---

### IMPORTANT 2: Welcome flow doesn't persist region selection

**File:** Task 3 `welcome-client.tsx`

`chooseRegion` calls `window.location.href = "/feed"` without saving the region to the database. This means:
- There's no persistent record the dopler completed onboarding
- The region the dopler picks is thrown away — never stored, never used
- If onboarding gating is ever re-added, there's nothing to check

If the proxy gate is fully removed (Critical 1 recommendation (a)), this is acceptable — the welcome page becomes purely informational. But the region pick is then cosmetic only. Is that intentional? If region data matters (e.g., for filtering fund managers by region), the selection should be saved (new DB column or reuse of an existing field). Flag for Instance 1 to decide.

---

### VERIFIED OK

| Item | Status |
|------|--------|
| 7 API routes exist at claimed paths | verified |
| TradingConnect imported only in welcome-client + settings (+ its own file) | verified |
| `broker-deeplinks.ts` exists, `buildBrokerTradeUrl` signature matches plan usage | verified |
| CSS vars `--dopl-deep-2` and `--glass-border-strong` exist in globals.css | verified |
| NavLink spreads `prefetch` through to Link via `...rest` | verified |
| FM-side broker routes (`/api/snaptrade/*`, `/api/saltedge/*`) NOT touched — only dopler `/api/trading/*` deleted | verified |
| `oauth-return/page.tsx` is FM-side — unaffected by regulatory changes | verified |
| Dashboard layout already uses Promise.all — Task 20 getCachedUser is additive dedup | verified |
| Task 20 React.cache approach is correct (per-request dedup, lightweight clients) | verified |
| Task 11 missing-data bug is real — `notifications-client.tsx:91-98` doesn't pass `ticker`/`change_type` to popup | verified |
| Feed page admin client usage in Task 15 is correct | verified |
| Performance parallelization in Tasks 14-18 preserves existing behavior — query dependencies verified | verified |
| Task 13 safe-area-inset-top approach is correct for Dynamic Island | verified |
| Task 12 role-aware CTAs — `viewer` prop shape matches `MarketingLanding` component | verified |

### MINOR NOTES (non-blocking)

1. **`notifications-client.tsx:79`** uses local `extractTicker(n.body)` for inline cards — could prefer `n.ticker ?? extractTicker(n.body)` for consistency. Not blocking.
2. **Task 22 grep checks** will catch `proxy.ts` references to `trading_connected` — but without an explicit task to fix it, the implementer would be stuck. Critical 1 resolves this.
3. **Positions page Task 16** — the current code fetches `fm` AFTER portfolios+positions (lines 28-32). The plan correctly parallelizes portfolios and fm but note the plan's query order is different from the current code. Functionally equivalent — just noting for the implementer.

---

### Summary for Instance 1

Two critical issues require plan revision before this can go to implementation:

1. **Proxy gate infinite redirect** — `proxy.ts` + `proxy-gates.ts` must be updated to remove the `tradingConnected` check, otherwise all new doplers are locked out of `/feed`
2. **Dead broker CTA links** — need a `BROKER_HOMEPAGES` map and special handling for "Other" to avoid `href="#"` on 6 of 9 broker options

Two important issues that should be clarified:

3. **Task 3 Step 2** needs explicit `welcome/page.tsx` rewrite (not just "remove the trading query")
4. **Region selection not persisted** — Instance 1 decision: is the region pick cosmetic or should it be saved?

Once these are addressed, the plan is solid. The performance tasks, notification bug fixes, PWA fix, and manifest change are all correct and well-specified.

---

## Review Notes (Instance 2, Round 2)

**Reviewed by:** Instance 2 (Reviewer)
**Date:** 2026-04-27
**Verdict:** approved

---

### Critical 1 (proxy redirect loop) — VERIFIED FIXED

Task 3 correctly addresses the infinite redirect loop:

- **Import removal:** `doplerNeedsOnboarding` import from `proxy.ts:3` — removed
- **Query simplification:** `.select("role, trading_connected")` → `.select("role")` — correct
- **Variable removal:** `let tradingConnected = false` (line 57) and `tradingConnected = !!profile?.trading_connected` (line 70) — both removed
- **Gate removal:** `doplerNeedsOnboarding` redirect block (lines 87-91) — deleted
- **File deletion:** `proxy-gates.ts` and `proxy-gates.test.ts` — confirmed both exist and will be deleted
- **Task 24 grep checks:** now include `proxy-gates` and `doplerNeedsOnboarding` — will catch any stragglers

Verified: `proxy.ts:3` and `proxy.ts:87` are the only two non-test references to `doplerNeedsOnboarding`. Both removed. No other file imports `proxy-gates`. The redirect loop is fully closed.

The new dopler flow after this change: signup → can navigate directly to `/feed` without going through `/welcome` first. Welcome page is still reachable but not mandatory. Manual smoke check #1 covers this.

---

### Critical 2 (dead broker CTA links) — VERIFIED FIXED

Task 11 adds `BROKER_HOMEPAGES` with URLs for all 8 named brokers and `getBrokerHomepage()` export. Traced through the CTA logic in Tasks 12 and 13:

| Broker | Ticker | `buildBrokerTradeUrl` result | CTA |
|--------|--------|------------------------------|-----|
| Robinhood | AAPL | `robinhood.com/stocks/AAPL` (deep-link pattern) | "dopl AAPL on Robinhood" |
| Robinhood | null | `robinhood.com` (websiteUrl fallback) | "open Robinhood" |
| Coinbase | AAPL | `coinbase.com` (no pattern → homepage fallback) | "dopl AAPL on Coinbase" |
| Coinbase | null | `coinbase.com` (websiteUrl fallback) | "open Coinbase" |
| Other | any | condition excluded (`!== "Other"`) | no broker CTA rendered |
| null | any | `!brokerPreference` branch | "set your broker in settings" |

All 9 picker options produce working CTAs or intentionally hidden CTAs. No dead `#` links for named brokers. Manual smoke checks #6-8 cover the key scenarios.

---

### Important 1 (welcome/page.tsx) — VERIFIED FIXED

Task 4 Step 2 includes the full rewritten `welcome/page.tsx` (15 lines). Verified it removes:
- `trading_provider, trading_connected, trading_connection_data` from the query
- `if (profile?.trading_connected) redirect("/feed")` redirect
- `connectionData` derivation and `tradingName`
- `initial` prop to `WelcomeClient`

And preserves:
- Auth check → redirect to `/login`
- FM redirect → `/onboarding`
- `firstName` derivation from `full_name`

---

### Important 2 (region not persisted) — ACCEPTED

Region selection is cosmetic per Architect decision. Accepted — no further action needed.

---

### Minor notes for the implementer (non-blocking)

1. **Task 9 Step 2 cross-reference:** Says "fixed in Task 9" — should read "fixed in Task 10" (renumbering artifact). The dopler-shell prop change breaks notification-bell, which is fixed in the next task (Task 10), not the current one.

2. **Task 10 Step 2 cross-reference:** Says "fixed in Task 10" — should read "fixed in Task 12" (renumbering artifact). The notification-bell prop change breaks notification-popup, which is fixed in Task 12.

3. **Task 22 (React.cache):** After replacing `const supabase = await createServerSupabase(); const { data: { user } } = await supabase.auth.getUser();` with `const user = await getCachedUser();`, the variable `supabase` disappears but is still needed for data queries below. The implementer must add `const supabase = await createServerSupabase();` back after the auth check for the query portion. This is straightforward but worth noting explicitly.

---

### Approval summary

All 4 Round 1 issues resolved. No new critical or important issues found. The plan is complete with 24 well-ordered tasks, proper dependency sequencing, and comprehensive smoke checks.

Ready for implementation on a feature branch.
