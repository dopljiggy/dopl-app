import { createServerSupabase } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import ConnectClient from "./connect-client";

export default async function ConnectBrokerPage() {
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

  let positionCount = 0;
  if (fm?.broker_connected) {
    const { count } = await supabase
      .from("positions")
      .select("id", { count: "exact", head: true })
      .in(
        "portfolio_id",
        (
          await supabase
            .from("portfolios")
            .select("id")
            .eq("fund_manager_id", user.id)
        ).data?.map((p) => p.id) ?? ["00000000-0000-0000-0000-000000000000"]
      );
    positionCount = count ?? 0;
  }

  return (
    <ConnectClient
      alreadyConnected={!!fm?.broker_connected}
      brokerName={fm?.broker_name ?? null}
      hasSnaptradeUser={!!fm?.snaptrade_user_id}
      positionCount={positionCount}
    />
  );
}
