# CLAUDE.md — dopl Engineering Reference

Auto-loaded by Claude Code sessions in this repo. Contains the hard facts needed to build correctly. Design system lives in `CLAUDE-BRAND.md`. 3-instance workflow lives in `PIPELINE.md`.

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

Implementer (Instance 3) commits to a feature branch locally and does NOT push. Surfer verifies locally (`npm test`, `npm run build`, manual browser check) and pushes/merges manually.

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
