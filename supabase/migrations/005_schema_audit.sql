-- Migration 005: Schema audit cleanup (Sprint 13)
--
-- Reconciles drift between schema.sql and the live database surfaced
-- during Sprint 12. Two changes:
--
-- 1. fund_managers.avatar_url — exists in the live DB (manually ALTERed
--    around 2026-04-30 to unblock the avatar bug fix) but was missing
--    from the base CREATE in schema.sql. The IF NOT EXISTS guard makes
--    this a no-op against the live DB while keeping fresh installs from
--    schema.sql consistent.
--
-- 2. profiles.trading_provider / trading_connected / trading_connection_data
--    — added in migration 002_dopler_trading.sql but the dopler trading
--    feature was fully removed in Sprint 8 (regulatory). No code path
--    reads or writes these columns anymore (verified via grep across
--    src/). Drop them to clean up dead state.
--
-- All four statements are idempotent; safe to re-run.

alter table public.fund_managers add column if not exists avatar_url text;

alter table public.profiles drop column if exists trading_provider;
alter table public.profiles drop column if exists trading_connected;
alter table public.profiles drop column if exists trading_connection_data;
