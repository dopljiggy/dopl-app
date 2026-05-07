-- Migration 008: portfolios.display_order for custom-sort UI (Sprint 17)
--
-- The portfolios page + new trade page expose four standard sorts (date,
-- market value, position count, subscriber count) plus a "Custom order"
-- mode where the FM drags portfolios into the sequence they want shown
-- to subscribers. display_order persists that custom sequence.
--
-- NOT NULL DEFAULT 0 keeps every row sortable without a follow-up
-- backfill — pre-existing portfolios all start at 0 and tiebreak on
-- created_at ASC. New portfolios are stamped with `max(existing) + 1`
-- by /api/portfolios POST so they land at the end of custom order.
--
-- Idempotent (ADD COLUMN IF NOT EXISTS) — re-running is a no-op.

ALTER TABLE public.portfolios
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;
