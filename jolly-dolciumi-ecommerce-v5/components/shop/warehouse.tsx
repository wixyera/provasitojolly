"use client";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Camera, ClipboardList, Minus, PackagePlus, Plus, ScanLine, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption as Option } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { InventoryMovement, Product } from "@/lib/shop";
import { date } from "@/lib/shop";
import { ShopApi, errorMessage } from "@/lib/supabase";
import { ProductImage } from "./shared";

type Detector = { detect(source: HTMLVideoElement): Promise<Array<{ rawValue?: string }>> };
type DetectorConstructor = new (options?: { formats?: string[] }) => Detector;

function findProduct(value: string, products: Product[]) {
  const raw = value.trim();
  try {
    const url = new URL(raw, window.location.origin);
    const slug = url.searchParams.get("product");
    if (slug) return products.find(p => p.slug === slug);
  } catch { /* The code can be a plain SKU. */ }
  return products.find(p => p.id === raw || p.slug === raw || p.sku?.toLowerCase() === raw.toLowerCase());
}

export function Warehouse({ api, products, onRefresh }: { api: ShopApi; products: Product[]; onRefresh: () => Promise<void> }) {
  const [selected, setSelected] = useState("");
  const [delta, setDelta] = useState("1");
  const [reason, setReason] = useState("receive");
  const [note, setNote] = useState("");
  const [code, setCode] = useState("");
  const [search, setSearch] = useState("");
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [busy, setBusy] = useState(false);
  const [scanner, setScanner] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);

  async function loadMovements() {
    try { setMovements(await api.movements()); } catch (e) { toast.error(errorMessage(e)); }
  }
  // Loading persisted movements is an external synchronization with Supabase.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadMovements(); }, [api]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!scanner) return;
    let stream: MediaStream | undefined;
    let frame = 0;
    let cancelled = false;
    const start = async () => {
      setScanMessage("");
      const DetectorClass = (window as unknown as { BarcodeDetector?: DetectorConstructor }).BarcodeDetector;
      if (!DetectorClass) { setScanMessage("Questo browser non supporta la scansione automatica. Inserisci il codice sotto al video."); return; }
      if (!navigator.mediaDevices?.getUserMedia) { setScanMessage("La fotocamera non è disponibile. Inserisci il codice manualmente."); return; }
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      if (cancelled || !videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      const detector = new DetectorClass({ formats: ["qr_code"] });
      const scan = async () => {
        if (cancelled || !videoRef.current) return;
        try {
          const result = await detector.detect(videoRef.current);
          const raw = result.find(x => x.rawValue)?.rawValue;
          if (raw) {
            const product = findProduct(raw, products);
            if (product) { setSelected(product.id); setCode(raw); setScanner(false); toast.success(`${product.name} selezionato`); return; }
            setScanMessage("QR riconosciuto, ma non corrisponde a un prodotto Jolly.");
          }
        } catch { /* La fotocamera può restituire frame non leggibili. */ }
        frame = requestAnimationFrame(scan);
      };
      frame = requestAnimationFrame(scan);
    };
    start().catch(e => setScanMessage(errorMessage(e)));
    return () => { cancelled = true; cancelAnimationFrame(frame); stream?.getTracks().forEach(track => track.stop()); };
  }, [scanner, products]);

  const visible = products.filter(p => `${p.name} ${p.sku || ""} ${p.warehouse_location || ""}`.toLowerCase().includes(search.toLowerCase()));
  const low = visible.filter(p => p.is_active && p.purchase_mode !== "quote" && p.stock <= Number(p.low_stock_threshold ?? 5));
  const product = products.find(p => p.id === selected);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const amount = Number(delta);
    if (!selected || !Number.isInteger(amount) || amount === 0) { toast.error("Scegli un prodotto e una quantità valida."); return; }
    setBusy(true);
    try { await api.adjustStock(selected, amount, reason, note); await Promise.all([onRefresh(), loadMovements()]); toast.success(`Giacenza aggiornata: ${amount > 0 ? "+" : ""}${amount}`); setNote(""); }
    catch (e) { toast.error(errorMessage(e)); }
    finally { setBusy(false); }
  }
  function manualCode(e: React.FormEvent) {
    e.preventDefault();
    const found = findProduct(code, products);
    if (!found) { toast.error("Nessun prodotto trovato con questo codice."); return; }
    setSelected(found.id); toast.success(`${found.name} selezionato`);
  }
  return <section className="warehouse-page">
    <div className="warehouse-intro"><div><span className="eyebrow">MAGAZZINO JOLLY</span><h2>Giacenze sotto controllo.</h2><p>Scansiona un QR, registra un movimento e tieni aggiornato il catalogo in tempo reale.</p></div><Button className="btn btn-outline" onClick={() => setScanner(true)}><ScanLine size={17}/> Scansiona QR</Button></div>
    <div className="warehouse-grid">
      <form className="panel form-stack" onSubmit={submit}><div className="section-title"><h2>Movimento manuale</h2><PackagePlus size={20}/></div><label className="search-field warehouse-search"><Search size={17}/><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filtra prodotti…"/></label><label className="field"><span>Prodotto</span><NativeSelect value={selected} onChange={e => setSelected(e.target.value)}><Option value="">Scegli un prodotto</Option>{visible.map(p => <Option key={p.id} value={p.id}>{p.name} · {p.stock} pz</Option>)}</NativeSelect></label><div className="stock-adjust"><button type="button" className="icon-btn" aria-label="Diminuisci quantità" onClick={() => setDelta(String(Math.max(-999999, Number(delta || 0) - 1)))}><Minus size={17}/></button><Input type="number" step={1} value={delta} onChange={e => setDelta(e.target.value)} aria-label="Quantità movimento"/><button type="button" className="icon-btn" aria-label="Aumenta quantità" onClick={() => setDelta(String(Number(delta || 0) + 1))}><Plus size={17}/></button></div><FieldLike label="Tipo movimento"><NativeSelect value={reason} onChange={e => setReason(e.target.value)}><Option value="receive">Carico merce</Option><Option value="correction">Correzione inventario</Option><Option value="damage">Danneggiato / perso</Option><Option value="return">Reso rientrato</Option><Option value="sale_adjustment">Rettifica vendita</Option></NativeSelect></FieldLike><FieldLike label="Nota"><Input value={note} maxLength={500} onChange={e => setNote(e.target.value)} placeholder="Es. consegna fornitore n. 18"/></FieldLike>{product&&<div className="warehouse-selected"><ProductImage product={product}/><span><b>{product.name}</b><small>{product.warehouse_location || "Posizione non impostata"} · {product.stock} pezzi disponibili</small></span></div>}<Button className="btn" disabled={busy||!selected}>{busy ? "Aggiornamento…" : "Registra movimento"}<ArrowUpFromLine size={17}/></Button></form>
      <div className="panel warehouse-low"><div className="section-title"><h2>Da rifornire</h2><span className="count-pill">{low.length}</span></div>{low.length ? <div className="warehouse-list">{low.map(p => <button key={p.id} className="activity-row" onClick={() => setSelected(p.id)}><span><b>{p.name}</b><small>{p.warehouse_location || "Posizione non impostata"}</small></span><strong className="stock-warning">{p.stock} / {p.low_stock_threshold ?? 5}</strong></button>)}</div> : <p className="muted">Nessun prodotto sotto la soglia configurata.</p>}<form className="manual-code" onSubmit={manualCode}><Input value={code} onChange={e => setCode(e.target.value)} placeholder="SKU o link del QR"/><Button className="btn btn-outline">Apri codice</Button></form></div>
    </div>
    <section className="panel movement-panel"><div className="section-title"><h2>Ultimi movimenti</h2><ClipboardList size={20}/></div>{movements.length ? <div className="movement-list">{movements.slice(0,20).map(m => <div className="movement-row" key={m.id}><span className={m.delta > 0 ? "movement-in" : "movement-out"}>{m.delta > 0 ? <ArrowDownToLine size={16}/> : <ArrowUpFromLine size={16}/>} {m.delta > 0 ? "+" : ""}{m.delta}</span><span><b>{m.product_name || (m as InventoryMovement & { products?: { name?: string } }).products?.name || "Prodotto"}</b><small>{m.reason} · {m.note || "Nessuna nota"}</small></span><time>{date(m.created_at)}</time></div>)}</div> : <p className="muted">I movimenti registrati appariranno qui.</p>}</section>
    <Dialog open={scanner} onOpenChange={setScanner}><DialogContent className="modal scanner-modal"><button className="icon-btn qr-close" onClick={() => setScanner(false)} aria-label="Chiudi"><X/></button><span className="eyebrow"><Camera size={16}/> SCANSIONE MAGAZZINO</span><DialogTitle>Inquadra il QR del prodotto</DialogTitle><DialogDescription>Usa il QR stampato per selezionare subito l’articolo.</DialogDescription><div className="scanner-frame"><video ref={videoRef} muted playsInline/><span className="scanner-corners"/></div>{scanMessage&&<p className="notice">{scanMessage}</p>}<form className="manual-code" onSubmit={manualCode}><Input value={code} onChange={e => setCode(e.target.value)} placeholder="Oppure inserisci SKU o link"/><Button className="btn">Seleziona</Button></form></DialogContent></Dialog>
  </section>;
}

function FieldLike({ label, children }: { label: string; children: ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }
