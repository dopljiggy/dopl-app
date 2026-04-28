# dopl-app — Project Status

**Last updated:** 2026-04-28 (Sprint 8 closed, Sprint 9 ready for review)
**Updated by:** Instance 1 (Architect)

---

## What dopl-app is

Portfolio transparency platform for fund managers. Fund managers connect their brokerage read-only via SnapTrade, publish subscription tiers, and subscribers (doplers) pay to follow the live portfolio. When positions change, subscribers get notified.

Revenue: 10% platform fee via Stripe Connect `application_fee_percent`.

Production: `dopl-app.vercel.app` — live with 4 fund managers (Jack, Jay, Yazan, Sami).

---

## Current state

| Metric | Value |
|--------|-------|
| Branch | `main` (all Sprint 8 work merged + hotfixes pushed) |
| Tests | 145 passing, build clean |
| Framework | Next.js 16.2.3 + React 19.2.4 + Tailwind v4 |
| Deploy | Vercel (region: cdg1 / Paris) |
| Pipeline | 3-instance (Architect / Reviewer / Implementer) per PIPELINE.md |
| In flight | Sprint 9 — plan at `draft`, ready for Instance 2 review |

---

## Sprint timeline

| Sprint | Theme | Status | Closed |
|--------|-------|--------|--------|
| 1 | Launch readiness | done | 2026-04-20 |
| 2 | Notification loop v1 | done | 2026-04-20 |
| 3 | Ship to real users (Phase 1) | done | 2026-04-21 |
| 4 | UX polish | done | 2026-04-21 |
| 5 | FM activity + dopler /me (Phase 2) | done | 2026-04-22 |
| 6 | Position flow + sandbox | done | 2026-04-22 |
| 7 | Dopler deep-link CTAs | done | 2026-04-27 |
| 8 | Regulatory + polish + performance | done | 2026-04-28 |
| 9 | Web push + Apple Sports design | draft | — |

---

## What Sprint 8 shipped

**Regulatory (Tasks 1-4):**
- Deleted 7 dopler-side trading API routes + TradingConnect component
- Removed proxy gate that redirected doplers to /welcome based on trading_connected
- Simplified welcome onboarding (removed broker connect OAuth step)

**Broker Preference (Tasks 5-13):**
- New `trading_broker_preference` text column on profiles
- Simple dropdown picker (Robinhood, Fidelity, Schwab, Webull, IB, Coinbase, Trading 212, Wealthsimple, Other)
- Broker homepage map for deep-link CTAs — all 8 named brokers have working URLs
- "Other" shows no broker CTA (copy ticker only)
- Integrated into settings, dopler shell, notification bell, popup, notifications page
- Broker picker added to welcome onboarding flow (step 3, with skip option)

**UX Polish (Tasks 14-15 + hotfixes):**
- Role-aware homepage CTAs (dopler → "your feed", FM → "your dashboard", logged out → "launch your fund")
- PWA safe-area-inset-top for Dynamic Island
- Fixed FM mobile Safari PWA onboarding loop (hard navigation instead of router.replace)
- Fixed notification popup safe-area overflow (dvh + safe-area-inset-top)
- Removed capsule active-tab indicator from both mobile nav bars (color-only)
- Fixed content/nav overlap on both dopler + FM mobile shells
- Share card scales proportionally on mobile viewports

**Performance (Tasks 16-23):**
- Parallelized queries on 5 pages (dashboard, feed, positions, portfolio detail, settings)
- React.cache getUser dedup across dashboard layout + child pages
- Eager prefetch on all primary nav links
- Manifest `id` field for iOS push (Sprint 9 prep)

---

## What happens next

1. **Now:** Sprint 9 plan moves from `draft` to `under-review`.
2. Sprint 9 goes through the standard pipeline: Instance 2 review → Instance 3 implement → Instance 2 implementation review → merge.

---

## Outstanding risks + flagged items

- **Stripe Connect AE→US restriction** — Jiggy action item.
- **Free subscribe double-click race** — `/api/subscriptions/free` could double-increment `subscriber_count`.
- **Rate limiting absent** — no per-endpoint rate limits on public routes.

---

## Key references

| Document | Purpose |
|----------|---------|
| `CLAUDE.md` | Engineering reference |
| `CLAUDE-BRAND.md` | Brand + design system |
| `PIPELINE.md` | 3-instance workflow |
| `plans/2026-04-27-sprint-8-regulatory-polish-perf.md` | Sprint 8 plan (closed) |
| `plans/2026-04-27-sprint-9-web-push-apple-sports.md` | Sprint 9 plan (draft) |
| `docs/superpowers/specs/2026-04-27-sprint-8-9-design.md` | Design spec for both sprints |
