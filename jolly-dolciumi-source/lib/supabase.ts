export type SupabaseConfig = {
  url: string;
  anonKey: string;
};

export type SupabaseSession = {
  access_token: string;
  refresh_token?: string;
  user: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  };
};

export type SupabaseProfile = {
  id: string;
  full_name: string | null;
  role: "customer" | "staff";
};

declare global {
  interface Window {
    __JOLLY_CONFIG__?: {
      supabaseUrl?: string;
      supabaseAnonKey?: string;
    };
  }
}

export function getSupabaseConfig(): SupabaseConfig | null {
  if (typeof window === "undefined") return null;

  const runtime = window.__JOLLY_CONFIG__;
  const url = runtime?.supabaseUrl?.trim().replace(/\/$/, "") ?? "";
  const anonKey = runtime?.supabaseAnonKey?.trim() ?? "";

  if (!url || !anonKey || url.includes("YOUR_") || anonKey.includes("YOUR_")) {
    return null;
  }

  return { url, anonKey };
}

async function request<T>(
  config: SupabaseConfig,
  path: string,
  options: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("apikey", config.anonKey);
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${accessToken || config.anonKey}`);

  const response = await fetch(`${config.url}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Supabase request failed (${response.status})`);
  }

  if (response.status === 204) return {} as T;
  return (await response.json()) as T;
}

export async function signInWithPassword(
  config: SupabaseConfig,
  email: string,
  password: string,
): Promise<SupabaseSession> {
  return request<SupabaseSession>(
    config,
    "/auth/v1/token?grant_type=password",
    { method: "POST", body: JSON.stringify({ email, password }) },
  );
}

export async function signUpWithPassword(
  config: SupabaseConfig,
  email: string,
  password: string,
  fullName: string,
): Promise<SupabaseSession> {
  return request<SupabaseSession>(config, "/auth/v1/signup", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      data: { full_name: fullName },
    }),
  });
}

export async function getCurrentUser(
  config: SupabaseConfig,
  session: SupabaseSession,
): Promise<SupabaseSession["user"]> {
  return request<SupabaseSession["user"]>(
    config,
    "/auth/v1/user",
    {},
    session.access_token,
  );
}

export async function getProfile(
  config: SupabaseConfig,
  session: SupabaseSession,
): Promise<SupabaseProfile | null> {
  const rows = await request<SupabaseProfile[]>(
    config,
    `/rest/v1/profiles?select=id,full_name,role&id=eq.${encodeURIComponent(session.user.id)}&limit=1`,
    {},
    session.access_token,
  );
  return rows[0] ?? null;
}

export async function getProducts<T>(
  config: SupabaseConfig,
  session?: SupabaseSession | null,
): Promise<T[]> {
  return request<T[]>(
    config,
    "/rest/v1/products?select=*&is_active=eq.true&order=featured.desc,created_at.desc",
    {},
    session?.access_token,
  );
}

export async function getAdminProducts<T>(
  config: SupabaseConfig,
  session: SupabaseSession,
): Promise<T[]> {
  return request<T[]>(
    config,
    "/rest/v1/products?select=*&order=created_at.desc",
    {},
    session.access_token,
  );
}

export async function getOrders<T>(
  config: SupabaseConfig,
  session: SupabaseSession,
): Promise<T[]> {
  return request<T[]>(
    config,
    `/rest/v1/orders?select=*,order_items(*)&user_id=eq.${encodeURIComponent(session.user.id)}&order=created_at.desc`,
    {},
    session.access_token,
  );
}

export async function getAdminOrders<T>(
  config: SupabaseConfig,
  session: SupabaseSession,
): Promise<T[]> {
  return request<T[]>(
    config,
    "/rest/v1/orders?select=*,order_items(*)&order=created_at.desc",
    {},
    session.access_token,
  );
}

export async function createOrder(
  config: SupabaseConfig,
  session: SupabaseSession,
  order: {
    customerEmail: string;
    totalAmount: number;
    note?: string;
    items: Array<{
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: number;
    }>;
  },
): Promise<{ id: string; totalAmount: number }> {
  const created = await request<{ id: string; total_amount: number }>(
    config,
    "/rest/v1/rpc/place_order",
    {
      method: "POST",
      body: JSON.stringify({
        p_items: order.items.map((item) => ({
          product_id: item.productId,
          quantity: item.quantity,
        })),
        p_customer_email: order.customerEmail,
        p_note: order.note || null,
      }),
    },
    session.access_token,
  );

  const orderId = created.id;
  if (!orderId) throw new Error("Order creation returned no id");

  return { id: orderId, totalAmount: Number(created.total_amount ?? order.totalAmount) };
}

export async function createProduct(
  config: SupabaseConfig,
  session: SupabaseSession,
  product: Record<string, unknown>,
): Promise<void> {
  await request(config, "/rest/v1/products", {
    method: "POST",
    body: JSON.stringify(product),
  }, session.access_token);
}

export async function updateProduct(
  config: SupabaseConfig,
  session: SupabaseSession,
  productId: string,
  product: Record<string, unknown>,
): Promise<void> {
  await request(config, `/rest/v1/products?id=eq.${encodeURIComponent(productId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(product),
  }, session.access_token);
}

export async function updateOrderStatus(
  config: SupabaseConfig,
  session: SupabaseSession,
  orderId: string,
  status: string,
): Promise<void> {
  await request(config, `/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status }),
  }, session.access_token);
}

export async function uploadProductImage(
  config: SupabaseConfig,
  session: SupabaseSession,
  file: File,
): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${crypto.randomUUID()}.${extension}`;
  const headers = new Headers({
    apikey: config.anonKey,
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": file.type || "application/octet-stream",
    "x-upsert": "false",
  });
  const response = await fetch(`${config.url}/storage/v1/object/products/${path}`, {
    method: "POST",
    headers,
    body: file,
  });
  if (!response.ok) throw new Error(await response.text());
  return `${config.url}/storage/v1/object/public/products/${path}`;
}
