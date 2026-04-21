/**
 * Salt Edge Account Information v6 client.
 * Docs: https://docs.saltedge.com/v6/
 *
 * Verified against live API on 2026-04-15:
 *  - Headers: App-id, Secret, Content-type, Accept
 *  - Customer id field is `customer_id` (not `id`)
 *  - Create connect URL: POST /connections/connect (not /connect_sessions/create)
 *  - Scopes: one of ["accounts", "holder_info", "transactions"]
 *  - consent.from_date must fall inside Salt Edge's rolling 2-year window,
 *    computed as today − 90 days via `getMinFromDate()`
 */

const BASE_URL = "https://www.saltedge.com/api/v6";

// Salt Edge's consent.from_date must fall inside their rolling 2-year
// acceptance window. Computing today - 90 days keeps us comfortably
// inside the window while giving us ~3 months of historical data,
// which is all we need for portfolio-change detection.
export function getMinFromDate(): string {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  return ninetyDaysAgo.toISOString().slice(0, 10);
}

function headers() {
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

export type SaltEdgeError = Error & {
  status?: number;
  errorClass?: string;
  body?: unknown;
};

export async function se<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown; query?: Record<string, string> } = {}
): Promise<T> {
  const url = new URL(BASE_URL + path);
  if (init.query) {
    for (const [k, v] of Object.entries(init.query)) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    method: init.method ?? "GET",
    headers: headers(),
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // non-JSON response body — leave as null
  }
  if (!res.ok) {
    const errObj = (json as { error?: { message?: string; class?: string } } | null)
      ?.error;
    const err: SaltEdgeError = new Error(
      errObj?.message || `Salt Edge ${res.status}`
    );
    err.status = res.status;
    err.errorClass = errObj?.class;
    err.body = json;
    throw err;
  }
  return json as T;
}

/* ---------- types ---------- */

export type SaltEdgeCustomer = {
  customer_id: string;
  identifier: string;
  created_at?: string;
  updated_at?: string;
  blocked_at?: string | null;
};

export type SaltEdgeConnectResponse = {
  expires_at: string;
  connect_url: string;
  customer_id: string;
};

export type SaltEdgeConnection = {
  connection_id?: string;
  id?: string; // some endpoints include `id` too
  customer_id: string;
  provider_code?: string;
  provider_name?: string;
  status?: string;
  last_success_at?: string;
  created_at?: string;
  updated_at?: string;
};

export type SaltEdgeAccount = {
  account_id?: string;
  id?: string;
  connection_id: string;
  name?: string;
  nature?: string; // "account" | "card" | "investment" | "loan" | "savings"
  balance?: number;
  currency_code?: string;
  extra?: Record<string, unknown> & {
    holdings?: Array<{
      ticker?: string;
      symbol?: string;
      name?: string;
      quantity?: number;
      units?: number;
      price?: number;
      value?: number;
      market_value?: number;
    }>;
  };
};

export type SaltEdgeTransaction = {
  transaction_id?: string;
  id?: string;
  account_id: string;
  amount: number;
  currency_code: string;
  description?: string;
  made_on?: string;
  extra?: Record<string, unknown>;
};

/* ---------- endpoints ---------- */

export const saltedge = {
  async listCustomers(fromId?: string | null): Promise<{
    data: SaltEdgeCustomer[];
    nextId: string | null;
  }> {
    const query: Record<string, string> = {};
    if (fromId) query.from_id = fromId;
    const res = await se<{
      data: SaltEdgeCustomer[];
      meta?: { next_id?: string | null };
    }>("/customers", { query });
    return { data: res.data ?? [], nextId: res.meta?.next_id ?? null };
  },

  async findCustomerByIdentifier(
    identifier: string
  ): Promise<SaltEdgeCustomer | null> {
    let nextId: string | null = null;
    for (let page = 0; page < 20; page++) {
      const { data, nextId: n } = await saltedge.listCustomers(nextId);
      const match = data.find((c) => c.identifier === identifier);
      if (match) return match;
      if (!n) return null;
      nextId = n;
    }
    return null;
  },

  async createCustomer(identifier: string): Promise<SaltEdgeCustomer> {
    const res = await se<{ data: SaltEdgeCustomer }>("/customers", {
      method: "POST",
      body: { data: { identifier } },
    });
    return res.data;
  },

  async createConnectUrl(opts: {
    customer_id: string;
    return_to: string;
    scopes?: string[];
    from_date?: string;
    locale?: string;
    country_code?: string;
  }): Promise<SaltEdgeConnectResponse> {
    // Explicitly construct the payload so no `provider_code` /
    // `provider_codes` / `provider_id` can ever leak in and trigger the
    // "Provider with id … was not found" error. Widget restriction is by
    // `country_code` only (optional).
    const body: Record<string, unknown> = {
      customer_id: opts.customer_id,
      consent: {
        scopes: opts.scopes ?? ["accounts", "transactions"],
        from_date: opts.from_date ?? getMinFromDate(),
      },
      attempt: {
        return_to: opts.return_to,
        locale: opts.locale ?? "en",
      },
    };
    if (opts.country_code) {
      body.country_code = opts.country_code;
    }
    const res = await se<{ data: SaltEdgeConnectResponse }>(
      "/connections/connect",
      {
        method: "POST",
        body: { data: body },
      }
    );
    return res.data;
  },

  async listConnections(customerId: string): Promise<SaltEdgeConnection[]> {
    const res = await se<{ data: SaltEdgeConnection[] }>("/connections", {
      query: { customer_id: customerId },
    });
    return res.data ?? [];
  },

  async deleteConnection(connectionId: string): Promise<void> {
    await se(`/connections/${connectionId}`, { method: "DELETE" });
  },

  async listAccounts(connectionId: string): Promise<SaltEdgeAccount[]> {
    const res = await se<{ data: SaltEdgeAccount[] }>("/accounts", {
      query: { connection_id: connectionId },
    });
    return res.data ?? [];
  },

  async listTransactions(
    connectionId: string,
    accountId?: string
  ): Promise<SaltEdgeTransaction[]> {
    const query: Record<string, string> = { connection_id: connectionId };
    if (accountId) query.account_id = accountId;
    const res = await se<{ data: SaltEdgeTransaction[] }>("/transactions", {
      query,
    });
    return res.data ?? [];
  },
};

export function connectionId(c: SaltEdgeConnection): string | null {
  return c.connection_id ?? c.id ?? null;
}
