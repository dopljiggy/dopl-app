-- Sprint 5 migration 004.
-- (a) Broaden notifications.change_type to include FM-side events.
--     Subscriber-facing types: buy, sell, rebalance, summary, note (existing).
--     FM-facing types: subscription_added, subscription_cancelled (new).
-- (b) Add UNIQUE constraint on subscriptions.stripe_subscription_id so that
--     concurrent Stripe webhook retries cannot double-insert (BLOCKER fix
--     per Instance 2 rev-1 review). Free-tier subs leave stripe_subscription_id
--     NULL, and Postgres UNIQUE allows multiple NULL values, so free subs
--     are unaffected.
-- Both changes wrapped in a single transaction so a failure on (b) rolls
-- back (a) — the table cannot end up constraint-less.

BEGIN;

alter table public.notifications
  drop constraint if exists notifications_change_type_check;

alter table public.notifications
  add constraint notifications_change_type_check
  check (
    change_type is null
    or change_type in (
      'buy',
      'sell',
      'rebalance',
      'summary',
      'note',
      'subscription_added',
      'subscription_cancelled'
    )
  );

alter table public.subscriptions
  add constraint subscriptions_stripe_sub_id_key
  unique (stripe_subscription_id);

COMMIT;

-- No new index needed — (user_id, created_at desc) from 003 is sufficient
-- for change_type filtering. The UNIQUE constraint on stripe_subscription_id
-- creates its own b-tree index automatically.
