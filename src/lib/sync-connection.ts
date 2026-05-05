import { snaptrade } from "@/lib/snaptrade";
import { saltedge } from "@/lib/saltedge";
import { extractPositions } from "@/app/api/saltedge/sync/sync";
import { fanOutPortfolioUpdate } from "@/lib/notification-fanout";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Per-connection sync engine. Sprint 15.
 *
 * Each broker_connections row gets its own pull → upsert → diff cycle.
 * Holdings land in `positions` keyed by (broker_connection_id, ticker).
 * Position lifecycle:
 *   - new ticker  → INSERT into pool (portfolio_id = NULL)
 *   - existing    → UPDATE shares/price/market_value (preserve portfolio_id)
 *   - missing     → DELETE; if it was assigned, fire a sell fanout
 *
 * Sold-detection runs ONLY when every account on a connection fetched
 * successfully. A partial failure (e.g., one account times out) skips
 * the diff entirely so we don't false-positive a "sold" on a ticker we
 * just couldn't see this round.
 *
 * Self-heal: legacy SnapTrade rows migrated from migration 006 lack a
 * provider_auth_id. On first sync we look up authorizations and match
 * by broker_name, then persist the id so future syncs are O(1).
 */

export type AdminClient = SupabaseClient;

export interface BrokerConnectionRow {
  id: string;
  fund_manager_id: string;
  provider: "snaptrade" | "saltedge" | "manual";
  provider_auth_id: string | null;
  broker_name: string;
  is_active: boolean;
}

export interface SyncResult {
  connection_id: string;
  broker_name: string;
  provider: "snaptrade" | "saltedge" | "manual";
  upserted: number;
  sold: number;
  errored: boolean;
  error?: string;
}

interface LiveHolding {
  ticker: string;
  name: string;
  shares: number | null;
  current_price: number | null;
  market_value: number | null;
  asset_type: "stock" | "etf" | "crypto" | "option" | "other";
}

// --------------------------------------------------------------------------
// SnapTrade
// --------------------------------------------------------------------------

