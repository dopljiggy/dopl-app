export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: "fund_manager" | "subscriber";
  created_at: string;
}

export interface FundManager {
  id: string;
  handle: string;
  display_name: string;
  bio: string | null;
  banner_url: string | null;
  avatar_url: string | null;
  links: { platform: string; url: string }[];
  snaptrade_user_id: string | null;
  snaptrade_user_secret: string | null;
  broker_connected: boolean;
  broker_name: string | null;
  stripe_account_id: string | null;
  stripe_onboarded: boolean;
  subscriber_count: number;
  is_featured: boolean;
  created_at: string;
  portfolio_count?: number;
}

export interface Portfolio {
  id: string;
  fund_manager_id: string;
  name: string;
  description: string | null;
  tier: "free" | "basic" | "premium" | "vip";
  price_cents: number;
  is_active: boolean;
  subscriber_count: number;
  created_at: string;
}

export interface BrokerConnection {
  id: string;
  fund_manager_id: string;
  provider: "snaptrade" | "saltedge" | "manual";
  provider_auth_id: string | null;
  broker_name: string;
  is_active: boolean;
  last_synced: string | null;
  created_at: string;
}

export interface Position {
  id: string;
  // NULL = position is in the centralized pool (synced from broker but
  // not yet assigned to a subscribable portfolio). Sprint 15.
  portfolio_id: string | null;
  // NULL on legacy rows pre-migration-006; backfilled by migration to
  // point at the connection that originated the position.
  broker_connection_id: string | null;
  ticker: string;
  name: string | null;
  allocation_pct: number | null;
  shares: number | null;
  market_value: number | null;
  entry_price: number | null;
  current_price: number | null;
  gain_loss_pct: number | null;
  sector: string | null;
  asset_type: "stock" | "etf" | "crypto" | "option" | "other";
  last_synced: string | null;
  created_at: string;
}

export interface PortfolioUpdate {
  id: string;
  portfolio_id: string;
  fund_manager_id: string;
  update_type: "position_added" | "position_removed" | "rebalanced" | "note";
  description: string | null;
  thesis_note: string | null;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  portfolio_id: string;
  fund_manager_id: string;
  stripe_subscription_id: string | null;
  status: "active" | "cancelled" | "past_due";
  price_cents: number | null;
  created_at: string;
  cancelled_at: string | null;
}

export interface Notification {
  id: string;
  user_id: string;
  portfolio_update_id: string | null;
  title: string;
  body: string | null;
  read: boolean;
  actionable: boolean;
  change_type:
    | "buy"
    | "sell"
    | "rebalance"
    | "summary"
    | "note"
    | "subscription_added"
    | "subscription_cancelled"
    | null;
  ticker: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}
