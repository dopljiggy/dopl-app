# dopl-app — Project Status

**Last updated:** 2026-05-04 (Sprint 14 closed, hotfixes pushed, Stripe migrated to CA)
**Updated by:** Instance 1 (Architect)

---

## What dopl-app is

Portfolio transparency platform for fund managers. Fund managers connect their brokerage read-only via SnapTrade, publish subscription tiers, and subscribers (doplers) pay to follow the live portfolio. When positions change, subscribers get notified.

Revenue: 10% platform fee via Stripe Connect `application_fee_percent`.

Production: `dopl-app.vercel.app` — live with fund managers onboarding.

---

## Current state

| Metric | Value |
|--------|-------|
| Branch | `main` (Sprint 14 + hotfixes + Stripe CA migration merged) |
| Tests | 152 passing (27 files), build clean |
| Framework | Next.js 16.2.3 + React 19.2.4 + Tailwind v4 |
| Deploy | Vercel (region: cdg1 / Paris) |
| Pipeline | 3-instance (Architect / Reviewer / Implementer) per PIPELINE.md |
| Stripe platform | **Canada-based** (migrated from AE, 2026-05-04) |
| In flight | Sprint 14 hotfixes complete; next sprint TBD |

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
| 9–12 | Various sprints | done | — |
| 13 | FM Doplers page, Calculator, CSV, Profile polish | done | 2026-05-03 |
| 14 | Team feedback improvements (30 items, 11 tasks) | done | 2026-05-04 |
| 14-hotfix | Smoke test failures + Stripe CA migration | done | 2026-05-04 |

---

## What Sprint 14 shipped

**30 improvement items from team page-by-page review:**

- **P1 fixes:** Undopl modal (portal-based, buttons work), portfolio edit (clickable pencil → centered modal), sparkline artifacts removed, allocation column read-only + auto-computed
- **Auth:** Forgot/reset password flow end-to-end
- **Homepage:** Hero subtext removed, gradient buttons, How It Works cards, footer with logo + links
- **Onboarding:** Subtexts trimmed, compact price input, empty portfolio name default
- **FM Dashboard:** Share page stripped, profile gradient sections + handle-based links, broker vertical layout + distinct switch/disconnect modals, positions richer tiles
- **Discover:** Leaderboard → card grid sorted by recent, no ranking, portfolio count shown
- **Slider:** Apple-quality spring physics, momentum carry, progressive glow, 65% threshold
- **Stripe overlay:** Branded transition on all Stripe redirects, shows immediately on slide complete
- **Auto-rebalance:** Server-side on every insert/delete, rounding correction to always sum 100%
- **Global:** Title Case across all headings + CTAs, green/red destructive button pattern

**Sprint 14 Hotfixes (post-smoke):**

- Undopl modal → `createPortal` to escape framer-motion stacking contexts
- Portfolio edit pencil → `div[role=button]` header (no nested buttons)
- Portfolio edit modal → portal to document.body (centered, not buried in card)
- Allocation column → read-only (removed stale draft state bug showing 100% for older positions)
- `recalculateAllocations` → rounding correction, always sums to exactly 100%
- Sparklines → removed entirely (fake placeholder data was confusing)
- Positions table → single "allocation" column (merged dual broker%/your%)
- Footer → mobile alignment fixed, Terms/Privacy → homepage
- Stripe overlay → 800ms min display, then immediate on slide complete
- Discover → fixed card height + reserved bio space, portfolio count shown
- Slider → fill reaches full width, softer springs
- Broker disconnect modal → better close button spacing

**Stripe Platform Migration:**

- Platform migrated from UAE (AE) to Canada (CA)
- CA platform supports cross-border Express accounts for US, GB, NL, AU, IN, AE
- Per-country region mapping restored (each FM gets local onboarding form)
- Sandbox tested — all regions work without errors
- **Pending:** Live mode setup (enable countries at dashboard.stripe.com/settings/applications/express, verify Connect active in live mode)

---

## What happens next

1. **Surfer:** Complete Stripe CA live mode setup (enable countries, verify Connect, test with real FM)
2. **Surfer:** Smoke test remaining items from Sprint 14 hotfix on `dopl-app.vercel.app`
3. **Surfer:** Add reset-password URLs to Supabase redirect allow-list
4. **Next sprint:** TBD — waiting for Surfer direction

---

## Outstanding risks + flagged items

- **Stripe CA live mode** — sandbox confirmed working; live mode needs countries enabled + Connect activated before production FMs can onboard.
- **Free subscribe double-click race** — `/api/subscriptions/free` could double-increment `subscriber_count`.
- **Rate limiting absent** — no per-endpoint rate limits on public routes.
- **Supabase redirect URLs** — must add reset-password URLs for forgot-password flow to work.

---

## Key references

| Document | Purpose |
|----------|---------|
| `CLAUDE.md` | Engineering reference |
| `CLAUDE-BRAND.md` | Brand + design system |
| `PIPELINE.md` | 3-instance workflow |
| `IMPROVEMENT.md` | Sprint 14 feedback collection (30 items) |
| `plans/2026-05-04-sprint-14-improvements.md` | Sprint 14 plan (implemented) |
| `docs/CHANGELOG.md` | Reverse-chronological commit log |
