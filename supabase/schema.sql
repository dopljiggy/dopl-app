-- dopl Phase 0 Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users table (extends Supabase auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  role text not null default 'subscriber' check (role in ('fund_manager', 'subscriber')),
  created_at timestamptz default now()
);

-- Fund managers
create table public.fund_managers (
  id uuid primary key references public.profiles(id) on delete cascade,
  handle text unique not null,
  display_name text not null,
  bio text,
  avatar_url text,
  banner_url text,
  links jsonb default '[]'::jsonb,
  snaptrade_user_id text,
  snaptrade_user_secret text,
  broker_connected boolean default false,
  broker_name text,
  stripe_account_id text,
  stripe_onboarded boolean default false,
  subscriber_count integer default 0,
  is_featured boolean default false,
  created_at timestamptz default now()
);

-- Portfolios
create table public.portfolios (
  id uuid primary key default uuid_generate_v4(),
  fund_manager_id uuid not null references public.fund_managers(id) on delete cascade,
  name text not null,
  description text,
  tier text not null default 'free' check (tier in ('free', 'basic', 'premium', 'vip')),
  price_cents integer not null default 0,
  is_active boolean default true,
  subscriber_count integer default 0,
  created_at timestamptz default now()
);

-- Broker connections — one row per OAuth/manual connection. FMs have N.
-- Migration 006 (2026-05-05). Replaces the single-broker model on
-- fund_managers. Old fund_managers columns (broker_connected, broker_name,
-- broker_provider, saltedge_connection_id) stay populated via dual-write
-- until full removal in a later sprint.
create table public.broker_connections (
  id uuid primary key default uuid_generate_v4(),
  fund_manager_id uuid not null references public.fund_managers(id) on delete cascade,
  provider text not null check (provider in ('snaptrade', 'saltedge', 'manual')),
  provider_auth_id text,
  broker_name text not null,
  is_active boolean default true,
  last_synced timestamptz,
  created_at timestamptz default now()
);

create index broker_connections_fm_idx on public.broker_connections(fund_manager_id);
create index broker_connections_active_idx on public.broker_connections(fund_manager_id, is_active);
create unique index broker_connections_unique_auth
  on public.broker_connections(fund_manager_id, provider, provider_auth_id)
  where provider_auth_id is not null;

-- Positions within portfolios.
-- portfolio_id is NULLABLE — NULL means "in the centralized pool" (synced
-- from broker but not yet assigned to a portfolio). broker_connection_id
-- is the source connection; cascades on connection delete.
create table public.positions (
  id uuid primary key default uuid_generate_v4(),
  portfolio_id uuid references public.portfolios(id) on delete cascade,
  broker_connection_id uuid references public.broker_connections(id) on delete cascade,
  ticker text not null,
  name text,
  allocation_pct decimal,
  shares decimal,
  market_value decimal,
  entry_price decimal,
  current_price decimal,
  gain_loss_pct decimal,
  sector text,
  asset_type text default 'stock' check (asset_type in ('stock', 'etf', 'crypto', 'option', 'other')),
  last_synced timestamptz,
  created_at timestamptz default now()
);

create index positions_broker_connection_idx on public.positions(broker_connection_id);
create unique index positions_connection_ticker_unique
  on public.positions(broker_connection_id, ticker)
  where broker_connection_id is not null;

-- Portfolio updates (for notification history)
create table public.portfolio_updates (
  id uuid primary key default uuid_generate_v4(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  fund_manager_id uuid not null references public.fund_managers(id) on delete cascade,
  update_type text not null check (update_type in ('position_added', 'position_removed', 'rebalanced', 'note')),
  description text,
  thesis_note text,
  created_at timestamptz default now()
);

-- Subscriptions
create table public.subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  fund_manager_id uuid not null references public.fund_managers(id) on delete cascade,
  stripe_subscription_id text,
  status text not null default 'active' check (status in ('active', 'cancelled', 'past_due')),
  price_cents integer,
  created_at timestamptz default now(),
  cancelled_at timestamptz
);