export async function syncSnaptradeConnection(
  admin: AdminClient,
  fmId: string,
  connection: BrokerConnectionRow
): Promise<SyncResult> {
  const result: SyncResult = {
    connection_id: connection.id,
    broker_name: connection.broker_name,
    provider: "snaptrade",
    upserted: 0,
    sold: 0,
    errored: false,
  };

  const { data: fm } = await admin
    .from("fund_managers")
    .select("snaptrade_user_id, snaptrade_user_secret")
    .eq("id", fmId)
    .maybeSingle();
  if (!fm?.snaptrade_user_id || !fm?.snaptrade_user_secret) {
    return { ...result, errored: true, error: "snaptrade credentials missing" };
  }
  const userId = fm.snaptrade_user_id as string;
  const userSecret = fm.snaptrade_user_secret as string;

  // Self-heal: a row backfilled by migration 006 has provider_auth_id NULL.
  // Look up by broker_name and persist for future syncs.
  let authId = connection.provider_auth_id;
  if (!authId) {
    try {
      const auths = await snaptrade.connections.listBrokerageAuthorizations({
        userId,
        userSecret,
      });
      const match = (auths.data ?? []).find((a) => {
        const b = (a as { brokerage?: { name?: string } | string }).brokerage;
        const name = typeof b === "object" ? b?.name : undefined;
        return name === connection.broker_name;
      });
      authId = match?.id ?? null;
      if (authId) {
        await admin
          .from("broker_connections")
          .update({ provider_auth_id: authId })
          .eq("id", connection.id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "auth lookup failed";
      return { ...result, errored: true, error: msg };
    }
  }

  // Pull accounts and filter by the connection's authorization. SnapTrade
  // returns ALL accounts on the SnapTrade user; we only want this broker's.
  let accounts;
  try {
    accounts = await snaptrade.accountInformation.listUserAccounts({
      userId,
      userSecret,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "list accounts failed";
    return { ...result, errored: true, error: msg };
  }

  const matchedAccounts = (accounts.data ?? []).filter(
    (a) => a.brokerage_authorization === authId
  );

  // Walk accounts; per-account try/catch so one transient failure doesn't
  // black-hole the whole connection. Track whether any errored — if so,
  // skip sold detection entirely (see top-of-file comment).
  const live = new Map<string, LiveHolding>();
  let anyAccountErrored = false;
  for (const account of matchedAccounts) {
    try {
      const holdings = await snaptrade.accountInformation.getUserHoldings({
        userId,
        userSecret,
        accountId: account.id!,
      });
      for (const pos of holdings.data?.positions ?? []) {
        const ticker = pos.symbol?.symbol?.symbol;
        if (!ticker || typeof pos.units !== "number") continue;
        const norm = ticker.trim().toUpperCase();
        const existing = live.get(norm);
        // Aggregate intra-connection: same ticker held in multiple accounts
        // (e.g., taxable + IRA both hold AAPL) gets summed before upsert,
        // so the unique(broker_connection_id, ticker) constraint never trips.
        const shares = pos.units ?? 0;
        const price = pos.price ?? null;
        const market = price != null && shares != null ? shares * price : null;
        if (existing) {
          existing.shares = (existing.shares ?? 0) + shares;
          existing.market_value =
            (existing.market_value ?? 0) + (market ?? 0);
          existing.current_price = price ?? existing.current_price;
        } else {
          live.set(norm, {
            ticker: norm,
            name: pos.symbol?.symbol?.description || "",
            shares,
            current_price: price,
            market_value: market,
            asset_type: "stock",
          });
        }
      }
    } catch (err) {
      anyAccountErrored = true;
      console.warn(
        `snaptrade getUserHoldings failed for account ${account.id}:`,
        err
      );
    }
  }

  return await applySync(admin, fmId, connection, live, anyAccountErrored, result);
}

// --------------------------------------------------------------------------
// SaltEdge
// --------------------------------------------------------------------------

export async function syncSaltedgeConnection(
  admin: AdminClient,
  fmId: string,
  connection: BrokerConnectionRow
): Promise<SyncResult> {
  const result: SyncResult = {
    connection_id: connection.id,
    broker_name: connection.broker_name,
    provider: "saltedge",
    upserted: 0,
    sold: 0,
    errored: false,
  };

  const seConnId = connection.provider_auth_id;
  if (!seConnId) {
    return { ...result, errored: true, error: "saltedge connection_id missing" };
  }

  let live = new Map<string, LiveHolding>();
  let errored = false;
  try {
    const accounts = await saltedge.listAccounts(seConnId);
    const positions = extractPositions(accounts);
    // Aggregate intra-connection by ticker (same as SnapTrade path).
    for (const p of positions) {
      const norm = p.ticker.trim().toUpperCase();
      const existing = live.get(norm);
      if (existing) {
        existing.shares = (existing.shares ?? 0) + (p.shares ?? 0);
        existing.market_value =
          (existing.market_value ?? 0) + (p.market_value ?? 0);
        existing.current_price = p.current_price ?? existing.current_price;
      } else {
        live.set(norm, {
          ticker: norm,
          name: p.name,
          shares: p.shares,
          current_price: p.current_price,
          market_value: p.market_value,
          asset_type: p.asset_type,
        });
      }
    }
  } catch (err) {
    errored = true;
    live = new Map();
    console.warn(`saltedge listAccounts failed for ${seConnId}:`, err);
  }

  return await applySync(admin, fmId, connection, live, errored, result);
}

// --------------------------------------------------------------------------
// Apply: shared upsert + sold-detection pass
// --------------------------------------------------------------------------

async function applySync(
  admin: AdminClient,
  fmId: string,
  connection: BrokerConnectionRow,
  live: Map<string, LiveHolding>,
  fetchErrored: boolean,
  result: SyncResult
): Promise<SyncResult> {
  const now = new Date().toISOString();

  // Pull existing positions for this connection to drive both the
  // INSERT-vs-UPDATE branch and the sold-detection diff in one query.
  const { data: existing } = await admin
    .from("positions")
    .select("id, ticker, portfolio_id, shares")
    .eq("broker_connection_id", connection.id);

  const existingByTicker = new Map<
    string,
    {
      id: string;
      portfolio_id: string | null;
      shares: number | null;
      ticker: string;
    }
  >();
  for (const row of (existing ?? []) as {
    id: string;
    ticker: string;
    portfolio_id: string | null;
    shares: number | null;
  }[]) {
    existingByTicker.set(row.ticker.trim().toUpperCase(), {
      id: row.id,
      portfolio_id: row.portfolio_id,
      shares: row.shares,
      ticker: row.ticker,
    });
  }

  // Upsert pass.
  for (const [norm, h] of live) {
    const found = existingByTicker.get(norm);
    if (found) {
      await admin
        .from("positions")
        .update({
          shares: h.shares,
          current_price: h.current_price,
          market_value: h.market_value,
          name: h.name || undefined,
          last_synced: now,
        })
        .eq("id", found.id);
    } else {
      await admin.from("positions").insert({
        portfolio_id: null,
        broker_connection_id: connection.id,
        ticker: norm,
        name: h.name,
        shares: h.shares,
        current_price: h.current_price,
        market_value: h.market_value,
        asset_type: h.asset_type,
        last_synced: now,
      });
    }
    result.upserted += 1;
  }

  // Sold detection — only safe when the fetch was complete. Partial fetches
  // can't distinguish "ticker is gone" from "ticker we couldn't see".
  if (!fetchErrored) {
    for (const [norm, prev] of existingByTicker) {
      if (live.has(norm)) continue;
      // Position no longer at broker. Delete + (if assigned) fanout sell.
      if (prev.portfolio_id) {
        try {
          await fanOutPortfolioUpdate(admin, {
            portfolio_id: prev.portfolio_id,
            fund_manager_id: fmId,
            changes: [
              {
                type: "sell",
                ticker: prev.ticker,
                prevShares: Number(prev.shares) || 0,
              },
            ],
            description: `removed ${prev.ticker}`,
          });
        } catch (err) {
          console.warn(
            `sell fanout failed for ${prev.ticker} on ${connection.id}:`,
            err
          );
        }
      }
      await admin.from("positions").delete().eq("id", prev.id);
      result.sold += 1;
    }
  } else {
    result.errored = true;
    result.error = result.error ?? "partial fetch — sold detection skipped";
  }

  await admin
    .from("broker_connections")
    .update({ last_synced: now })
    .eq("id", connection.id);

  return result;
}

// --------------------------------------------------------------------------
// All-connections sync
// --------------------------------------------------------------------------

export async function syncAllConnections(
  admin: AdminClient,
  fmId: string
): Promise<SyncResult[]> {
  const { data: rows } = await admin
    .from("broker_connections")
    .select(
      "id, fund_manager_id, provider, provider_auth_id, broker_name, is_active"
    )
    .eq("fund_manager_id", fmId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  const results: SyncResult[] = [];
  for (const row of (rows ?? []) as BrokerConnectionRow[]) {
    if (row.provider === "snaptrade") {
      results.push(await syncSnaptradeConnection(admin, fmId, row));
    } else if (row.provider === "saltedge") {
      results.push(await syncSaltedgeConnection(admin, fmId, row));
    }
    // Manual connections have no upstream — skip.
  }

  // Refresh legacy single-broker fields based on active connections.
  const first = (rows ?? [])[0] as BrokerConnectionRow | undefined;
  await admin
    .from("fund_managers")
    .update({
      broker_connected: !!first,
      broker_name: first?.broker_name ?? null,
      broker_provider: first?.provider ?? null,
    })
    .eq("id", fmId);

  return results;
}
