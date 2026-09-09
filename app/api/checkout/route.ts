import { jsonError, requiredSecret, currentUser, supabaseFetch } from "../_supabase";

type Order = { id: string; total_amount: number | string; customer_email: string; status: string; payment_status: string; payment_provider: string; payment_reference: string | null };
type OrderItem = { product_name: string; quantity: number; unit_price: number | string };

function validId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function stripeFetch<T>(path: string, secret: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${secret}`);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/x-www-form-urlencoded");
  const response = await fetch(`https://api.stripe.com${path}`, { ...options, headers });
  const text = await response.text();
  let data: { url?: string; id?: string; error?: { message?: string } } = {};
  try { data = text ? JSON.parse(text) as { url?: string; id?: string; error?: { message?: string } } : {}; } catch { data = {}; }
  if (!response.ok) throw new Error(data?.error?.message || "Stripe non ha accettato il pagamento.");
  return data as T;
}

export async function POST(request: Request) {
  try {
    const context = await currentUser(request);
    const stripeSecret = requiredSecret("STRIPE_SECRET_KEY");
    const supabaseSecret = requiredSecret("SUPABASE_SECRET_KEY");
    const body = await request.json() as { orderId?: string };
    if (!validId(body.orderId)) return Response.json({ error: "Ordine non valido." }, { status: 400 });
    const orderRows = await supabaseFetch<Order[]>(context.config, `/rest/v1/orders?select=id,total_amount,customer_email,status,payment_status,payment_provider,payment_reference&id=eq.${encodeURIComponent(body.orderId)}&user_id=eq.${encodeURIComponent(context.user.id)}`, { headers: { Authorization: `Bearer ${context.token}` } }, context.config.publishableKey);
    const order = orderRows[0];
    if (!order || order.payment_provider !== "stripe" || order.status === "cancelled" || order.payment_status === "paid") throw new Error("Questo ordine non è disponibile per il pagamento.");

    if (order.payment_reference) {
      const existing = await stripeFetch<{ url?: string }>(`/v1/checkout/sessions/${encodeURIComponent(order.payment_reference)}`, stripeSecret);
      if (existing.url) return Response.json({ url: existing.url });
    }

    const items = await supabaseFetch<OrderItem[]>(context.config, `/rest/v1/order_items?select=product_name,quantity,unit_price&order_id=eq.${encodeURIComponent(order.id)}&order=product_name`, { headers: { Authorization: `Bearer ${context.token}` } }, context.config.publishableKey);
    const amount = Math.round(Number(order.total_amount) * 100);
    if (!Number.isSafeInteger(amount) || amount < 1 || !items.length) throw new Error("Il totale dell’ordine non è valido.");

    const form = new URLSearchParams();
    form.set("mode", "payment");
    form.set("success_url", `${new URL(request.url).origin}/?payment=success&session_id={CHECKOUT_SESSION_ID}`);
    form.set("cancel_url", `${new URL(request.url).origin}/?payment=cancelled&order_id=${order.id}`);
    form.set("customer_email", order.customer_email);
    form.set("client_reference_id", order.id);
    form.set("metadata[order_id]", order.id);
    form.set("metadata[user_id]", context.user.id);
    form.set("line_items[0][price_data][currency]", "eur");
    form.set("line_items[0][price_data][product_data][name]", `Ordine Jolly ${order.id.slice(0, 8).toUpperCase()}`);
    form.set("line_items[0][price_data][product_data][description]", `${items.reduce((n, item) => n + Number(item.quantity), 0)} articoli · dettaglio disponibile nel tuo account`);
    form.set("line_items[0][price_data][unit_amount]", String(amount));
    form.set("line_items[0][quantity]", "1");
    const session = await stripeFetch<{ id: string; url?: string }>("/v1/checkout/sessions", stripeSecret, { method: "POST", body: form });
    if (!session.id || !session.url) throw new Error("Stripe non ha restituito il link di pagamento.");
    await supabaseFetch(context.config, "/rest/v1/rpc/attach_stripe_session", { method: "POST", body: JSON.stringify({ p_order_id: order.id, p_session_id: session.id }) }, supabaseSecret);
    return Response.json({ url: session.url });
  } catch (error) {
    return jsonError(error);
  }
}
