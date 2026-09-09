export type Product = {
  id: string; name: string; slug: string; category: string; description: string;
  price: number; compare_at_price: number | null; image_url: string | null;
  badge: string | null; stock: number; available_stock?: number; featured: boolean; is_active: boolean;
  sku?: string | null; weight_label?: string | null; ingredients?: string | null;
  allergens?: string | null; created_at?: string; purchase_mode?: "buy" | "quote";
  business_price?: number | null; vip_price?: number | null;
  low_stock_threshold?: number; warehouse_location?: string | null;
  quantity_discounts?: QuantityDiscount[] | null;
  bundle_items?: BundleItem[] | null;
};
export type QuantityDiscount = { min_quantity: number; percent_off: number };
export type BundleItem = { label: string; quantity: number; product_id?: string };
export type CustomerTier = "retail" | "business" | "vip";
export type Profile = { id: string; full_name: string; role: "customer" | "staff"; phone?: string; email?: string; is_blocked?: boolean; customer_tier?: CustomerTier; created_at?: string };
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
  tracking_url: string | null; paid_at?: string | null; created_at: string; order_items: OrderItem[];
};
export type Quote = { id: string; product_id: string | null; product_name: string; user_id: string; message: string; phone: string; status: string; created_at: string };
export type InventoryMovement = { id: string; product_id: string; product_name?: string; staff_id: string; delta: number; reason: string; note: string; created_at: string };
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
export function priceFor(product: Product, profile?: Profile | null) {
  const tier = profile?.role === "staff" ? "retail" : profile?.customer_tier || "retail";
  const tierPrice = tier === "business" ? product.business_price : tier === "vip" ? product.vip_price : null;
  return tierPrice !== null && tierPrice !== undefined && Number(tierPrice) > 0 ? Number(tierPrice) : Number(product.price);
}
export function quantityDiscount(product: Product, quantity: number) {
  return Math.max(0,...(product.quantity_discounts || []).filter(d => Number(d.min_quantity) <= quantity).map(d=>Number(d.percent_off)));
}
export function lineUnitPrice(product: Product, quantity: number) {
  const percent = quantityDiscount(product, quantity);
  return Math.round(Number(product.price) * (1 - Number(percent) / 100) * 100) / 100;
}
export function parseQuantityDiscounts(value: string): QuantityDiscount[] {
  return value.split(",").map(part => part.trim()).filter(Boolean).map(part => {
    const [min, percent] = part.split(":").map(x => Number(x.replace(",", ".").trim()));
    return { min_quantity: Math.floor(min), percent_off: Math.round(percent * 100) / 100 };
  }).filter(x => Number.isInteger(x.min_quantity) && x.min_quantity > 1 && Number.isFinite(x.percent_off) && x.percent_off > 0 && x.percent_off < 90).sort((a, b) => a.min_quantity - b.min_quantity);
}
export function parseBundleItems(value: string): BundleItem[] {
 return value.split(",").map(part=>part.trim()).filter(Boolean).map(part=>{
  const cut=part.lastIndexOf(":");const label=(cut>0?part.slice(0,cut):part).trim();const quantity=Number(cut>0?part.slice(cut+1):1);
  if(label.length<2||!Number.isInteger(quantity)||quantity<1||quantity>99)throw new Error(`Componente non valido: ${part}. Usa SKU:quantità, con quantità intera da 1 a 99.`);
  return {label,quantity};
 });
}
export function bundleLabel(product: Product) { return (product.bundle_items || []).map(x => `${x.quantity}× ${x.label}`).join("  ·  "); }
export function quantityDiscountLabel(product: Product) {
  return (product.quantity_discounts || []).sort((a, b) => a.min_quantity - b.min_quantity).map(d => `${d.min_quantity}+ · −${d.percent_off}%`).join("  ·  ");
}
export function totals(lines: CartLine[], settings: Settings, delivery: string = "shipping", percent = 0) {
  const subtotal = Math.round(lines.reduce((n, l) => n + lineUnitPrice(l.product, l.quantity) * l.quantity, 0) * 100) / 100;
  const discount = Math.round(subtotal * percent) / 100;
  const shipping = delivery === "pickup" || subtotal - discount >= Number(settings.free_shipping_threshold) ? 0 : Number(settings.shipping_fee);
  return { subtotal, discount, shipping, total: Math.round((subtotal - discount + shipping) * 100) / 100 };
}
export function csvCell(value: unknown) { let s = String(value ?? ""); if (/^[=+@\-\t\r]/.test(s)) s = `'${s}`; return `"${s.replace(/"/g, '""')}"`; }
export function downloadCsv(name: string, rows: unknown[][]) {
  const blob = new Blob(["\uFEFF", rows.map(r => r.map(csvCell).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
