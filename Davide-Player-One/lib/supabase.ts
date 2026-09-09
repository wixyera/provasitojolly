import type { Address, CartEntry, Coupon, InventoryMovement, Order, Product, Profile, Quote, SavedAddress, Settings } from "./shop";
export type Session = { access_token: string; refresh_token: string; expires_at?: number; expires_in?: number; user: { id: string; email: string } };
type Config = { url: string; key: string; authRedirectUrl: string };
declare global { interface Window { __JOLLY_CONFIG__?: { supabaseUrl?: string; supabaseAnonKey?: string; authRedirectUrl?: string } } }
const KEY = "jolly-session-v3";
export function getConfig(): Config | null {
  if (typeof window === "undefined") return null;
  const c = window.__JOLLY_CONFIG__;
  if (!c?.supabaseUrl || !c.supabaseAnonKey || c.supabaseAnonKey.startsWith("sb_secret_")) return null;
  const configuredRedirect = c.authRedirectUrl?.trim().replace(/\/$/, "");
  const isLocalRedirect = !!configuredRedirect && /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/.*)?$/i.test(configuredRedirect);
  return { url: c.supabaseUrl.replace(/\/$/, ""), key: c.supabaseAnonKey, authRedirectUrl: configuredRedirect && !isLocalRedirect ? configuredRedirect : window.location.origin };
}
export function errorMessage(error: unknown): string {
  const m = error instanceof Error ? error.message : "Operazione non riuscita. Riprova.";
  if (/Invalid login credentials/i.test(m)) return "Email o password non corrette.";
  if (/Email not confirmed/i.test(m)) return "Conferma prima il tuo indirizzo email.";
  if (/rate limit|too many|over_email_send_rate/i.test(m)) return "Troppe richieste. Attendi qualche minuto e riprova.";
  if (/schema cache|does not exist|PGRST20[245]/i.test(m)) return "Il database deve essere aggiornato: esegui supabase/AGGIORNAMENTO.sql nel SQL Editor di Supabase.";
  if (/Failed to fetch|NetworkError|fetch failed/i.test(m)) return "Connessione non disponibile. I dati non salvati restano nel modulo: riprova.";
  return m.slice(0, 350);
}
export class ShopApi {
  session: Session | null = null;
  private refreshPromise: Promise<void> | null = null;
  constructor(public config: Config) {}
  private save(session: Session | null) {
    this.session = session;
    try { if (session) localStorage.setItem(KEY, JSON.stringify(session)); else localStorage.removeItem(KEY); } catch { /* Private browsing: session remains in memory. */ }
  }
  private async raw<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
    const headers = new Headers(options.headers);
    headers.set("apikey", this.config.key);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (!(options.body instanceof Blob)) headers.set("Content-Type", "application/json");
    const res = await fetch(this.config.url + path, { ...options, headers, cache: "no-store" });
    const text = await res.text();
    let data: Record<string, unknown> = {}; try { data = text ? JSON.parse(text) : {}; } catch { /* report HTTP error below */ }
    if (!res.ok) throw new Error(String(data.msg || data.message || data.error_description || data.error || `Richiesta non riuscita (${res.status})`));
    return data as T;
  }
  async token() {
    if (!this.session) throw new Error("Accedi per continuare.");
    if ((this.session.expires_at || 0) < Date.now() / 1000 + 90) {
      if (!this.refreshPromise) this.refreshPromise = (async () => {
        const s = await this.raw<Session>("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: JSON.stringify({ refresh_token: this.session?.refresh_token }) });
        this.save({ ...s, expires_at: s.expires_at || Date.now() / 1000 + (s.expires_in || 3600) });
      })().finally(() => { this.refreshPromise = null; });
      await this.refreshPromise;
    }
    return this.session!.access_token;
  }
  async request<T>(path: string, options: RequestInit = {}): Promise<T> { return this.raw<T>(path, options, await this.token()); }
  async rpc<T>(name: string, args: Record<string, unknown> = {}) { return this.request<T>(`/rest/v1/rpc/${name}`, { method: "POST", body: JSON.stringify(args) }); }
  async all<T>(table: string, query = "select=*"): Promise<T[]> {
    const rows: T[] = [];
    for (let offset = 0; ; offset += 500) {
      const page = await this.request<T[]>(`/rest/v1/${table}?${query}&limit=500&offset=${offset}`);
      rows.push(...page); if (page.length < 500) return rows;
      if (offset >= 49500) throw new Error("Troppi risultati. Contatta lo staff per un’esportazione completa.");
    }
  }
  async boot(): Promise<{ profile: Profile | null; recovery: boolean }> {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const recovery = hash.get("type") === "recovery" || hash.get("type") === "invite";
    if (hash.has("error_description")) { const m = hash.get("error_description")!; history.replaceState({}, "", location.pathname + location.search); throw new Error(m); }
    if (hash.has("access_token") && hash.has("refresh_token")) {
      const token = hash.get("access_token")!;
      const user = await this.raw<Session["user"]>("/auth/v1/user", {}, token);
      this.save({ access_token: token, refresh_token: hash.get("refresh_token")!, expires_at: Date.now() / 1000 + Number(hash.get("expires_in") || 3600), user });
      history.replaceState({}, "", location.pathname + location.search);
    } else {
      try { this.session = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { this.save(null); }
    }
    if (!this.session) return { profile: null, recovery: false };
    try {
      const user = await this.request<Session["user"]>("/auth/v1/user");
      this.save({ ...this.session, user });
      return { profile: await this.profile(), recovery };
    } catch (e) { this.save(null); throw e; }
  }
  async signIn(email: string, password: string) {
    const s = await this.raw<Session>("/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify({ email: email.trim(), password }) });
    this.save({ ...s, expires_at: s.expires_at || Date.now() / 1000 + (s.expires_in || 3600) });
    try { return await this.profile(); } catch (e) { this.save(null); throw e; }
  }
  async signUp(email: string, password: string, fullName: string) {
    const s = await this.raw<Session>(`/auth/v1/signup?redirect_to=${encodeURIComponent(this.config.authRedirectUrl + "/")}`, { method: "POST", body: JSON.stringify({ email: email.trim(), password, data: { full_name: fullName.trim() } }) });
    if (!s.access_token) return null;
    this.save({ ...s, expires_at: s.expires_at || Date.now() / 1000 + (s.expires_in || 3600) }); return this.profile();
  }
  async signOut() { try { if (this.session) await this.request("/auth/v1/logout?scope=local", { method: "POST" }); } finally { this.save(null); localStorage.removeItem("jolly-user"); localStorage.removeItem("jolly-cart"); } }
  reset(email: string) { return this.raw(`/auth/v1/recover?redirect_to=${encodeURIComponent(this.config.authRedirectUrl + "/")}`, { method: "POST", body: JSON.stringify({ email: email.trim() }) }); }
  async verifyRecovery(email: string, token: string) {
    const s = await this.raw<Session>("/auth/v1/verify", { method: "POST", body: JSON.stringify({ email: email.trim(), token: token.trim(), type: "recovery" }) });
    if (!s.access_token || !s.refresh_token) throw new Error("Codice non valido o scaduto. Richiedine uno nuovo.");
    this.save({ ...s, expires_at: s.expires_at || Date.now() / 1000 + (s.expires_in || 3600) });
  }
  password(password: string) { return this.request("/auth/v1/user", { method: "PUT", body: JSON.stringify({ password }) }); }
  async profile() {
    const rows = await this.request<Profile[]>(`/rest/v1/profiles?select=*&id=eq.${this.session!.user.id}`);
    if (!rows[0]) throw new Error("Profilo non disponibile. Chiedi allo staff di verificare la configurazione del database.");
    if (rows[0].is_blocked) throw new Error("Account sospeso. Contatta lo staff per riattivarlo.");
    return rows[0];
  }
  async products() {
 const [products,stock]=await Promise.all([this.all<Product>("products", "select=*&order=featured.desc,created_at.desc,id.asc"),this.rpc<{id:string;available:number}[]>("catalog_stock")]);
 const available=new Map(stock.map(p=>[p.id,p.available]));return products.map(p=>({...p,available_stock:available.get(p.id)??0}));
 }
  orders() { return this.all<Order>("orders", "select=*,order_items(*)&order=created_at.desc,id.asc"); }
  async settings() { const rows = await this.request<Settings[]>("/rest/v1/store_settings?select=*&id=eq.1"); if (!rows[0]) throw new Error("Configurazione negozio mancante. Esegui supabase/AGGIORNAMENTO.sql."); return rows[0]; }
  cart() { return this.all<CartEntry>("cart_items", `select=product_id,quantity&user_id=eq.${this.session!.user.id}&order=product_id`); }
  setQuantity(productId: string, quantity: number) { return this.rpc<CartEntry[]>("set_cart_quantity", { p_product_id: productId, p_quantity: quantity }); }
  stockAlert(productId: string, active = true) { return this.request(`/rest/v1/stock_alerts${active ? "" : `?user_id=eq.${this.session!.user.id}&product_id=eq.${productId}`}`, { method: active ? "POST" : "DELETE", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, ...(active ? { body: JSON.stringify({ user_id: this.session!.user.id, product_id: productId }) } : {}) }); }
  movements() { return this.all<InventoryMovement>("inventory_movements", "select=*,products(name)&order=created_at.desc"); }
  adjustStock(productId: string, delta: number, reason: string, note: string) { return this.rpc<Product[]>("staff_adjust_stock", { p_product_id: productId, p_delta: delta, p_reason: reason, p_note: note }); }
  async wishlist() { return (await this.all<{ product_id: string }>("wishlist", `select=product_id&user_id=eq.${this.session!.user.id}&order=product_id`)).map(x => x.product_id); }
  favorite(id: string, active: boolean) { return this.request(`/rest/v1/wishlist${active ? "" : `?user_id=eq.${this.session!.user.id}&product_id=eq.${id}`}`, { method: active ? "POST" : "DELETE", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, ...(active ? { body: JSON.stringify({ user_id: this.session!.user.id, product_id: id }) } : {}) }); }
  addresses() { return this.all<SavedAddress>("addresses", `select=*&user_id=eq.${this.session!.user.id}&order=created_at.desc,id.asc`); }
  saveAddress(address: Address, label = "Indirizzo principale") { return this.request("/rest/v1/addresses", { method: "POST", body: JSON.stringify({ ...address, label, user_id: this.session!.user.id }) }); }
  removeAddress(id: string) { return this.request(`/rest/v1/addresses?id=eq.${id}`, { method: "DELETE" }); }
  saveProfile(name: string, phone: string) { return this.rpc("update_own_profile", { p_name: name, p_phone: phone }); }
  coupon(code: string, subtotal: number) { return this.rpc<Coupon>("check_coupon", { p_code: code.trim().toUpperCase(), p_subtotal: subtotal }); }
  placeOrder(data: { items: CartEntry[]; address: Address; delivery: string; payment: string; coupon: string; note: string; gift: string; requestId: string }) {
    return this.rpc<{ id: string; total_amount: number }>("checkout_order", { p_items: data.items, p_address: data.address, p_delivery: data.delivery, p_payment: data.payment, p_coupon: data.coupon || null, p_note: data.note, p_gift: data.gift, p_request_id: data.requestId });
  }
  cancelOrder(id: string) { return this.rpc("cancel_order", { p_order_id: id }); }
  staffOrder(id: string, status: string, tracking: string, markPaid = false) { return this.rpc("staff_order_update", { p_order_id: id, p_status: status, p_tracking: tracking, p_mark_paid: markPaid }); }
  saveProduct(p: Record<string, unknown>, id?: string) { return this.request<Product[]>(`/rest/v1/products${id ? `?id=eq.${id}` : ""}`, { method: id ? "PATCH" : "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(p) }); }
  users() { return this.all<Profile>("profiles", "select=*&order=created_at.desc,id.asc"); }
  staffUser(p: Profile) { return this.rpc("staff_user_update", { p_user_id: p.id, p_name: p.full_name, p_phone: p.phone || "", p_role: p.role, p_blocked: !!p.is_blocked, p_tier: p.customer_tier || "retail" }); }
  coupons() { return this.all<Coupon>("coupons", "select=*&order=code"); }
  saveCoupon(c: Coupon) { return this.request("/rest/v1/coupons", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify(c) }); }
  saveSettings(s: Settings) { return this.request("/rest/v1/store_settings?id=eq.1", { method: "PATCH", body: JSON.stringify(s) }); }
  quotes() { return this.all<Quote>("quote_requests", "select=*&order=created_at.desc,id.asc"); }
  quote(p: Product, message: string, phone: string) { return this.rpc("request_quote", { p_product_id: p.id, p_message: message, p_phone: phone }); }
  updateQuote(id: string, status: string) { return this.request(`/rest/v1/quote_requests?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ status }) }); }
  async server<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await this.token()}` }, body: JSON.stringify(body) });
    const data = await res.json() as { error?: string };
    if (!res.ok) throw new Error(data.error || "Operazione non riuscita.");
    return data as T;
  }
  notifyOrder(orderId: string, kind: "order_created" | "status_updated") { return this.server<{ ok: boolean; configured?: boolean }>("/api/notify", { orderId, kind }); }
  async upload(file: File) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error("Usa un’immagine JPG, PNG o WebP fino a 5 MB.");
    const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[file.type];
    const path = `${crypto.randomUUID()}.${ext}`;
    await this.request(`/storage/v1/object/products/${path}`, { method: "POST", headers: { "Content-Type": file.type, "x-upsert": "false" }, body: file });
    return `${this.config.url}/storage/v1/object/public/products/${path}`;
  }
}
