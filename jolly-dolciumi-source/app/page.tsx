"use client";

import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Check,
  ChevronDown,
  ChevronLeft,
  CircleUserRound,
  ClipboardList,
  Gift,
  Heart,
  LogOut,
  Menu,
  Minus,
  PackageCheck,
  Pencil,
  Plus,
  Search,
  Settings2,
  ShoppingBag,
  Sparkles,
  Star,
  Trash2,
  Truck,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createOrder,
  createProduct,
  getAdminOrders,
  getAdminProducts,
  getCurrentUser,
  getOrders,
  getProducts,
  getProfile,
  getSupabaseConfig,
  signInWithPassword,
  signUpWithPassword,
  SupabaseConfig,
  SupabaseProfile,
  SupabaseSession,
  updateOrderStatus,
  updateProduct,
  uploadProductImage,
} from "@/lib/supabase";

type Product = {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  price: number;
  compare_at_price: number | null;
  image_url: string | null;
  badge: string | null;
  rating: number;
  reviews: number;
  stock: number;
  featured: boolean;
  is_active: boolean;
};

type CartLine = {
  product: Product;
  quantity: number;
};

type OrderItem = {
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
};

type OrderRecord = {
  id: string;
  status: string;
  total_amount: number;
  customer_email: string;
  created_at: string;
  order_items: OrderItem[];
};

type AppUser = {
  id: string;
  email: string;
  fullName: string;
  role: "customer" | "staff";
  session: SupabaseSession | null;
  isDemo?: boolean;
};

const DEMO_PRODUCTS: Product[] = [
  {
    id: "demo-party-mix",
    name: "Party Mix Rainbow",
    slug: "party-mix-rainbow",
    category: "Gommose",
    description: "Un mix colorato di caramelle gommose, frutta e zucchero frizzante.",
    price: 8.9,
    compare_at_price: 10.9,
    image_url: null,
    badge: "Bestseller",
    rating: 4.9,
    reviews: 128,
    stock: 60,
    featured: true,
    is_active: true,
  },
  {
    id: "demo-pistacchio",
    name: "Pistacchio Crunch",
    slug: "pistacchio-crunch",
    category: "Cioccolato",
    description: "Cioccolato al latte, pistacchio croccante e un finale leggermente salato.",
    price: 12.5,
    compare_at_price: null,
    image_url: null,
    badge: "Nuovo",
    rating: 4.8,
    reviews: 64,
    stock: 32,
    featured: true,
    is_active: true,
  },
  {
    id: "demo-sour-galaxy",
    name: "Sour Galaxy",
    slug: "sour-galaxy",
    category: "Caramelle",
    description: "Nastri sour alla frutta con un’esplosione acidula.",
    price: 6.5,
    compare_at_price: null,
    image_url: null,
    badge: "Acidissime",
    rating: 4.7,
    reviews: 92,
    stock: 45,
    featured: false,
    is_active: true,
  },
  {
    id: "demo-jolly-box",
    name: "Jolly Box",
    slug: "jolly-box",
    category: "Regali",
    description: "La box sorpresa per chi non sa scegliere una sola dolcezza.",
    price: 24,
    compare_at_price: 29,
    image_url: null,
    badge: "Regalo perfetto",
    rating: 5,
    reviews: 41,
    stock: 18,
    featured: true,
    is_active: true,
  },
  {
    id: "demo-choco-bites",
    name: "Choco Bites",
    slug: "choco-bites",
    category: "Cioccolato",
    description: "Bocconcini di cioccolato fondente con cuore morbido.",
    price: 9.9,
    compare_at_price: null,
    image_url: null,
    badge: null,
    rating: 4.9,
    reviews: 77,
    stock: 40,
    featured: false,
    is_active: true,
  },
  {
    id: "demo-fruit-drops",
    name: "Fruit Drops",
    slug: "fruit-drops",
    category: "Caramelle",
    description: "Caramelle dure alla frutta, lucide e profumate.",
    price: 5.9,
    compare_at_price: null,
    image_url: null,
    badge: null,
    rating: 4.8,
    reviews: 53,
    stock: 80,
    featured: false,
    is_active: true,
  },
];

const CATEGORIES = ["Tutto", "Caramelle", "Gommose", "Cioccolato", "Regali"];
const STATUS_LABELS: Record<string, string> = {
  pending: "In attesa",
  confirmed: "Confermato",
  preparing: "In preparazione",
  shipped: "Spedito",
  completed: "Completato",
  cancelled: "Annullato",
};

function money(value: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);
}

function productFromRow(row: Partial<Product> & Record<string, unknown>): Product {
  return {
    id: String(row.id ?? crypto.randomUUID()),
    name: String(row.name ?? "Prodotto Jolly"),
    slug: String(row.slug ?? String(row.name ?? "prodotto").toLowerCase()),
    category: String(row.category ?? "Caramelle"),
    description: String(row.description ?? "Una nuova dolcezza Jolly."),
    price: Number(row.price ?? 0),
    compare_at_price: row.compare_at_price === null || row.compare_at_price === undefined ? null : Number(row.compare_at_price),
    image_url: row.image_url ? String(row.image_url) : null,
    badge: row.badge ? String(row.badge) : null,
    rating: Number(row.rating ?? 4.9),
    reviews: Number(row.reviews ?? 0),
    stock: Number(row.stock ?? 0),
    featured: Boolean(row.featured),
    is_active: row.is_active === undefined ? true : Boolean(row.is_active),
  };
}

