import { createServerSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import ConnectClient from "./connect-client";

type FMRow = {
  broker_connected?: boolean | null;
  broker_name?: string | null;
  snaptrade_user_id?: string | null;
  saltedge_customer_id?: string | null;
  region?: string | null;
  broker_provider?: "snaptrade" | "saltedge" | "manual" | null;
};

export default async function ConnectBrokerPage({
  searchParams,
}: {
  searchParams: Promise<{
    connected?: string;
    positions?: string;
    error?: string;
  }>;
}) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let fm: FMRow | null = null;
  const first = await supabase
    .from("fund_managers")
    .select(
      "broker_connected, broker_name, snaptrade_user_id, saltedge_customer_id, region, broker_provider"
    )
    .eq("id", user.id)
    .maybeSingle();
  if (first.error) {
    const fallback = await supabase
      .from("fund_managers")
      .select("broker_connected, broker_name, snaptrade_user_id")
      .eq("id", user.id)
      .maybeSingle();
    fm = (fallback.data as FMRow) ?? null;
  } else {
    fm = (first.data as FMRow) ?? null;
  }

  const params = await searchParams;
  const justConnected = params.connected === "true";
  const syncedPositionCount = params.positions
    ? parseInt(params.positions, 10)
    : 0;

  let dbPositionCount = 0;
  if (fm?.broker_connected) {
    const portfolios = (
      await supabase
        .from("portfolios")
        .select("id")
        .eq("fund_manager_id", user.id)
    ).data;
    const ids = portfolios?.map((p) => p.id) ?? [];
    if (ids.length) {
      const { count } = await supabase
        .from("positions")
        .select("id", { count: "exact", head: true })
        .in("portfolio_id", ids);
      dbPositionCount = count ?? 0;
    }
  }

  const provider =
    fm?.broker_provider ?? (fm?.snaptrade_user_id ? "snaptrade" : null);

  const { data: fmCount } = await supabase
    .from("fund_managers")
    .select("subscriber_count")
    .eq("id", user.id)
    .maybeSingle();
  const subscriberCount = fmCount?.subscriber_count ?? 0;

  return (
    <ConnectClient
      alreadyConnected={!!fm?.broker_connected}
      brokerName={fm?.broker_name ?? null}
      hasSnaptradeUser={!!fm?.snaptrade_user_id}
      hasSaltedgeCustomer={!!fm?.saltedge_customer_id}
      region={fm?.region ?? null}
      provider={provider}
      positionCount={Math.max(syncedPositionCount, dbPositionCount)}
      subscriberCount={subscriberCount}
      justConnected={justConnected}
      errorMessage={params.error ?? null}
    />
  );
}
