import { jsonError, requiredSecret, supabaseConfig, supabaseFetch } from "../_supabase";

type StripeObject = { id?: string; amount_total?: number; currency?: string; client_reference_id?: string; metadata?: Record<string, string> };
type StripeEvent = { id?: string; type?: string; data?: { object?: StripeObject } };

function equal(a: string, b: string) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function validSignature(raw: string, header: string | null, secret: string) {
  if (!header) return false;
  const parts = header.split(",").reduce<Record<string, string[]>>((all, part) => {
    const [key, value] = part.split("=", 2);
    if (key && value) (all[key] ||= []).push(value);
    return all;
  }, {});
  const timestamp = Number(parts.t?.[0]);
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
  const cryptoKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = hex(await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(`${timestamp}.${raw}`)));
  return (parts.v1 || []).some(signature => equal(digest, signature));
}

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    const webhookSecret = requiredSecret("STRIPE_WEBHOOK_SECRET");
    if (!await validSignature(raw, request.headers.get("stripe-signature"), webhookSecret)) return Response.json({ error: "Firma Stripe non valida." }, { status: 400 });
    const event = JSON.parse(raw) as StripeEvent;
    const object = event.data?.object || {};
    const orderId = object.metadata?.order_id || object.client_reference_id;
    if (!event.id || !orderId || !object.id) return Response.json({ received: true });
    const paid = event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded";
    const expired = event.type === "checkout.session.expired";
    if (!paid && !expired) return Response.json({ received: true });
    const amount = Number(object.amount_total);
    if (!Number.isSafeInteger(amount) || !object.currency) return Response.json({ error: "Dati pagamento incompleti." }, { status: 400 });
    const config = supabaseConfig();
    await supabaseFetch(config, "/rest/v1/rpc/stripe_event", { method: "POST", body: JSON.stringify({ p_event_id: event.id, p_order_id: orderId, p_session_id: object.id, p_paid: paid, p_expired: expired, p_amount: amount, p_currency: object.currency }) }, requiredSecret("SUPABASE_SECRET_KEY"));
    return Response.json({ received: true });
  } catch (error) {
    return jsonError(error);
  }
}