function orderFromRow(row: Partial<OrderRecord> & Record<string, unknown>): OrderRecord {
  const items = Array.isArray(row.order_items) ? row.order_items : [];
  return {
    id: String(row.id ?? `JOL-${Date.now()}`),
    status: String(row.status ?? "pending"),
    total_amount: Number(row.total_amount ?? 0),
    customer_email: String(row.customer_email ?? "cliente@jolly.it"),
    created_at: String(row.created_at ?? new Date().toISOString()),
    order_items: items.map((item) => {
      const typed = item as Record<string, unknown>;
      return {
        product_id: typed.product_id ? String(typed.product_id) : null,
        product_name: String(typed.product_name ?? "Dolcezza Jolly"),
        quantity: Number(typed.quantity ?? 1),
        unit_price: Number(typed.unit_price ?? 0),
      };
    }),
  };
}

function categoryEmoji(category: string) {
  if (category === "Cioccolato") return "🍫";
  if (category === "Gommose") return "🧸";
  if (category === "Regali") return "🎁";
  return "🍭";
}

function ProductArt({ product, large = false }: { product: Product; large?: boolean }) {
  const artClass = `product-art product-art-${product.category.toLowerCase()}`;
  if (product.image_url) {
    return <div className={`product-photo ${large ? "product-photo-large" : ""}`}><img src={product.image_url} alt={product.name} /><div className="product-photo-shine" /></div>;
  }
  return <div className={`${artClass} ${large ? "product-art-large" : ""}`}><span className="product-art-emoji" aria-hidden="true">{categoryEmoji(product.category)}</span><span className="product-art-label">JOLLY</span><span className="product-art-dot product-art-dot-one" /><span className="product-art-dot product-art-dot-two" /></div>;
}

function Stars({ rating }: { rating: number }) {
  return <span className="stars" aria-label={`${rating} su 5 stelle`}><Star size={13} fill="currentColor" /><span>{rating.toFixed(1)}</span></span>;
}

function ProductCard({ product, onOpen, onAdd, index }: { product: Product; onOpen: (product: Product) => void; onAdd: (product: Product) => void; index: number }) {
  return <article className="product-card reveal-up" style={{ animationDelay: `${index * 70}ms` }}>
    <button className="product-card-main" onClick={() => onOpen(product)}>
      <div className="product-card-visual">{product.badge ? <span className="product-badge">{product.badge}</span> : null}<span className="product-favorite" aria-hidden="true"><Heart size={16} /></span><ProductArt product={product} /></div>
      <div className="product-card-copy"><div className="product-card-meta"><span>{product.category}</span><Stars rating={product.rating} /></div><h3>{product.name}</h3><p>{product.description}</p><div className="product-card-bottom"><div><strong>{money(product.price)}</strong>{product.compare_at_price ? <del>{money(product.compare_at_price)}</del> : null}</div><span className="add-product" aria-label={`Aggiungi ${product.name}`}><Plus size={18} /></span></div></div>
    </button>
    <button className="product-quick-add" onClick={() => onAdd(product)}>Aggiungi al carrello <ArrowUpRight size={14} /></button>
  </article>;
}

function FeatureStrip() {
  return <section className="feature-strip" aria-label="Vantaggi Jolly Dolciumi">
    <div className="feature-item"><span className="feature-icon"><Truck size={19} /></span><div><strong>Spedizione golosa</strong><span>Gratis sopra i 39 €</span></div></div>
    <div className="feature-item"><span className="feature-icon"><BadgeCheck size={19} /></span><div><strong>Scelto con cura</strong><span>Qualità e freschezza</span></div></div>
    <div className="feature-item"><span className="feature-icon"><Gift size={19} /></span><div><strong>Regali speciali</strong><span>Box già pronte o custom</span></div></div>
    <div className="feature-item"><span className="feature-icon"><Zap size={19} /></span><div><strong>Ordini facili</strong><span>Dal catalogo alla porta</span></div></div>
  </section>;
}

function ShieldIcon() { return <span className="tiny-shield">✦</span>; }