-- Notifications
create table public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  portfolio_update_id uuid references public.portfolio_updates(id) on delete cascade,
  title text not null,
  body text,
  read boolean default false,
  created_at timestamptz default now()
);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.fund_managers enable row level security;
alter table public.portfolios enable row level security;
alter table public.positions enable row level security;
alter table public.portfolio_updates enable row level security;
alter table public.subscriptions enable row level security;
alter table public.notifications enable row level security;

-- Profiles: users can read all, update own
create policy "Profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Fund managers: public read, owner write
create policy "Fund managers are viewable by everyone" on public.fund_managers for select using (true);
create policy "Fund managers can update own" on public.fund_managers for update using (auth.uid() = id);
create policy "Fund managers can insert own" on public.fund_managers for insert with check (auth.uid() = id);

-- Portfolios: public read for active, owner write
create policy "Active portfolios are viewable by everyone" on public.portfolios for select using (is_active = true);
create policy "Fund managers can manage own portfolios" on public.portfolios for all using (auth.uid() = fund_manager_id);

-- Broker connections: FM-only.
alter table public.broker_connections enable row level security;
create policy "FMs view own broker connections" on public.broker_connections for select using (auth.uid() = fund_manager_id);
create policy "FMs manage own broker connections" on public.broker_connections for all using (auth.uid() = fund_manager_id);

-- Positions: subscribers / free-tier viewers see ASSIGNED positions only
-- (portfolio_id IS NOT NULL). Pool positions are FM-only.
create policy "Subscribers view assigned positions" on public.positions for select using (
  portfolio_id is not null and exists (
    select 1 from public.portfolios p
    where p.id = portfolio_id and (
      p.tier = 'free' or
      exists (
        select 1 from public.subscriptions s
        where s.portfolio_id = p.id and s.user_id = auth.uid() and s.status = 'active'
      ) or
      p.fund_manager_id = auth.uid()
    )
  )
);
create policy "FMs manage own positions" on public.positions for all using (
  (
    portfolio_id is not null and exists (
      select 1 from public.portfolios p
      where p.id = portfolio_id and p.fund_manager_id = auth.uid()
    )
  )
  or
  (
    broker_connection_id is not null and exists (
      select 1 from public.broker_connections bc
      where bc.id = broker_connection_id and bc.fund_manager_id = auth.uid()
    )
  )
);

-- Portfolio updates: public read
create policy "Portfolio updates are viewable by everyone" on public.portfolio_updates for select using (true);
create policy "Fund managers can create updates" on public.portfolio_updates for insert with check (auth.uid() = fund_manager_id);

-- Subscriptions: user can see own, fund manager can see theirs
create policy "Users can view own subscriptions" on public.subscriptions for select using (auth.uid() = user_id);
create policy "Fund managers can view their subscribers" on public.subscriptions for select using (auth.uid() = fund_manager_id);
create policy "Users can manage own subscriptions" on public.subscriptions for all using (auth.uid() = user_id);

-- Notifications: user can see own
create policy "Users can view own notifications" on public.notifications for select using (auth.uid() = user_id);
create policy "Users can update own notifications" on public.notifications for update using (auth.uid() = user_id);

-- Function: auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Enable realtime for notifications
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.portfolio_updates;

-- Function to increment subscriber counts
create or replace function increment_subscriber_count(
  p_portfolio_id uuid,
  p_fund_manager_id uuid
) returns void as $$
begin
  update public.portfolios
  set subscriber_count = subscriber_count + 1
  where id = p_portfolio_id;

  update public.fund_managers
  set subscriber_count = subscriber_count + 1
  where id = p_fund_manager_id;
end;
$$ language plpgsql security definer;

-- Multi-region broker connect additions (2026-04-15)
alter table public.fund_managers add column if not exists region text;
alter table public.fund_managers add column if not exists broker_provider text default 'snaptrade';
alter table public.fund_managers add column if not exists saltedge_customer_id text;
alter table public.fund_managers add column if not exists saltedge_connection_id text;

-- Dopler trading connect was removed in Sprint 8 (regulatory). The
-- columns trading_provider / trading_connected / trading_connection_data
-- are dropped via migration 005_schema_audit.sql; intentionally NOT
-- declared in this base schema.
