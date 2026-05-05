-- Migration 006: Multi-broker connections + centralized position pool (Sprint 15)
--
-- Replaces the single-broker model on fund_managers with a separate
-- broker_connections table that supports N connections per FM (any mix of
-- snaptrade + saltedge + manual). Positions get a broker_connection_id FK
-- and gain a "centralized pool" lifecycle via nullable portfolio_id.
--
-- Lifecycle:
--   sync   → INSERT/UPDATE position (broker_connection_id=X, portfolio_id=NULL) → pool
--   assign → UPDATE position SET portfolio_id=Y                                 → portfolio
--   unassign → UPDATE position SET portfolio_id=NULL                            → back to pool
--   sell   → DELETE position + sell fanout if portfolio_id was set              → gone
--
-- Old fund_managers columns (broker_connected, broker_name, broker_provider,
-- saltedge_connection_id) stay populated via dual-write; full removal lands
-- in a future sprint.
--
-- Idempotent: every statement uses IF NOT EXISTS / IF EXISTS guards.

-- ---------------------------------------------------------------------------
-- 1. broker_connections table
-- ---------------------------------------------------------------------------

create table if not exists public.broker_connections (
  id uuid primary key default uuid_generate_v4(),
  fund_manager_id uuid not null references public.fund_managers(id) on delete cascade,
  provider text not null check (provider in ('snaptrade', 'saltedge', 'manual')),
  provider_auth_id text,
  broker_name text not null,
  is_active boolean default true,
  last_synced timestamptz,
  created_at timestamptz default now()
);

create index if not exists broker_connections_fm_idx
  on public.broker_connections(fund_manager_id);

create index if not exists broker_connections_active_idx
  on public.broker_connections(fund_manager_id, is_active);

-- One auth_id per (FM, provider). Partial unique so manual rows (NULL
-- provider_auth_id) don't collide with each other.
create unique index if not exists broker_connections_unique_auth
  on public.broker_connections(fund_manager_id, provider, provider_auth_id)
  where provider_auth_id is not null;

alter table public.broker_connections enable row level security;

drop policy if exists "FMs view own broker connections" on public.broker_connections;
create policy "FMs view own broker connections" on public.broker_connections
  for select using (auth.uid() = fund_manager_id);

drop policy if exists "FMs manage own broker connections" on public.broker_connections;
create policy "FMs manage own broker connections" on public.broker_connections
  for all using (auth.uid() = fund_manager_id);

-- ---------------------------------------------------------------------------
-- 2. positions table changes
-- ---------------------------------------------------------------------------

alter table public.positions
  add column if not exists broker_connection_id uuid
    references public.broker_connections(id) on delete cascade;

alter table public.positions
  alter column portfolio_id drop not null;

create index if not exists positions_broker_connection_idx
  on public.positions(broker_connection_id);

-- One ticker per connection. NULL broker_connection_id (legacy / pool-less)
-- doesn't trigger uniqueness.
create unique index if not exists positions_connection_ticker_unique
  on public.positions(broker_connection_id, ticker)
  where broker_connection_id is not null;

-- ---------------------------------------------------------------------------
-- 3. RLS policies on positions
-- ---------------------------------------------------------------------------

drop policy if exists "Positions viewable by subscribers or free tier" on public.positions;
drop policy if exists "Fund managers can manage positions" on public.positions;

-- Subscribers / free-tier viewers see ASSIGNED positions only.
-- Pool positions (portfolio_id IS NULL) are invisible to them.
create policy "Subscribers view assigned positions" on public.positions
  for select using (
    portfolio_id is not null and exists (
      select 1 from public.portfolios p
      where p.id = portfolio_id and (
        p.tier = 'free'
        or exists (
          select 1 from public.subscriptions s
          where s.portfolio_id = p.id
            and s.user_id = auth.uid()
            and s.status = 'active'
        )
        or p.fund_manager_id = auth.uid()
      )
    )
  );

-- FMs manage their own positions via either path:
--   - assigned: portfolio.fund_manager_id = auth.uid()
--   - pool:     broker_connection.fund_manager_id = auth.uid()
create policy "FMs manage own positions" on public.positions
  for all using (
    (
      portfolio_id is not null and exists (
        select 1 from public.portfolios p
        where p.id = portfolio_id and p.fund_manager_id = auth.uid()
      )
    )
    or (
      broker_connection_id is not null and exists (
        select 1 from public.broker_connections bc
        where bc.id = broker_connection_id and bc.fund_manager_id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Data migration: backfill broker_connections + positions.broker_connection_id
-- ---------------------------------------------------------------------------

-- 4a. INSERT one broker_connection per existing FM that has a broker
-- connected. The provider_auth_id is left NULL — sync-connection.ts
-- self-heals SnapTrade rows by calling listBrokerageAuthorizations() and
-- matching by institution name. SaltEdge rows pull provider_auth_id from
-- fund_managers.saltedge_connection_id when available.
insert into public.broker_connections (
  fund_manager_id, provider, provider_auth_id, broker_name, is_active
)
select
  fm.id,
  coalesce(fm.broker_provider, 'snaptrade'),
  case
    when fm.broker_provider = 'saltedge' then fm.saltedge_connection_id
    else null
  end,
  coalesce(fm.broker_name, 'Broker'),
  true
from public.fund_managers fm
where fm.broker_connected = true
  and not exists (
    select 1 from public.broker_connections bc
    where bc.fund_manager_id = fm.id
      and bc.provider = coalesce(fm.broker_provider, 'snaptrade')
  );

-- 4b. INSERT a Manual Entry connection for every FM that has a Manual
-- Holdings portfolio. Catches FMs whose broker_provider isn't 'manual'
-- but who also have manually-entered positions tracked separately.
insert into public.broker_connections (
  fund_manager_id, provider, provider_auth_id, broker_name, is_active
)
select distinct
  p.fund_manager_id,
  'manual',
  null,
  'Manual Entry',
  true
from public.portfolios p
where p.name = 'Manual Holdings'
  and not exists (
    select 1 from public.broker_connections bc
    where bc.fund_manager_id = p.fund_manager_id
      and bc.provider = 'manual'
  );

-- 4c. UPDATE positions to set broker_connection_id. Manual Holdings
-- positions get the manual connection; everything else gets the FM's
-- non-manual connection.
update public.positions pos
set broker_connection_id = bc.id
from public.portfolios p, public.broker_connections bc
where pos.portfolio_id = p.id
  and pos.broker_connection_id is null
  and bc.fund_manager_id = p.fund_manager_id
  and bc.provider = 'manual'
  and p.name = 'Manual Holdings';

update public.positions pos
set broker_connection_id = bc.id
from public.portfolios p, public.broker_connections bc
where pos.portfolio_id = p.id
  and pos.broker_connection_id is null
  and bc.fund_manager_id = p.fund_manager_id
  and bc.provider <> 'manual'
  and p.name <> 'Manual Holdings';