function CartSheet({ open, onOpenChange, cart, onChangeQuantity, onRemove, onCheckout, user }: { open: boolean; onOpenChange: (open: boolean) => void; cart: CartLine[]; onChangeQuantity: (id: string, delta: number) => void; onRemove: (id: string) => void; onCheckout: () => void; user: AppUser | null }) {
  const total = cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const quantity = cart.reduce((sum, line) => sum + line.quantity, 0);
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent className="cart-sheet"><SheetHeader className="cart-header"><div><span className="eyebrow">La tua selezione</span><SheetTitle>Carrello <span>{quantity}</span></SheetTitle></div><SheetDescription>Le tue dolcezze, pronte per partire.</SheetDescription></SheetHeader><div className="cart-content">{cart.length === 0 ? <div className="cart-empty"><div className="cart-empty-icon"><ShoppingBag size={26} /></div><h3>Il carrello è ancora vuoto</h3><p>Scopri qualcosa di dolce e portalo con te.</p><Button className="jolly-button" onClick={() => onOpenChange(false)}>Esplora il catalogo</Button></div> : <><div className="cart-lines">{cart.map((line) => <div className="cart-line" key={line.product.id}><div className="cart-line-art"><ProductArt product={line.product} /></div><div className="cart-line-copy"><div className="cart-line-top"><span>{line.product.category}</span><button onClick={() => onRemove(line.product.id)} aria-label={`Rimuovi ${line.product.name}`}><Trash2 size={14} /></button></div><strong>{line.product.name}</strong><div className="cart-line-bottom"><div className="quantity-control"><button onClick={() => onChangeQuantity(line.product.id, -1)} aria-label="Diminuisci quantità"><Minus size={13} /></button><span>{line.quantity}</span><button onClick={() => onChangeQuantity(line.product.id, 1)} aria-label="Aumenta quantità"><Plus size={13} /></button></div><b>{money(line.product.price * line.quantity)}</b></div></div></div>)}</div><div className="cart-summary"><div><span>Subtotale</span><strong>{money(total)}</strong></div><div><span>Spedizione</span><strong>{total >= 39 ? "Gratis" : money(4.9)}</strong></div><div className="cart-total"><span>Totale</span><strong>{money(total >= 39 ? total : total + 4.9)}</strong></div></div><button className="jolly-button jolly-button-wide" onClick={onCheckout}>{user ? "Invia ordine" : "Accedi e ordina"} <ArrowRight size={17} /></button><p className="cart-note"><ShieldIcon /> Account e ordine protetti; il pagamento online verrà collegato al provider scelto.</p></>}</div><SheetFooter /></SheetContent></Sheet>;
}

