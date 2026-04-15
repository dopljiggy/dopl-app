import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

const REGIONS = [
  "us_canada",
  "uk",
  "europe",
  "uae",
  "australia",
  "india",
  "other",
] as const;

const PROVIDER_BY_REGION: Record<string, "snaptrade" | "saltedge" | "manual"> = {
  us_canada: "snaptrade",
  australia: "snaptrade",
  india: "snaptrade",
  uk: "saltedge",
  europe: "saltedge",
  uae: "saltedge",
  other: "manual",
};

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { region } = (await request.json()) as { region?: string };
  if (!region || !REGIONS.includes(region as (typeof REGIONS)[number])) {
    return NextResponse.json({ error: "invalid region" }, { status: 400 });
  }

  const provider = PROVIDER_BY_REGION[region];
  const admin = createAdminClient();
  const { error } = await admin
    .from("fund_managers")
    .update({ region, broker_provider: provider })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, region, provider });
}

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: fm } = await supabase
    .from("fund_managers")
    .select("region, broker_provider")
    .eq("id", user.id)
    .maybeSingle();

  return NextResponse.json({
    region: fm?.region ?? null,
    provider: fm?.broker_provider ?? null,
  });
}
