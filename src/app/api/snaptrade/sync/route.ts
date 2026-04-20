import { NextResponse } from "next/server";
import { snaptrade } from "@/lib/snaptrade";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { computeChanges, type NextPosition } from "@/lib/position-diff";

export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: fm } = await supabase
    .from("fund_managers")
    .select("snaptrade_user_id, snaptrade_user_secret")
    .eq("id", user.id)
    .single();
  if (!fm?.snaptrade_user_id) {
    return NextResponse.json({ error: "Not connected" }, { status: 400 });
  }

  try {
    const accounts = await snaptrade.accountInformation.listUserAccounts({
      userId: fm.snaptrade_user_id,
      userSecret: fm.snaptrade_user_secret!,
    });

    // Flatten live holdings across all accounts. Keep raw records for the
    // "unassigned" pool the client displays.
    interface RawSyncedPosition {
      ticker: string;
      name: string;
      shares: number | null;
      market_value: number | null;
      current_price: number | null;
      asset_type: string;
      last_synced: string;
    }
    const raw: RawSyncedPosition[] = [];
    const live: NextPosition[] = [];
    for (const account of accounts.data) {
      const holdings = await snaptrade.accountInformation.getUserHoldings({
        userId: fm.snaptrade_user_id,
        userSecret: fm.snaptrade_user_secret!,
        accountId: account.id!,
      });
      if (!holdings.data.positions) continue;
      for (const pos of holdings.data.positions) {
        const ticker = pos.symbol?.symbol?.symbol;
        if (!ticker || typeof pos.units !== "number") continue;
        raw.push({
          ticker,
          name: pos.symbol?.symbol?.description || "",
          shares: pos.units,
          market_value:
            pos.price && pos.units ? pos.units * pos.price : null,
          current_price: pos.price ?? null,
          asset_type: "stock",
          last_synced: new Date().toISOString(),
        });
        live.push({ ticker, shares: pos.units });
      }
    }

    const admin = createAdminClient();

    // Per-portfolio diff on ALREADY-ASSIGNED tickers.
    const { data: portfolios } = await admin
      .from("portfolios")
      .select("id, name")
      .eq("fund_manager_id", user.id);

    const perPortfolio: Array<{
      portfolio_id: string;
      portfolio_name: string;
      changes: ReturnType<typeof computeChanges>;
    }> = [];

    for (const portfolio of portfolios ?? []) {
      const { data: prevRows } = await admin
        .from("positions")
        .select("id, ticker, shares")
        .eq("portfolio_id", portfolio.id);

      const prev = (prevRows ?? []).map((r) => ({
        id: r.id as string,
        ticker: r.ticker as string,
        shares: Number(r.shares) || 0,
      }));

      const changes = computeChanges(prev, live);

      // Apply changes with targeted ops. allocation_pct is never touched.
      for (const change of changes) {
        if (change.type === "sell") {
          await admin.from("positions").delete().eq("id", change.positionId);
        } else if (change.type === "rebalance") {
          await admin
            .from("positions")
            .update({
              shares: change.shares,
              last_synced: new Date().toISOString(),
            })
            .eq("id", change.positionId);
        }
      }

      perPortfolio.push({
        portfolio_id: portfolio.id,
        portfolio_name: portfolio.name,
        changes,
      });
    }

    await supabase
      .from("fund_managers")
      .update({
        broker_connected: true,
        broker_name: accounts.data[0]?.institution_name || "Unknown",
      })
      .eq("id", user.id);

    // `positions` is the raw broker pool for the "unassigned" column; older
    // clients read it by that key. `perPortfolio` carries the structured
    // change data for the new "notify doplers?" modal.
    return NextResponse.json({ positions: raw, perPortfolio });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "sync failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
