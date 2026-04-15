import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

const SALTEDGE_BASE = "https://www.saltedge.com/api/v6";

function seHeaders() {
  const appId = process.env.SALTEDGE_APP_ID;
  const secret = process.env.SALTEDGE_SECRET;
  if (!appId || !secret) {
    throw new Error("SALTEDGE_APP_ID / SALTEDGE_SECRET missing");
  }
  return {
    "App-id": appId,
    Secret: secret,
    "Content-type": "application/json",
    Accept: "application/json",
  };
}

type Customer = {
  id?: string;
  customer_id?: string;
  identifier?: string;
};

export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. Short-circuit if we've already stored a Salt Edge customer id.
  const { data: fm } = await supabase
    .from("fund_managers")
    .select("saltedge_customer_id")
    .eq("id", user.id)
    .maybeSingle();
  if (fm?.saltedge_customer_id) {
    return NextResponse.json({ customer_id: fm.saltedge_customer_id });
  }

  const identifier = `dopl-${user.id}`;
  const admin = createAdminClient();

  const saveCustomer = async (customerId: string) => {
    await admin
      .from("fund_managers")
      .update({
        saltedge_customer_id: customerId,
        broker_provider: "saltedge",
      })
      .eq("id", user.id);
  };

  // 2. Try to create.
  const createRes = await fetch(`${SALTEDGE_BASE}/customers`, {
    method: "POST",
    headers: seHeaders(),
    body: JSON.stringify({ data: { identifier } }),
    cache: "no-store",
  });

  const createText = await createRes.text();
  let createJson: {
    data?: Customer;
    error?: { message?: string; class?: string };
  } | null = null;
  try {
    createJson = createText ? JSON.parse(createText) : null;
  } catch {
    // ignore
  }

  if (createRes.ok) {
    const id = createJson?.data?.id ?? createJson?.data?.customer_id ?? null;
    if (!id) {
      return NextResponse.json(
        { error: "salt edge returned no customer id", raw: createJson },
        { status: 500 }
      );
    }
    await saveCustomer(id);
    return NextResponse.json({ customer_id: id });
  }

  const errMsg = createJson?.error?.message ?? `Salt Edge ${createRes.status}`;
  const isDuplicate =
    /already exists|duplicated|duplicate/i.test(errMsg) ||
    /DuplicatedCustomer/i.test(createJson?.error?.class ?? "");

  if (!isDuplicate) {
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }

  // 3. Duplicate — list customers and find by identifier.
  const listRes = await fetch(`${SALTEDGE_BASE}/customers`, {
    method: "GET",
    headers: seHeaders(),
    cache: "no-store",
  });
  const listText = await listRes.text();
  let listJson: {
    data?: Customer[];
    meta?: { next_id?: string | null };
    error?: { message?: string };
  } | null = null;
  try {
    listJson = listText ? JSON.parse(listText) : null;
  } catch {
    // ignore
  }

  if (!listRes.ok) {
    return NextResponse.json(
      {
        error:
          "customer exists but GET /customers failed: " +
          (listJson?.error?.message ?? listRes.status),
        identifier,
      },
      { status: 500 }
    );
  }

  // Walk pages until we find it (cap at 20 pages just in case).
  let data: Customer[] = listJson?.data ?? [];
  let nextId = listJson?.meta?.next_id ?? null;
  let match = data.find((c) => c.identifier === identifier);
  let pages = 1;
  while (!match && nextId && pages < 20) {
    const pageRes = await fetch(
      `${SALTEDGE_BASE}/customers?from_id=${encodeURIComponent(nextId)}`,
      { method: "GET", headers: seHeaders(), cache: "no-store" }
    );
    const pageJson = (await pageRes.json().catch(() => null)) as {
      data?: Customer[];
      meta?: { next_id?: string | null };
    } | null;
    data = pageJson?.data ?? [];
    match = data.find((c) => c.identifier === identifier);
    nextId = pageJson?.meta?.next_id ?? null;
    pages++;
  }

  if (!match) {
    return NextResponse.json(
      {
        error:
          "salt edge says this customer already exists but it was not found in GET /customers",
        identifier,
      },
      { status: 500 }
    );
  }

  const foundId = match.id ?? match.customer_id ?? null;
  if (!foundId) {
    return NextResponse.json(
      { error: "matched customer has no id field", raw: match },
      { status: 500 }
    );
  }

  await saveCustomer(foundId);
  return NextResponse.json({ customer_id: foundId, recovered: true });
}
