# CLAUDE.md — dopl Engineering Reference

Auto-loaded by Claude Code sessions in this repo. Contains the hard facts needed to build correctly. Design system lives in `CLAUDE-BRAND.md`. 3-instance workflow lives in `PIPELINE.md`.

These rules apply to every task in this project unless explicitly overridden.
Bias: caution over speed on non-trivial work. Use judgment on trivial tasks.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

---

## What dopl is

Portfolio transparency platform for fund managers. Fund managers connect their brokerage read-only via SnapTrade, publish subscription tiers, and subscribers (doplers) pay to follow the live portfolio. When positions change, subscribers get notified.

**Production:** `dopl-app.vercel.app`
**Repo:** `github.com/dopljiggy/dopl-app` (Surfer has push access)

## Tech Stack

- **Framework:** Next.js 16.2.3 (App Router) + TypeScript
- **UI:** React 19.2.4, Tailwind CSS v4, Framer Motion, Lucide icons
- **Database + Auth:** Supabase (SSR + realtime)
- **Broker integration (fund managers):** SnapTrade (read-only positions, balances, holdings). OAuth via SnapTrade Connect widget. Free tier: 5 connections. Pay-as-you-go: $2/connected user/month.
- **Bank integration (fund managers):** Salt Edge (payout flow)
- **Payments:** Stripe Connect (Express accounts for fund managers)
- **Deploy:** Vercel
- **Charts:** Recharts
- **Share cards:** html-to-image

## Revenue Model

- dopl takes **10% of every subscription** via Stripe Connect `application_fee_percent`
- Fund manager sets their own price
- User pays the fund manager price. dopl fee is invisible, taken from the FM cut.

## Terminology (enforce strictly)

- **ALWAYS use:** fund manager, strategist, portfolio, infrastructure, dopler, subscriber
- **NEVER use:** creator, SaaS, copy trading, robo-advisor, follower-as-copier
- `dopl` is always lowercase (never "Dopl", "DOPL", etc.)

## Database

See `supabase/schema.sql` for the full schema and RLS policies.

## Folder structure

```
dopl-app/
  CLAUDE.md            — this file (engineering reference)
  CLAUDE-BRAND.md      — brand + design system
  AGENTS.md            — Next.js 16 agent rules (read before writing Next code)
  PIPELINE.md          — 3-instance development workflow
  STATUS.md            — living project summary
  plans/               — implementation plans (YYYY-MM-DD-description.md)
  research/            — research artifacts (audits, competitive analysis)
  docs/
    CHANGELOG.md       — reverse-chronological commit log
    SECURITY-CHECKLIST.md — security audit checklist
  src/                 — Next.js app source
  supabase/            — schema.sql and migrations
  public/              — static assets
```

## Conventions

- **No `any` types** — proper TypeScript types
- **Supabase auth:** use `getUser()` in API routes, never `getSession()` (session can be spoofed)
- **No client components import `supabase-admin`** — server role key must never hit the client bundle
- **camelCase** variables/functions, **PascalCase** types/components, **snake_case** DB columns
- `@/` alias for `src/`

## Development Pipeline

This repo uses a 3-instance Claude Code pipeline (Architect / Reviewer / Implementer). See `PIPELINE.md` for the full workflow, role responsibilities, and handoff format.

Branch naming:
- `feat/xxx` — new features
- `fix/xxx` — bug fixes
- `chore/xxx` — non-code changes (docs, deps, config)

Implementer (Instance 3) commits to a feature branch and runs `npm test` + `npm run build` green before handing off. Surfer does NOT run a local browser test — he smokes on the deployed Vercel site (`dopl-app.vercel.app`) after the branch merges to main.

**Merge + push policy:**
- **First-merge of a new sprint:** Surfer merges + pushes manually, then runs the manual browser smoke on the live prod URL.
- **Hotfix iteration rounds** (Sprint 3 R1–R5, Sprint 4 hotfix rounds, etc.): Claude auto-merges + pushes once tests + build are green on the feature branch. Surfer smokes on prod. If bugs, another hotfix branch → auto-merge → re-smoke.

**Pre-merge local verification** (Instance 3's job, NOT Surfer's):
- `npm test` green
- `npm run build` clean with critical env vars unset
- No new TypeScript errors

**Post-merge verification** (Surfer's job on prod):
- Vercel auto-deploys on push to main
- Surfer runs the sprint's manual smoke checklist against `dopl-app.vercel.app`
- Any failure → new hotfix branch → Claude merges + pushes → Surfer re-smokes

See `feedback_no_auto_push.md` memory for the full policy including when Claude must wait vs. when Claude auto-merges.

## Next 16 gotchas

- **`useSearchParams` inside a statically-generated page requires a `<Suspense>` wrap** — Next 16's static-generation check fails the build otherwise. Pattern: wrap the consumer component in `<Suspense fallback={null}>`. Discovered during Sprint 4 implementation of `/oauth-return`.

## Changelog Protocol

**Every merge must add an entry to `docs/CHANGELOG.md`**, most recent entry at the top. Format:

```
## [YYYY-MM-DD] — Short description

**Files changed:**
- `path/to/file.ts` — what changed and why

**Why:** Motivation / root cause
**Impact:** What this affects
**Testing:** What was tested (`npm test`, manual)
**Risks:** Known risks, or "None"
```

## Environment Variables

See `.env.example` at repo root for the full list. Summary:

- `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public
- `SUPABASE_SERVICE_ROLE_KEY` — server-only
- `SNAPTRADE_CLIENT_ID`, `SNAPTRADE_CONSUMER_KEY` — broker integration
- `SALTEDGE_APP_ID`, `SALTEDGE_SECRET` — bank integration
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — payments

## Gotchas

- **Next.js 16:** Breaking changes vs older versions. See `AGENTS.md` and read `node_modules/next/dist/docs/` before writing Next-specific code. Heed deprecation notices.
- **Salt Edge `provider_codes`:** Previously caused a bug; `src/lib/saltedge.ts` explicitly strips it. Don't add it back.
- **RLS is enabled** on every table. API routes that mutate data must check ownership even with RLS in place (defense in depth).
- **Stripe webhook** verifies signatures. Never disable.

## Team

- **Jiggy** — product + Jiggy owns the repo, Vercel, Supabase, and Stripe accounts. Does deployments.
- **Surfer (Alok)** — engineering. Push access to repo. Does not manage deployments.
- **Yazan** — co-founder, business and ops.
