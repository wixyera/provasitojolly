"use client";
import { useState, type ReactNode } from "react";
import { Bell, Candy, Cookie, GlassWater, IceCreamBowl, Package, Gift, Minus, Plus, Heart, ShoppingBag, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { bundleLabel, type Product, money, productImage, quantityDiscountLabel } from "@/lib/shop";

export function Brand({ small = false }: { small?: boolean }) { return <span className={`brand ${small ? "brand-small" : ""}`}><img className="brand-logo" src="/jolly-logo.svg" alt=""/><span className="brand-name"><strong>Jolly</strong><small>DOLCIUMI & MOLTO ALTRO</small></span></span>; }
export function CategoryIcon({ category, size = 22 }: { category: string; size?: number }) {
  const Icon = /bibit/i.test(category) ? GlassWater : /snack|patatin|cioccol/i.test(category) ? Cookie : /gelat|granit/i.test(category) ? IceCreamBowl : /attrezz/i.test(category) ? Package : /regal|box/i.test(category) ? Gift : Candy;
  return <Icon size={size} aria-hidden="true" />;
}
export function ProductImage({ product, className = "" }: { product: Product; className?: string }) {
  const [failed, setFailed] = useState(false);
  const src = productImage(product);
  return <div className={`product-image ${className}`}>
    {src && !failed ? <img src={src} alt={product.name} loading="lazy" onError={() => setFailed(true)} /> : <div className="image-missing"><CategoryIcon category={product.category} size={48} /><span>{product.category}</span><small>Foto in arrivo</small></div>}
  </div>;
}
export function Quantity({ value, max, min = 1, onChange, disabled = false, label = "Quantità" }: { value: number; max: number; min?: number; onChange: (n: number) => void; disabled?: boolean; label?: string }) {
  const limit = Math.max(min, Math.min(99, max));
  return <div className="quantity" role="group" aria-label={label}>
    <button type="button" disabled={disabled || value <= min} aria-label={`Diminuisci ${label.toLowerCase()}`} onClick={() => onChange(Math.max(min, Math.min(limit, value - 1)))}><Minus size={15} /></button>
    <input aria-label={label} inputMode="numeric" type="number" min={min} max={limit} step={1} value={value} disabled={disabled} onChange={e => { const n = Number(e.target.value); if (Number.isFinite(n)) onChange(Math.min(limit, Math.max(min, Math.floor(n)))); }} />
    <button type="button" disabled={disabled || value >= limit || max < min} aria-label={`Aumenta ${label.toLowerCase()}`} onClick={() => onChange(value + 1)}><Plus size={15} /></button>
  </div>;
}
export function Empty({ icon, title, description, action }: { icon?: ReactNode; title: string; description: string; action?: ReactNode }) { return <div className="empty-state"><div className="empty-icon">{icon || <ShoppingBag size={32} />}</div><h3>{title}</h3><p>{description}</p>{action}</div>; }
export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) { return <label className={`field ${className}`}><span>{label}</span>{children}</label>; }
export function ProductCard({ product: p, inCart, favorite, busy, onOpen, onAdd, onFavorite, onNotify }: { product: Product; inCart: number; favorite: boolean; busy: boolean; onOpen: () => void; onAdd: (quantity: number) => void; onFavorite: () => void; onNotify: () => void }) {
  const [q, setQ] = useState(1);
  const available = Math.max(0, Math.min((p.available_stock??p.stock) - inCart, 99 - inCart));
  const quantity = Math.min(q, Math.max(1, available));
  const quote = p.purchase_mode === "quote";
  const saving = p.compare_at_price && p.compare_at_price > p.price ? Math.round((1 - p.price / p.compare_at_price) * 100) : 0;
  return <article className="product-card">
    <div className="card-picture"><button className="picture-open" onClick={onOpen} aria-label={`Vedi ${p.name}`}><ProductImage product={p} /></button>
      {(saving > 0 && !quote) || p.badge ? <span className={`badge ${saving > 0 ? "badge-sale" : ""}`}>{saving > 0 && !quote ? `−${saving}%` : p.badge}</span> : null}
      <button className={`favorite ${favorite ? "is-favorite" : ""}`} onClick={onFavorite} aria-pressed={favorite} aria-label={`${favorite ? "Rimuovi" : "Salva"} ${p.name} nei preferiti`}><Heart size={19} fill={favorite ? "currentColor" : "none"} /></button>
    </div>
    <div className="card-copy"><p className="product-category">{p.category}{p.weight_label ? ` · ${p.weight_label}` : ""}</p><button className="product-title" onClick={onOpen}><h3>{p.name}</h3></button><p className="product-excerpt">{p.description}</p>
      <div className="price-line">{quote ? <strong className="quote-price">Su preventivo</strong> : <><strong>{money(Number(p.price))}</strong>{saving > 0 && <del>{money(Number(p.compare_at_price))}</del>}</>}</div>{!quote&&quantityDiscountLabel(p)&&<small className="quantity-deal">Più ne prendi, più risparmi · {quantityDiscountLabel(p)}</small>}{bundleLabel(p)&&<small className="bundle-label">Kit · {bundleLabel(p)}</small>}
      <p className={`stock ${!quote && available === 0 ? "stock-empty" : ""}`}>{quote ? "Soluzioni per la tua attività" : (p.available_stock??p.stock) === 0 ? "Momentaneamente esaurito" : inCart > 0 ? `${inCart} nel carrello · ${available} ancora disponibili` : p.stock < 6 ? `Ultimi ${p.stock} pezzi disponibili` : `${p.stock} pezzi disponibili`}</p>
      <div className="card-actions">{quote ? <Button className="btn btn-outline full" onClick={onOpen}>Richiedi informazioni <ArrowUpRight size={17} /></Button> : (p.available_stock??p.stock)===0 ? <Button className="btn btn-outline full" onClick={onNotify}><Bell size={17}/> Avvisami quando torna</Button> : <><Quantity value={quantity} max={available} disabled={busy || available === 0} onChange={setQ} label={`Quantità ${p.name}`} /><Button className="btn card-add" disabled={busy || available === 0} onClick={() => onAdd(quantity)} aria-label={`Aggiungi ${quantity} ${p.name} al carrello`}><Plus size={18} /><span>Aggiungi</span></Button></>}</div>
    </div>
  </article>;
}
export function ProductModal({ product: p, inCart, busy, onClose, onAdd, onNotify, onQuote }: { product: Product; inCart: number; busy: boolean; onClose: () => void; onAdd: (q: number) => void; onNotify: () => void; onQuote: (message: string, phone: string) => Promise<void> }) {
  const [q, setQ] = useState(1); const [message, setMessage] = useState(""); const [phone, setPhone] = useState(""); const [sending, setSending] = useState(false);
  const available = Math.max(0, Math.min((p.available_stock??p.stock) - inCart, 99 - inCart)); const quote = p.purchase_mode === "quote";
  return <Dialog open onOpenChange={open => !open && onClose()}><DialogContent className="product-modal modal"><div className="product-detail-image"><ProductImage product={p} /></div><div className="product-detail-copy"><span className="eyebrow">{p.category}</span><DialogTitle>{p.name}</DialogTitle><DialogDescription>{p.description}</DialogDescription>
    {p.sku && <p className="muted">Codice articolo: {p.sku}</p>}{p.weight_label && <p className="pack-label">{p.weight_label}</p>}
    {quote ? <form className="form-stack" onSubmit={async e => { e.preventDefault(); setSending(true); try { await onQuote(message, phone); } finally { setSending(false); } }}><p>Raccontaci cosa ti serve: lo staff ti ricontatterà con disponibilità e condizioni.</p><Field label="Telefono"><Input type="tel" value={phone} required minLength={6} maxLength={40} onChange={e => setPhone(e.target.value)} /></Field><Field label="La tua richiesta"><textarea value={message} required minLength={10} maxLength={2000} onChange={e => setMessage(e.target.value)} placeholder="Quantità, tipo di attività, caratteristiche che cerchi…" /></Field><Button className="btn" disabled={sending}>{sending ? "Invio…" : "Richiedi un preventivo"}<ArrowUpRight size={18} /></Button></form> : <><div className="detail-price">{money(Number(p.price))}{p.compare_at_price && p.compare_at_price > p.price ? <del>{money(Number(p.compare_at_price))}</del> : null}</div>{quantityDiscountLabel(p)&&<p className="quantity-deal">Sconti quantità: {quantityDiscountLabel(p)}</p>}<p className="stock">{(p.available_stock??p.stock) === 0 ? "Esaurito" : `${available} disponibili · ${inCart} nel carrello`}</p>{(p.available_stock??p.stock)===0?<Button className="btn btn-outline full" onClick={onNotify}><Bell size={17}/> Avvisami quando torna disponibile</Button>:<div className="detail-add"><Quantity value={Math.min(q, Math.max(1,available))} max={available} onChange={setQ} disabled={busy || available === 0} /><Button className="btn" disabled={busy || available === 0} onClick={() => onAdd(Math.min(q,available))}><ShoppingBag size={18} /> Aggiungi al carrello</Button></div>}</>}
    <details className="product-information"><summary>Dettagli e informazioni</summary>{bundleLabel(p)&&<p><strong>Contenuto del kit</strong><br/>{bundleLabel(p)}</p>}{p.ingredients && <p><strong>Ingredienti / specifiche</strong><br />{p.ingredients}</p>}{p.allergens && <p><strong>Allergeni</strong><br />{p.allergens}</p>}{!p.ingredients && !p.allergens && !bundleLabel(p) && <p>Le informazioni dettagliate non sono ancora state inserite. Per alimenti e allergeni, consulta l’etichetta o chiedi allo staff prima di ordinare.</p>}</details>
  </div></DialogContent></Dialog>;
}
