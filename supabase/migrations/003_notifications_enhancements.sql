alter table public.notifications
  add column if not exists actionable boolean not null default true,
  add column if not exists change_type text check (
    change_type is null or change_type in ('buy', 'sell', 'rebalance', 'summary', 'note')
  ),
  add column if not exists ticker text,
  add column if not exists meta jsonb default '{}'::jsonb;

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
