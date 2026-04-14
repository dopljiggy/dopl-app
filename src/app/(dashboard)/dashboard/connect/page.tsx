import { createServerSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import ConnectClient from "./connect-client";

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

  const { data: fm } = await supabase
    .from("fund_managers")
    .select("broker_connected, broker_name, snaptrade_user_id")
    .eq("id", user.id)
    .maybeSingle();

  const params = await searchParams;
  const justConnected = params.connected === "true";
  const syncedPositionCount = params.positions
    ? parseInt(params.positions, 10)
    : 0;

  // Real count from DB (positions already assigned to portfolios).
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

  return (
    <ConnectClient
      alreadyConnected={!!fm?.broker_connected}
      brokerName={fm?.broker_name ?? null}
      hasSnaptradeUser={!!fm?.snaptrade_user_id}
      positionCount={Math.max(syncedPositionCount, dbPositionCount)}
      justConnected={justConnected}
      errorMessage={params.error ?? null}
    />
  );
}
