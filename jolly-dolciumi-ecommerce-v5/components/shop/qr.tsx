"use client";
import { Printer, QrCode, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Product } from "@/lib/shop";

export function ProductQr({ product, onClose }: { product: Product; onClose: () => void }) {
  const link = typeof window === "undefined" ? `/?product=${encodeURIComponent(product.slug)}` : `${window.location.origin}/?product=${encodeURIComponent(product.slug)}`;
  const image = `https://api.qrserver.com/v1/create-qr-code/?size=900x900&margin=18&data=${encodeURIComponent(link)}`;
  return <div className="qr-overlay" role="dialog" aria-modal="true" aria-label={`QR code ${product.name}`}><div className="qr-card"><button className="icon-btn qr-close" onClick={onClose} aria-label="Chiudi"><X/></button><span className="eyebrow"><QrCode size={16}/> ETICHETTA MAGAZZINO</span><h2>{product.name}</h2><p>Scansiona per aprire la scheda prodotto.</p><img className="qr-image" src={image} alt={`QR code per ${product.name}`}/><small>{link}</small><div className="qr-actions"><a className="btn btn-outline" href={image} target="_blank" rel="noreferrer">Scarica QR</a><Button className="btn" onClick={()=>window.print()}><Printer size={17}/> Stampa</Button></div></div></div>;
}
