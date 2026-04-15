/**
 * Salt Edge API v6 client.
 * Docs: https://docs.saltedge.com/v6/
 *
 * Auth: App-id / Secret headers on every request.
 * Base URL: https://www.saltedge.com/api/v6
 */

const BASE_URL = "https://www.saltedge.com/api/v6";

function headers() {
  const appId = process.env.SALTEDGE_APP_ID;
  const secret = process.env.SALTEDGE_SECRET;
  if (!appId || !secret) {
    throw new Error("Salt Edge credentials missing (SALTEDGE_APP_ID / SALTEDGE_SECRET)");
  }
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "App-id": appId,
    Secret: secret,
  };
}

async function request<T = unknown>(
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
    // ignore
  }
  if (!res.ok) {
    const msg =
      (json as { error?: { message?: string } } | null)?.error?.message ||
      `Salt Edge ${res.status}`;
    const err = new Error(msg) as Error & {
      status?: number;
      body?: unknown;
    };
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json as T;
}

export function errorBody(err: unknown): unknown {
  if (err && typeof err === "object" && "body" in err) {
    return (err as { body?: unknown }).body;
  }
  return null;
}

export type SaltEdgeCustomer = { id: string; identifier: string };
export type SaltEdgeConnectSession = { expires_at: string; connect_url: string };
export type SaltEdgeConnection = {
  id: string;
  customer_id: string;
  provider_code?: string;
  provider_name?: string;
  status?: string;
  categorization?: string;
  last_success_at?: string;
  created_at?: string;
};
export type SaltEdgeAccount = {
  id: string;
  connection_id: string;
  name?: string;
  nature?: string; // "account", "card", "investment", "loan", etc.
  balance?: number;
  currency_code?: string;
  extra?: Record<string, unknown> & {
    holdings?: Array<{
      ticker?: string;
      symbol?: string;
      name?: string;
      quantity?: number;
      units?: number;
      value?: number;
      market_value?: number;
      price?: number;
    }>;
  };
};
export type SaltEdgeTransaction = {
  id: string;
  account_id: string;
  amount: number;
  currency_code: string;
  description?: string;
  category?: string;
  made_on?: string;
  extra?: Record<string, unknown>;
};

export const saltedge = {
  async createCustomer(identifier: string): Promise<SaltEdgeCustomer> {
    const res = await request<{ data: SaltEdgeCustomer }>("/customers", {
      method: "POST",
      body: { data: { identifier } },
    });
    return res.data;
  },

  async findCustomerByIdentifier(
    identifier: string
  ): Promise<SaltEdgeCustomer | null> {
    // v6 `GET /customers` doesn't support an `identifier` filter — it returns
    // a paginated list. Walk up to 10 pages looking for a match (the
    // Salt Edge test sandbox caps at ~1000 customers per app).
    let nextId: string | null = null;
    for (let page = 0; page < 10; page++) {
      const query: Record<string, string> = {};
      if (nextId) query.from_id = nextId;
      const res = await request<{
        data: SaltEdgeCustomer[];
        meta?: { next_id?: string | null; next_page?: string | null };
      }>("/customers", { query });
      const match = res.data?.find((c) => c.identifier === identifier);
      if (match) return match;
      nextId = res.meta?.next_id ?? null;
      if (!nextId) break;
    }
    return null;
  },

  async createConnectSession(opts: {
    customer_id: string;
    return_to: string;
    locale?: string;
    from_date?: string; // YYYY-MM-DD
    scopes?: string[];
  }): Promise<SaltEdgeConnectSession> {
    const res = await request<{ data: SaltEdgeConnectSession }>(
      "/connect_sessions/create",
      {
        method: "POST",
        body: {
          data: {
            customer_id: opts.customer_id,
            consent: {
              scopes: opts.scopes ?? [
                "account_details",
                "transactions_details",
              ],
              from_date: opts.from_date ?? "2020-01-01",
            },
            attempt: {
              return_to: opts.return_to,
              locale: opts.locale ?? "en",
            },
          },
        },
      }
    );
    return res.data;
  },

  async deleteConnection(connectionId: string): Promise<void> {
    await request(`/connections/${connectionId}`, { method: "DELETE" });
  },

  async deleteCustomer(customerId: string): Promise<void> {
    await request(`/customers/${customerId}`, { method: "DELETE" });
  },

  async listConnections(customerId: string): Promise<SaltEdgeConnection[]> {
    const res = await request<{ data: SaltEdgeConnection[] }>("/connections", {
      query: { customer_id: customerId },
    });
    return res.data ?? [];
  },

  async listAccounts(connectionId: string): Promise<SaltEdgeAccount[]> {
    const res = await request<{ data: SaltEdgeAccount[] }>("/accounts", {
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
    const res = await request<{ data: SaltEdgeTransaction[] }>("/transactions", {
      query,
    });
    return res.data ?? [];
  },
};
