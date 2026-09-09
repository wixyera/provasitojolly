export type Product = {
  id: string; name: string; slug: string; category: string; description: string;
  price: number; compare_at_price: number | null; image_url: string | null;
  badge: string | null; stock: number; featured: boolean; is_active: boolean;
  sku?: string | null; weight_label?: string | null; ingredients?: string | null;
  allergens?: string | null; created_at?: string; purchase_mode?: "buy" | "quote";
};
export type Profile = { id: string; full_name: string; role: "customer" | "staff"; phone?: string; email?: string; is_blocked?: boolean; created_at?: string };
export type Address = { full_name: string; phone: string; street: string; city: string; postal_code: string; country: string; company?: string; tax_id?: string };
export type SavedAddress = Address & { id: string; label: string; user_id: string };
export type CartEntry = { product_id: string; quantity: number };
export type CartLine = CartEntry & { product: Product };
export type OrderItem = { product_id: string | null; product_name: string; quantity: number; unit_price: number };
export type Order = {
  id: string; user_id: string; customer_email: string; status: string; payment_status: string;
  payment_provider: string | null; total_amount: number; subtotal: number; shipping_amount: number;
  discount_amount: number; coupon_code: string | null; note: string | null; gift_message: string | null;
  shipping_address: Address | null; delivery_method: "shipping" | "pickup";
  tracking_url: string | null; created_at: string; order_items: OrderItem[];
};
export type Quote = { id: string; product_id: string | null; product_name: string; user_id: string; message: string; phone: string; status: string; created_at: string };
export type Settings = {
  id: number; shipping_fee: number; free_shipping_threshold: number; pickup_enabled: boolean;
  pickup_address: string; card_enabled: boolean; contact_email: string; contact_phone: string;
  announcement: string; bank_details: string; bank_enabled: boolean;
};
export const DEFAULT_SETTINGS: Settings = { id: 1, shipping_fee: 4.9, free_shipping_threshold: 39, pickup_enabled: false, pickup_address: "", card_enabled: false, contact_email: "", contact_phone: "", announcement: "Dolce, salato e tutto quello che cerchi.", bank_details: "", bank_enabled: false };
export type Coupon = { code: string; percent_off: number; min_amount: number; expires_at: string | null; is_active: boolean };
export const ORDER_STATUS: Record<string, string> = { pending: "Da confermare", confirmed: "Confermato", preparing: "In preparazione", shipped: "Spedito", completed: "Consegnato", cancelled: "Annullato" };
export const PAYMENT_STATUS: Record<string, string> = { unpaid: "Da pagare", pending: "Pagamento in attesa", paid: "Pagato", failed: "Non riuscito", refunded: "Rimborsato" };
export const EMPTY_ADDRESS: Address = { full_name: "", phone: "", street: "", city: "", postal_code: "", country: "IT", company: "", tax_id: "" };
export const CATEGORIES = ["Tutto", "Caramelle", "Gommose", "Cioccolato", "Snack e patatine", "Bibite", "Gelati e granite", "Attrezzature", "Box regalo"];
export const money = (n: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);
export const date = (s: string) => new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric" }).format(new Date(s));
export const orderNumber = (s: string) => `JL-${s.slice(0, 8).toUpperCase()}`;
export function safeImage(s?: string | null) { if (!s) return null; return /^https:\/\//i.test(s) || (s.startsWith("/") && !s.startsWith("//")) ? s : null; }
export function safeLink(s?: string | null) { try { const u = new URL(s || ""); return u.protocol === "https:" ? u.href : null; } catch { return null; } }
export function productImage(p: Product) {
  if (safeImage(p.image_url)) return safeImage(p.image_url);
  const c = p.category.toLowerCase();
  if (/attrezz|gelat|granit/.test(c)) return "/equipment.png";
  if (/cioccol/.test(c)) return "/chocolate.png";
  if (/regal|box/.test(c)) return "/giftbox.png";
  return "/assortment.png";
}
export function totals(lines: CartLine[], settings: Settings, delivery: string = "shipping", percent = 0) {
  const subtotal = Math.round(lines.reduce((n, l) => n + Number(l.product.price) * l.quantity, 0) * 100) / 100;
  const discount = Math.round(subtotal * percent) / 100;
  const shipping = delivery === "pickup" || subtotal - discount >= Number(settings.free_shipping_threshold) ? 0 : Number(settings.shipping_fee);
  return { subtotal, discount, shipping, total: Math.round((subtotal - discount + shipping) * 100) / 100 };
}
export function csvCell(value: unknown) { let s = String(value ?? ""); if (/^[=+@\-\t\r]/.test(s)) s = `'${s}`; return `"${s.replace(/"/g, '""')}"`; }
export function downloadCsv(name: string, rows: unknown[][]) {
  const blob = new Blob(["\uFEFF", rows.map(r => r.map(csvCell).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
