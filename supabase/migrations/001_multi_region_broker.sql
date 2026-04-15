-- Multi-region broker connect: adds region + Salt Edge columns.
-- Run in Supabase SQL Editor.

alter table public.fund_managers add column if not exists region text;
alter table public.fund_managers add column if not exists broker_provider text default 'snaptrade';
alter table public.fund_managers add column if not exists saltedge_customer_id text;
alter table public.fund_managers add column if not exists saltedge_connection_id text;
