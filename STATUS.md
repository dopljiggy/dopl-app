# dopl-app — Project Status

**Last updated:** 2026-05-05 (Sprint 15 merged, pending migration + smoke)
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
| Branch | `main` (Sprint 15 merged) |
| Tests | 143 passing (26 files), build clean |
| Framework | Next.js 16.2.3 + React 19.2.4 + Tailwind v4 |
| Deploy | Vercel (region: cdg1 / Paris) |
| Pipeline | 3-instance (Architect / Reviewer / Implementer) per PIPELINE.md |
| Stripe platform | **Canada-based** (migrated from AE, 2026-05-04) |
| In flight | Sprint 15 merged; **pending migration SQL + smoke test** |

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
| 15 | Multi-broker connections + centralized position pool | done | 2026-05-05 |

---

## What Sprint 15 shipped

**Multi-Broker Connections + Centralized Position Pool** — 9 commits, 25 files, +2944/-1351

**Architecture changes:**
- New `broker_connections` table — FMs can connect N brokers (any mix of SnapTrade + SaltEdge + manual) simultaneously
- `positions.portfolio_id` now nullable — NULL means "in the centralized pool (unassigned)"
- `positions.broker_connection_id` FK tracks which broker each position came from
- Unique constraint `(broker_connection_id, ticker)` — same ticker at different brokers = separate line items
- RLS rewritten: pool positions visible only to owning FM, subscribers never see pool

**New files:**
- `supabase/migrations/006_multi_broker_connections.sql` — schema + data migration
- `src/lib/sync-connection.ts` — per-connection sync engine with sold-at-broker detection, ticker aggregation, partial-failure safety
- `src/app/api/broker/connections/route.ts` + `[id]/route.ts` — CRUD for broker connections
- `src/app/api/broker/sync-all/route.ts` — sync all connections at once
- `src/components/connect/broker-connection-card.tsx` — per-connection card component

**Modified flows:**
- **Connect page:** List of connection cards + "Add Broker" button (replaces binary connected/not-connected)
- **Positions page:** Left panel = centralized pool grouped by broker; right panel = portfolios. Checkbox + "Assign to Portfolio" batch assignment. "Unassign" returns positions to pool.
- **Sync engine:** Per-connection sync with intra-connection ticker aggregation (handles brokerage + IRA both holding AAPL). Partial sync failure skips sold-detection to prevent false deletions.
- **Position lifecycle:** Pool (portfolio_id=NULL) → assign (UPDATE portfolio_id) → unassign (SET NULL) → sold (DELETE + fanout)
- **SnapTrade/SaltEdge callbacks:** Create `broker_connections` rows per authorization
- **Portfolio cards:** Broker badge on each position row
- **Backward compat:** Dual-write to old `fund_managers` columns (broker_connected, broker_name, broker_provider). Old assign/delete API shapes still work.

**Removed:**
- `src/lib/position-diff.ts` — sold detection moved into sync-connection.ts
- `SwitchProviderModal` — no longer needed (add connections freely, don't switch)

---

## What happens next

1. **Surfer (NOW):** Run migration — paste `supabase/migrations/006_multi_broker_connections.sql` into Supabase SQL editor
2. **Surfer (NOW):** Smoke test Sprint 15 on `dopl-app.vercel.app` (10-step checklist below)
3. **Surfer:** Complete Stripe CA live mode setup (enable countries, verify Connect, test with real FM)
4. **Surfer:** Add reset-password URLs to Supabase redirect allow-list
5. **Next sprint:** TBD — waiting for Surfer direction

### Sprint 15 Smoke Checklist

1. /dashboard/connect → "Add Broker" button visible
2. Connect a broker via SnapTrade OAuth → broker card appears with position count
3. Connect a second broker → two cards on connect page
4. Sync one card → only that broker syncs
5. Disconnect one → other stays
6. /dashboard/positions → pool shows positions grouped by broker
7. Check positions → "Assign to Portfolio" → positions move to portfolio
8. "Unassign" on portfolio position → returns to pool
9. Manual position entry → appears under "Manual Entry" in pool
10. Portfolio cards show broker badges on positions

---

## Outstanding risks + flagged items

- **Migration pending** — Sprint 15 code is deployed but `006_multi_broker_connections.sql` must be run in Supabase before the new features work.
- **Stripe CA live mode** — sandbox confirmed working; live mode needs countries enabled + Connect activated before production FMs can onboard.
- **Free subscribe double-click race** — `/api/subscriptions/free` could double-increment `subscriber_count`.
- **Rate limiting absent** — no per-endpoint rate limits on public routes.
- **Supabase redirect URLs** — must add reset-password URLs for forgot-password flow to work.
- **SnapTrade connection limits** — free tier = 5 connections per user. FMs connecting 6+ brokers will hit the limit.

---

## Key references

| Document | Purpose |
|----------|---------|
| `CLAUDE.md` | Engineering reference |
| `CLAUDE-BRAND.md` | Brand + design system |
| `PIPELINE.md` | 3-instance workflow |
| `IMPROVEMENT.md` | Sprint 14 feedback collection (30 items) |
| `docs/CHANGELOG.md` | Reverse-chronological commit log |