function AuthDialog({ open, onOpenChange, user, onUser, onLogout, onOpenAdmin, orders, mode, required = false }: { open: boolean; onOpenChange: (open: boolean) => void; user: AppUser | null; onUser: (user: AppUser) => void; onLogout: () => void; onOpenAdmin: () => void; orders: OrderRecord[]; mode: "demo" | "live"; required?: boolean }) {
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const config = getSupabaseConfig();
  useEffect(() => { if (open) { setMessage(""); setBusy(false); } }, [open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email || !password) return;
    setBusy(true); setMessage("");
    try {
      if (mode === "demo" || !config) {
        onUser({ id: "demo-user", email, fullName: fullName || email.split("@")[0] || "Cliente Jolly", role: "customer", session: null, isDemo: true });
        onOpenChange(false); return;
      }
      const session = authMode === "login" ? await signInWithPassword(config, email, password) : await signUpWithPassword(config, email, password, fullName || email.split("@")[0]);
      if (!session.access_token) { setMessage("Account creato: controlla la tua email per confermare l’indirizzo."); return; }
      const profile: SupabaseProfile | null = await getProfile(config, session).catch(() => null);
      onUser({ id: session.user.id, email: session.user.email || email, fullName: profile?.full_name || fullName || email.split("@")[0], role: profile?.role || "customer", session });
      onOpenChange(false);
    } catch (error) { setMessage(error instanceof Error ? error.message.replace(/[{}]/g, "") : "Controlla i dati e riprova."); } finally { setBusy(false); }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="auth-dialog" showCloseButton={!required}>{user ? <><DialogHeader><span className="account-orb"><CircleUserRound size={24} /></span><DialogTitle>Ciao, {user.fullName.split(" ")[0]}.</DialogTitle><DialogDescription>{user.email}</DialogDescription></DialogHeader><div className="account-summary"><div><span>Ordini</span><strong>{orders.length}</strong></div><div><span>Stato</span><strong>{user.isDemo ? "Demo" : "Attivo"}</strong></div></div><div className="account-actions"><button className="account-action" onClick={() => setMessage(orders.length ? `Hai ${orders.length} ordini nella cronologia.` : "Non hai ancora effettuato ordini.")}><ClipboardList size={17} /><span>I miei ordini</span><ChevronDown size={15} /></button>{user.role === "staff" || user.isDemo ? <button className="account-action" onClick={onOpenAdmin}><Settings2 size={17} /><span>Area staff</span><ArrowUpRight size={15} /></button> : null}<button className="account-action account-action-danger" onClick={onLogout}><LogOut size={17} /><span>Esci dall’account</span></button></div>{orders.length ? <div className="mini-orders">{orders.slice(0, 3).map((order) => <div key={order.id}><span>{order.id.slice(0, 12)}</span><b>{money(order.total_amount)}</b><em>{STATUS_LABELS[order.status] || order.status}</em></div>)}</div> : null}{message ? <p className="form-message">{message}</p> : null}</> : <><DialogHeader><span className="auth-kicker"><Sparkles size={14} /> Jolly Club</span><DialogTitle>{authMode === "login" ? "Bentornato nel lato dolce." : "Entra nel mondo Jolly."}</DialogTitle><DialogDescription>{mode === "demo" ? "Stai provando la modalità demo: puoi usare qualsiasi email e password." : "Accedi per salvare il carrello e seguire i tuoi ordini."}</DialogDescription></DialogHeader><form className="auth-form" onSubmit={submit}>{authMode === "signup" ? <label>Nome e cognome<Input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Il tuo nome" /></label> : null}<label>Email<Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nome@email.com" required /></label><label>Password<Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" minLength={6} required /></label>{message ? <p className="form-message form-message-error">{message}</p> : null}<Button className="jolly-button jolly-button-wide" disabled={busy}>{busy ? "Un momento…" : authMode === "login" ? "Accedi" : "Crea account"} <ArrowRight size={16} /></Button></form><div className="auth-switch">{authMode === "login" ? "Non hai ancora un account?" : "Hai già un account?"}<button onClick={() => { setAuthMode(authMode === "login" ? "signup" : "login"); setMessage(""); }}>{authMode === "login" ? "Registrati" : "Accedi"}</button></div><p className="auth-privacy"><ShieldIcon /> Non condividiamo i tuoi dati con nessuno.</p></>}</DialogContent></Dialog>;
}

function AccessLoading() {
  return <main className="access-loading"><span className="brand-mark">J</span><span>Controllo accesso…</span></main>;
}

function AccessGate({ mode, onUser }: { mode: "demo" | "live"; onUser: (user: AppUser) => void }) {
  return <main className="access-gate"><div className="access-gate-orb access-gate-orb-one" /><div className="access-gate-orb access-gate-orb-two" /><section className="access-gate-content"><button className="access-gate-brand" type="button"><span className="brand-mark">J</span><span><strong>Jolly</strong><small>dolciumi</small></span></button><span className="eyebrow eyebrow-light">Area riservata</span><h1>Prima entra nel mondo <em>Jolly.</em></h1><p>Catalogo, carrello e ordini sono disponibili solo dopo l’accesso. Crea il tuo account cliente oppure entra con il profilo staff.</p><div className="access-gate-pills"><span>Catalogo privato</span><span>Ordini personali</span><span>Area staff separata</span></div></section><AuthDialog open onOpenChange={() => undefined} user={null} onUser={onUser} onLogout={() => undefined} onOpenAdmin={() => undefined} orders={[]} mode={mode} required /></main>;
}

function ProductDialog({ product, onClose, onAdd }: { product: Product | null; onClose: () => void; onAdd: (product: Product) => void }) {
  return <Dialog open={Boolean(product)} onOpenChange={(open) => !open && onClose()}><DialogContent className="product-dialog">{product ? <div className="product-dialog-layout"><div className="product-dialog-art"><ProductArt product={product} large /></div><div className="product-dialog-copy"><div className="product-card-meta"><span>{product.category}</span><Stars rating={product.rating} /></div><DialogTitle>{product.name}</DialogTitle><DialogDescription>{product.description}</DialogDescription><p className="product-dialog-long-copy">Selezionato e confezionato con cura. Aggiungilo alla tua scorta dolce o trasformalo in un regalo che si fa ricordare.</p><div className="product-dialog-price"><strong>{money(product.price)}</strong>{product.compare_at_price ? <del>{money(product.compare_at_price)}</del> : null}</div><div className="product-dialog-stock"><span className="stock-dot" /> Disponibile · {product.stock} pezzi</div><Button className="jolly-button jolly-button-wide" onClick={() => { onAdd(product); onClose(); }}>Aggiungi al carrello <Plus size={17} /></Button></div></div> : null}</DialogContent></Dialog>;
}

type ProductFormState = { id?: string; name: string; category: string; price: string; compare_at_price: string; description: string; stock: string; badge: string; image_url: string; featured: boolean };
const EMPTY_FORM: ProductFormState = { name: "", category: "Caramelle", price: "", compare_at_price: "", description: "", stock: "20", badge: "", image_url: "", featured: false };

function AdminDashboard({ user, products, orders, live, config, onBack, onProducts, onOrders, onToast }: { user: AppUser; products: Product[]; orders: OrderRecord[]; live: boolean; config: SupabaseConfig | null; onBack: () => void; onProducts: (products: Product[]) => void; onOrders: (orders: OrderRecord[]) => void; onToast: (message: string) => void }) {
  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  function editProduct(product: Product) { setForm({ id: product.id, name: product.name, category: product.category, price: String(product.price), compare_at_price: product.compare_at_price ? String(product.compare_at_price) : "", description: product.description, stock: String(product.stock), badge: product.badge || "", image_url: product.image_url || "", featured: product.featured }); window.scrollTo({ top: 0, behavior: "smooth" }); }
  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!form.name || !form.price) return; setSaving(true);
    const slug = `${form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString().slice(-4)}`;
    const payload = { name: form.name, slug: form.id ? products.find((product) => product.id === form.id)?.slug || slug : slug, category: form.category, description: form.description, price: Number(form.price), compare_at_price: form.compare_at_price ? Number(form.compare_at_price) : null, image_url: form.image_url || null, badge: form.badge || null, stock: Number(form.stock || 0), featured: form.featured, is_active: true };
    try {
      if (live && config && user.session) { if (form.id) await updateProduct(config, user.session, form.id, payload); else await createProduct(config, user.session, payload); const fresh = await getAdminProducts<Record<string, unknown>>(config, user.session); onProducts(fresh.map((row) => productFromRow(row))); }
      else { const next = productFromRow({ id: form.id || `demo-${Date.now()}`, ...payload }); onProducts(form.id ? products.map((product) => product.id === form.id ? next : product) : [next, ...products]); }
      setForm(EMPTY_FORM); onToast(form.id ? "Prodotto aggiornato." : "Prodotto aggiunto al catalogo.");
    } catch { onToast("Non è stato possibile salvare il prodotto."); } finally { setSaving(false); }
  }
  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    if (!live || !config || !user.session) { onToast("Il caricamento immagini si attiva dopo aver collegato Supabase."); return; }
    try { const url = await uploadProductImage(config, user.session, file); setForm((current) => ({ ...current, image_url: url })); onToast("Immagine caricata."); } catch { onToast("Upload non riuscito. Controlla il bucket products."); }
  }
  async function changeOrderStatus(orderId: string, status: string) {
    try { if (live && config && user.session) await updateOrderStatus(config, user.session, orderId, status); onOrders(orders.map((order) => order.id === orderId ? { ...order, status } : order)); onToast("Stato ordine aggiornato."); } catch { onToast("Non è stato possibile aggiornare l’ordine."); }
  }
  return <main className="admin-page"><div className="admin-glow admin-glow-one" /><div className="admin-glow admin-glow-two" /><header className="admin-topbar"><button className="back-button" onClick={onBack}><ChevronLeft size={17} /> Torna al catalogo</button><div className="admin-wordmark"><span>J</span><strong>Jolly <em>Staff</em></strong></div><div className="admin-user"><span>{user.fullName}</span><span className="admin-user-dot" /></div></header><div className="admin-content"><div className="admin-heading"><div><span className="eyebrow">Workspace · {live ? "Supabase live" : "Modalità demo"}</span><h1>Il tuo laboratorio dolce.</h1><p>Gestisci catalogo, immagini e ordini da un unico posto.</p></div><div className="admin-heading-mark"><Sparkles size={28} /></div></div><div className="admin-stats"><div><span>Prodotti attivi</span><strong>{products.length}</strong><em><PackageCheck size={14} /> catalogo</em></div><div><span>Ordini ricevuti</span><strong>{orders.length}</strong><em><ClipboardList size={14} /> ultimi ordini</em></div><div><span>Valore ordini</span><strong>{money(orders.reduce((sum, order) => sum + order.total_amount, 0))}</strong><em><Zap size={14} /> demo inclusa</em></div></div><div className="admin-grid"><section className="admin-panel admin-form-panel"><div className="panel-heading"><div><span className="eyebrow">Catalogo</span><h2>{form.id ? "Modifica prodotto" : "Nuovo prodotto"}</h2></div>{form.id ? <button className="text-button" onClick={() => setForm(EMPTY_FORM)}>Annulla modifica</button> : null}</div><form className="product-form" onSubmit={saveProduct}><div className="form-image-upload"><div className="upload-preview">{form.image_url ? <img src={form.image_url} alt="Anteprima prodotto" /> : <Upload size={22} />}</div><label className="upload-control"><span>Carica immagine</span><small>JPG o PNG · consigliato 1:1</small><input type="file" accept="image/*" onChange={uploadImage} /></label></div><label>Nome prodotto<Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Es. Marshmallow Party" required /></label><div className="form-two-cols"><label>Categoria<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{CATEGORIES.filter((category) => category !== "Tutto").map((category) => <option key={category}>{category}</option>)}</select></label><label>Prezzo (€)<Input type="number" step="0.01" min="0" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} placeholder="9.90" required /></label></div><div className="form-two-cols"><label>Prezzo barrato<Input type="number" step="0.01" min="0" value={form.compare_at_price} onChange={(event) => setForm({ ...form, compare_at_price: event.target.value })} placeholder="Facoltativo" /></label><label>Disponibilità<Input type="number" min="0" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} /></label></div><label>Descrizione<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Racconta perché è speciale…" rows={3} /></label><div className="form-two-cols"><label>Badge<Input value={form.badge} onChange={(event) => setForm({ ...form, badge: event.target.value })} placeholder="Bestseller" /></label><label className="check-label"><input type="checkbox" checked={form.featured} onChange={(event) => setForm({ ...form, featured: event.target.checked })} /><span>Metti in evidenza</span></label></div><Button className="jolly-button jolly-button-wide" disabled={saving}>{saving ? "Salvataggio…" : form.id ? "Salva modifiche" : "Aggiungi al catalogo"} <ArrowUpRight size={16} /></Button></form></section><section className="admin-panel admin-products-panel"><div className="panel-heading"><div><span className="eyebrow">Inventario</span><h2>Prodotti in vetrina</h2></div><span className="panel-count">{products.length} articoli</span></div><div className="admin-product-list">{products.map((product) => <div className="admin-product-row" key={product.id}><div className="admin-row-art"><ProductArt product={product} /></div><div className="admin-row-copy"><strong>{product.name}</strong><span>{product.category} · {product.stock} disponibili</span></div><b>{money(product.price)}</b><button className="row-icon" onClick={() => editProduct(product)} aria-label={`Modifica ${product.name}`}><Pencil size={15} /></button></div>)}</div></section></div><section className="admin-panel admin-orders-panel"><div className="panel-heading"><div><span className="eyebrow">Ultima attività</span><h2>Ordini</h2></div><span className="panel-count">Aggiornamento manuale</span></div>{orders.length ? <div className="admin-order-list">{orders.map((order) => <div className="admin-order-row" key={order.id}><div><strong>{order.id}</strong><span>{new Date(order.created_at).toLocaleDateString("it-IT")} · {order.customer_email}</span></div><span className="order-items-count">{order.order_items.reduce((sum, item) => sum + item.quantity, 0)} pezzi</span><b>{money(order.total_amount)}</b><select value={order.status} onChange={(event) => changeOrderStatus(order.id, event.target.value)}>{Object.entries(STATUS_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div>)}</div> : <div className="admin-empty"><ClipboardList size={24} /><p>Gli ordini dei clienti appariranno qui.</p></div>}</section></div></main>;
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>(DEMO_PRODUCTS);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [user, setUser] = useState<AppUser | null>(null);
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const [config, setConfig] = useState<SupabaseConfig | null>(null);
  const [category, setCategory] = useState("Tutto");
  const [search, setSearch] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [view, setView] = useState<"shop" | "admin">("shop");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [toast, setToast] = useState("");
  const [successOrder, setSuccessOrder] = useState<OrderRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const storedCart = window.localStorage.getItem("jolly-cart");
    if (storedCart) { try { setCart(JSON.parse(storedCart) as CartLine[]); } catch { window.localStorage.removeItem("jolly-cart"); } }
    let savedUser: AppUser | null = null;
    const storedUser = window.localStorage.getItem("jolly-user");
    if (storedUser) { try { savedUser = JSON.parse(storedUser) as AppUser; } catch { window.localStorage.removeItem("jolly-user"); } }
    const runtime = getSupabaseConfig();
    if (!runtime) {
      setMode("demo");
      if (savedUser?.isDemo) setUser(savedUser);
      setAuthReady(true);
      return;
    }
    setConfig(runtime); setMode("live");
    if (!savedUser?.session || savedUser.isDemo) { setAuthReady(true); return; }
    getCurrentUser(runtime, savedUser.session)
      .then(async (currentUser) => {
        const profile = await getProfile(runtime, savedUser.session!).catch(() => null);
        setUser({
          ...savedUser,
          id: currentUser.id,
          email: currentUser.email || savedUser.email,
          fullName: profile?.full_name || savedUser.fullName,
          role: profile?.role || "customer",
          session: { ...savedUser.session!, user: currentUser },
        });
      })
      .catch(() => { window.localStorage.removeItem("jolly-user"); setUser(null); })
      .finally(() => setAuthReady(true));
  }, []);
  useEffect(() => {
    if (!authReady || mode !== "live" || !config || !user?.session) return;
    setLoading(true);
    getProducts<Record<string, unknown>>(config, user.session)
      .then((rows) => setProducts(rows.map((row) => productFromRow(row))))
      .catch(() => { setProducts([]); setToast("Non riesco a caricare il catalogo: esegui lo schema Supabase."); })
      .finally(() => setLoading(false));
  }, [authReady, config, mode, user]);
  useEffect(() => { window.localStorage.setItem("jolly-cart", JSON.stringify(cart)); }, [cart]);
  useEffect(() => { if (user) window.localStorage.setItem("jolly-user", JSON.stringify(user)); else window.localStorage.removeItem("jolly-user"); }, [user]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 3000); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(() => { if (!user || !config || !user.session) return; getOrders<Record<string, unknown>>(config, user.session).then((rows) => setOrders(rows.map((row) => orderFromRow(row)))).catch(() => undefined); }, [user, config]);

  const filteredProducts = useMemo(() => { const normalized = search.trim().toLowerCase(); return products.filter((product) => { const matchesCategory = category === "Tutto" || product.category === category; const matchesSearch = !normalized || `${product.name} ${product.category} ${product.description}`.toLowerCase().includes(normalized); return matchesCategory && matchesSearch && product.is_active; }); }, [category, products, search]);
  const cartQuantity = cart.reduce((sum, line) => sum + line.quantity, 0);
  const featuredProduct = products.find((product) => product.featured) || products[0];
  function notify(message: string) { setToast(message); }
  function addToCart(product: Product) { setCart((current) => { const existing = current.find((line) => line.product.id === product.id); return existing ? current.map((line) => line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line) : [...current, { product, quantity: 1 }]; }); notify(`${product.name} aggiunto al carrello.`); }
  function changeQuantity(id: string, delta: number) { setCart((current) => current.flatMap((line) => { if (line.product.id !== id) return [line]; const quantity = line.quantity + delta; return quantity > 0 ? [{ ...line, quantity }] : []; })); }
  function removeFromCart(id: string) { setCart((current) => current.filter((line) => line.product.id !== id)); }
  async function checkout() {
    if (!user) { setCartOpen(false); setAuthOpen(true); return; }
    if (!cart.length) return;
    setLoading(true); const subtotal = cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0); const total = subtotal >= 39 ? subtotal : subtotal + 4.9;
    try {
      let order: OrderRecord;
      if (mode === "live" && config && user.session) { const created = await createOrder(config, user.session, { customerEmail: user.email, totalAmount: total, items: cart.map((line) => ({ productId: line.product.id, productName: line.product.name, quantity: line.quantity, unitPrice: line.product.price })) }); order = { id: created.id, status: "pending", total_amount: created.totalAmount, customer_email: user.email, created_at: new Date().toISOString(), order_items: cart.map((line) => ({ product_id: line.product.id, product_name: line.product.name, quantity: line.quantity, unit_price: line.product.price })) }; }
      else order = { id: `JOL-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`, status: "pending", total_amount: total, customer_email: user.email, created_at: new Date().toISOString(), order_items: cart.map((line) => ({ product_id: line.product.id, product_name: line.product.name, quantity: line.quantity, unit_price: line.product.price })) };
      setOrders((current) => [order, ...current]); setCart([]); setCartOpen(false); setSuccessOrder(order);
    } catch (error) { notify(error instanceof Error ? "Ordine non inviato: controlla la configurazione Supabase." : "Ordine non inviato."); } finally { setLoading(false); }
  }
  function openAdmin() {
    if (!user) { setAuthOpen(true); notify("Accedi per entrare nell’area staff."); return; }
    if (user.isDemo) { setUser({ ...user, role: "staff", fullName: "Jolly Team" }); setAuthOpen(false); setView("admin"); return; }
    if (user.role !== "staff") { notify("Quest’area è riservata allo staff Jolly."); return; }
    setAuthOpen(false); setView("admin");
    if (config && user.session) Promise.all([getAdminProducts<Record<string, unknown>>(config, user.session), getAdminOrders<Record<string, unknown>>(config, user.session)]).then(([productRows, orderRows]) => { setProducts(productRows.map((row) => productFromRow(row))); setOrders(orderRows.map((row) => orderFromRow(row))); }).catch(() => notify("Non riesco a caricare i dati staff."));
  }
  if (!authReady) return <AccessLoading />;
  if (!user) return <AccessGate mode={mode} onUser={setUser} />;
  if (view === "admin") return <AdminDashboard user={user} products={products} orders={orders} live={mode === "live"} config={config} onBack={() => setView("shop")} onProducts={setProducts} onOrders={setOrders} onToast={notify} />;

  return <main className="jolly-site"><div className="ambient-orb ambient-orb-one" /><div className="ambient-orb ambient-orb-two" /><header className="site-header"><div className="header-brand"><button className="brand-lockup" onClick={() => { setView("shop"); window.scrollTo({ top: 0, behavior: "smooth" }); }}><span className="brand-mark">J</span><span><strong>Jolly</strong><small>dolciumi</small></span></button><nav className={`main-nav ${mobileMenu ? "main-nav-open" : ""}`}><button onClick={() => { document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" }); setMobileMenu(false); }}>Catalogo</button><button onClick={() => { document.getElementById("rituale")?.scrollIntoView({ behavior: "smooth" }); setMobileMenu(false); }}>Il nostro rituale</button><button onClick={() => { setAuthOpen(true); setMobileMenu(false); }}>Jolly Club</button></nav></div><div className="header-actions"><button className="header-search"><Search size={17} /><input aria-label="Cerca nel catalogo" value={search} onChange={(event) => { setSearch(event.target.value); document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" }); }} placeholder="Cerca una dolcezza…" /></button><button className="header-account" onClick={() => setAuthOpen(true)}><CircleUserRound size={19} /><span>{user ? user.fullName.split(" ")[0] : "Accedi"}</span></button><button className="header-cart" onClick={() => setCartOpen(true)} aria-label="Apri carrello"><ShoppingBag size={20} />{cartQuantity ? <span>{cartQuantity}</span> : null}</button><button className="mobile-menu-button" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Apri menu">{mobileMenu ? <X size={21} /> : <Menu size={21} />}</button></div></header><section className="hero-section"><div className="hero-backdrop" /><div className="hero-copy"><span className="eyebrow eyebrow-light"><span className="eyebrow-spark">✦</span> Dal 1998, un mondo più dolce</span><h1>Il bello della vita è <em>scegliere dolce.</em></h1><p>Caramelle, cioccolato e sorprese da condividere. Entra nella vetrina Jolly e trova il tuo prossimo piccolo momento felice.</p><div className="hero-actions"><button className="jolly-button jolly-button-light" onClick={() => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" })}>Scopri il catalogo <ArrowUpRight size={17} /></button><button className="hero-text-link" onClick={() => document.getElementById("rituale")?.scrollIntoView({ behavior: "smooth" })}>Perché Jolly <ArrowRight size={15} /></button></div><div className="hero-proof"><div className="proof-avatars"><span>🍓</span><span>🍫</span><span>🍭</span></div><span><strong>+2.000</strong> dolcezze già spedite</span></div></div>{featuredProduct ? <button className="hero-featured-card" onClick={() => setSelectedProduct(featuredProduct)}><div className="hero-featured-art"><ProductArt product={featuredProduct} large /></div><div className="hero-featured-copy"><span className="eyebrow eyebrow-light">Preferito Jolly</span><strong>{featuredProduct.name}</strong><span>{money(featuredProduct.price)} <ArrowUpRight size={14} /></span></div></button> : null}<div className="hero-scroll-cue"><span>Scorri per assaggiare</span><ChevronDown size={16} /></div></section><FeatureStrip /><section className="catalog-section" id="catalogo"><div className="section-heading"><div><span className="eyebrow">La selezione Jolly</span><h2>Trova il tuo <em>preferito.</em></h2><p>Un catalogo fatto per seguire l’umore: dolce, croccante, acidulo o tutto insieme.</p></div><div className="catalog-heading-side"><span>{filteredProducts.length} prodotti</span><span className="live-dot"><i /> {mode === "live" ? "catalogo live" : "catalogo demo"}</span></div></div><div className="catalog-toolbar"><Tabs value={category} onValueChange={setCategory}><TabsList className="category-tabs">{CATEGORIES.map((item) => <TabsTrigger key={item} value={item}>{item}</TabsTrigger>)}</TabsList></Tabs><div className="catalog-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cerca nel catalogo" /></div></div>{loading && mode === "live" ? <div className="catalog-loading"><span className="loading-pulse" /> Stiamo preparando la vetrina…</div> : null}<div className="product-grid">{filteredProducts.map((product, index) => <ProductCard key={product.id} product={product} index={index} onOpen={setSelectedProduct} onAdd={addToCart} />)}</div>{!filteredProducts.length ? <div className="catalog-empty"><Sparkles size={22} /><strong>Nessuna dolcezza trovata.</strong><span>Prova una ricerca diversa.</span></div> : null}<div className="catalog-footer-link"><button onClick={() => { setCategory("Tutto"); setSearch(""); }}>Vedi tutta la selezione <ArrowRight size={16} /></button></div></section><section className="ritual-section" id="rituale"><div className="ritual-photo"><img src="/candy-hero.png" alt="Assortimento di dolciumi Jolly" /><div className="ritual-photo-caption"><Sparkles size={15} /><span>Ogni ordine ha il suo momento.</span></div></div><div className="ritual-copy"><span className="eyebrow">Il rituale Jolly</span><h2>Non vendiamo solo dolci. <em>Creiamo pause.</em></h2><p>Una scatola aperta sul tavolo, il rumore della carta, il primo assaggio. Abbiamo costruito Jolly per rendere semplice regalarsi qualcosa di bello — anche senza aspettare un’occasione.</p><div className="ritual-points"><div><span>01</span><strong>Scegli</strong><p>Segui la voglia del momento.</p></div><div><span>02</span><strong>Componi</strong><p>Crea il tuo mix personale.</p></div><div><span>03</span><strong>Condividi</strong><p>Fai arrivare la sorpresa.</p></div></div><button className="text-arrow-button" onClick={() => setAuthOpen(true)}>Entra nel Jolly Club <ArrowUpRight size={16} /></button></div></section><section className="newsletter-section"><div><span className="eyebrow eyebrow-light">Una dose di buonumore</span><h2>Le novità più dolci,<br /><em>una volta al mese.</em></h2></div><div className="newsletter-form"><p>Nuovi arrivi, box stagionali e qualche sorpresa riservata agli iscritti.</p><div><input type="email" placeholder="La tua email" aria-label="La tua email" /><button className="jolly-button jolly-button-light">Iscrivimi <ArrowUpRight size={16} /></button></div><small>Niente spam. Solo cose buone.</small></div></section><footer className="site-footer"><div className="footer-brand"><span className="brand-mark">J</span><div><strong>Jolly</strong><span>dolciumi</span></div><p>Piccoli momenti, grandi sorrisi.</p></div><div className="footer-links"><div><span>Esplora</span><button onClick={() => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" })}>Catalogo</button><button onClick={() => document.getElementById("rituale")?.scrollIntoView({ behavior: "smooth" })}>Il rituale</button></div><div><span>Aiuto</span><button onClick={() => setAuthOpen(true)}>Jolly Club</button><button onClick={() => setCartOpen(true)}>Il tuo carrello</button></div><div><span>Staff</span><button onClick={openAdmin}>Area riservata</button><button onClick={() => notify("Presto potrai contattarci anche da qui.")}>Contatti</button></div></div><div className="footer-bottom"><span>© 2026 Jolly Dolciumi</span><span>Fatto con <span className="footer-heart">♥</span> e tanto zucchero</span></div></footer><CartSheet open={cartOpen} onOpenChange={setCartOpen} cart={cart} onChangeQuantity={changeQuantity} onRemove={removeFromCart} onCheckout={checkout} user={user} /><AuthDialog open={authOpen} onOpenChange={setAuthOpen} user={user} onUser={setUser} onLogout={() => { setUser(null); setOrders([]); setAuthOpen(false); }} onOpenAdmin={openAdmin} orders={orders} mode={mode} /><ProductDialog product={selectedProduct} onClose={() => setSelectedProduct(null)} onAdd={addToCart} /><Dialog open={Boolean(successOrder)} onOpenChange={(open) => !open && setSuccessOrder(null)}><DialogContent className="success-dialog"><div className="success-icon"><Check size={27} /></div><DialogHeader><DialogTitle>Ordine ricevuto. Che bontà.</DialogTitle><DialogDescription>Abbiamo preso in carico il tuo ordine <strong>{successOrder?.id}</strong>. Ti aggiorneremo appena sarà pronto a partire.</DialogDescription></DialogHeader><div className="success-order-total"><span>Totale ordine</span><strong>{successOrder ? money(successOrder.total_amount) : ""}</strong></div><DialogFooter><Button className="jolly-button jolly-button-wide" onClick={() => setSuccessOrder(null)}>Continua a esplorare <ArrowRight size={16} /></Button></DialogFooter></DialogContent></Dialog>{toast ? <div className="jolly-toast" role="status"><span><Check size={14} /></span>{toast}<button onClick={() => setToast("")} aria-label="Chiudi"><X size={14} /></button></div> : null}</main>;
}
