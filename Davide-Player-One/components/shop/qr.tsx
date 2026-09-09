"use client";
import {useEffect,useState} from "react";
import {Printer,QrCode} from "lucide-react";
import QRCode from "qrcode";
import {Button} from "@/components/ui/button";
import {Dialog,DialogContent,DialogTitle,DialogDescription} from "@/components/ui/dialog";
import type {Product} from "@/lib/shop";
export function ProductQr({product,onClose}:{product:Product;onClose:()=>void}){
 const [image,setImage]=useState(""),[error,setError]=useState("");
 const link=typeof window==='undefined'?`/?product=${encodeURIComponent(product.slug)}`:`${window.location.origin}/?product=${encodeURIComponent(product.slug)}`;
 useEffect(()=>{let active=true;QRCode.toDataURL(link,{width:900,margin:3,errorCorrectionLevel:'M'}).then(url=>{if(active)setImage(url);}).catch(()=>{if(active)setError("Non è stato possibile generare il QR. Riapri l’etichetta.");});return()=>{active=false;};},[link]);
 return <Dialog open onOpenChange={v=>!v&&onClose()}><DialogContent className="qr-card qr-print"><span className="eyebrow"><QrCode size={16}/> ETICHETTA MAGAZZINO</span><DialogTitle>{product.name}</DialogTitle><DialogDescription>{product.sku||"Scansiona per aprire il prodotto"}{product.warehouse_location?` · ${product.warehouse_location}`:""}</DialogDescription>{image?<img className="qr-image" src={image} alt={`QR ${product.name}`}/>:<p>{error||"Generazione QR…"}</p>}<small>{link}</small><div className="qr-actions">{image&&<a className="btn btn-outline" href={image} download={`jolly-${product.slug}-qr.png`}>Scarica QR</a>}<Button className="btn" disabled={!image} onClick={()=>window.print()}><Printer size={17}/> Stampa</Button></div></DialogContent></Dialog>;
}
