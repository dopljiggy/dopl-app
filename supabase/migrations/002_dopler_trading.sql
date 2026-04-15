-- Dopler trading connection columns.
-- A dopler's trading connection exists so that notifications can deep-link
-- them back to their brokerage/bank when a fund manager updates a position.

alter table public.profiles
  add column if not exists trading_provider text;
alter table public.profiles
  add column if not exists trading_connected boolean default false;
alter table public.profiles
  add column if not exists trading_connection_data jsonb default '{}'::jsonb;
