-- Migration 007: Portfolio delete returns positions to pool (Sprint 16)
--
-- The original schema declared positions.portfolio_id with ON DELETE
-- CASCADE. Under the Sprint 15 pool model, deleting a portfolio should
-- send its positions back to the centralized pool (portfolio_id = NULL),
-- not destroy them. Manual positions are otherwise unrecoverable, and
-- broker-synced positions only reappear after a manual sync.
--
-- DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT mirrors the idempotency
-- pattern from migration 006 — re-running the file is a no-op.

ALTER TABLE public.positions
  DROP CONSTRAINT IF EXISTS positions_portfolio_id_fkey;

ALTER TABLE public.positions
  ADD CONSTRAINT positions_portfolio_id_fkey
    FOREIGN KEY (portfolio_id)
    REFERENCES public.portfolios(id)
    ON DELETE SET NULL;
