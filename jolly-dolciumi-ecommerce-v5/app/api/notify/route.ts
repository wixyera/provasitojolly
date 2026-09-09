import { env } from "cloudflare:workers";
import { currentUser, jsonError, supabaseFetch } from "../_supabase";

type Order = { id: string; user_id: string; customer_email: string; status: string; total_amount: number | string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[char] || char)); }
function setting(name: string) { const value = (env as unknown as Record<string, unknown>)[name]; return typeof value === "string" ? value : ""; }
function statusLabel(status: string) { return ({ pending: "Da confermare", confirmed: "Confermato", preparing: "In preparazione", shipped: "Spedito", completed: "Consegnato", cancelled: "Annullato" } as Record<string, string>)[status] || status; }

export async function POST(request: Request) {
  try {
    const context = await currentUser(request);
    const body = await request.json() as { orderId?: string; kind?: "order_created" | "status_updated" };
    if (!body.orderId || !UUID.test(body.orderId)) return Response.json({ error: "Ordine non valido." }, { status: 400 });
    const rows = await supabaseFetch<Order[]>(context.config, `/rest/v1/orders?select=id,user_id,customer_email,status,total_amount&id=eq.${encodeURIComponent(body.orderId)}`, { headers: { Authorization: `Bearer ${context.token}` } }, context.config.publishableKey);
    const order = rows[0];
    if (!order || (context.profile.role !== "staff" && order.user_id !== context.user.id)) return Response.json({ error: "Ordine non autorizzato." }, { status: 403 });
    const apiKey = setting("RESEND_API_KEY");
    const from = setting("MAIL_FROM");
    if (!apiKey || !from) return Response.json({ ok: true, configured: false });
    const kind = body.kind === "status_updated" ? "status_updated" : "order_created";
    const status = statusLabel(order.status);
    const subject = kind === "status_updated" ? `Jolly Dolciumi · ordine ${order.id.slice(0, 8).toUpperCase()} aggiornato` : `Jolly Dolciumi · ordine ricevuto`;
    const title = kind === "status_updated" ? "Il tuo ordine è stato aggiornato" : "Abbiamo ricevuto il tuo ordine";
    const html = `<div style="font-family:Arial,sans-serif;color:#351017;max-width:600px;margin:auto"><h1 style="color:#a70d36">Jolly Dolciumi</h1><h2>${title}</h2><p>Ordine <strong>JL-${order.id.slice(0, 8).toUpperCase()}</strong></p><p>Stato: <strong>${escapeHtml(status)}</strong></p><p>Totale: <strong>${Number(order.total_amount).toFixed(2).replace(".", ",")} €</strong></p><p>Accedi al tuo account per vedere il dettaglio dell’ordine.</p></div>`;
    const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [order.customer_email], subject, html }) });
    if (!response.ok) throw new Error("Il servizio email non ha accettato la richiesta.");
    return Response.json({ ok: true, configured: true });
  } catch (error) { return jsonError(error); }
}
