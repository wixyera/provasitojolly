"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {getConfig} from "@/lib/supabase";
export function LegalPage({kind}:{kind:"privacy"|"terms"}){
 const [text,setText]=useState("");const [company,setCompany]=useState("");const [error,setError]=useState("");
 useEffect(()=>{let active=true;const load=async()=>{const c=getConfig();if(!c)throw new Error("Configurazione non disponibile.");const r=await fetch(`${c.url}/rest/v1/legal_settings?select=*&id=eq.1`,{headers:{apikey:c.key},cache:"no-store"});if(!r.ok)throw new Error("Informazioni momentaneamente non disponibili. Contatta lo staff.");const [data]=await r.json() as Record<string,string>[];if(active){setText(data?.[kind==="privacy"?"privacy_text":"terms_text"]||"Il negozio di prova non ha ancora pubblicato questo documento. Contatta lo staff per informazioni.");setCompany([data?.business_name,data?.registered_address,data?.vat_number&&`P. IVA ${data.vat_number}`,data?.contact_email].filter(Boolean).join(" · "));}};load().catch(e=>active&&setError(e.message));return()=>{active=false;};},[kind]);
 return <main className="policy-page page-wrap"><Link href="/area-riservata" className="policy-back">← Torna a Jolly</Link><h1>{kind==="privacy"?"Informativa privacy":"Condizioni di vendita"}</h1><p>{company}</p>{error?<p role="alert">{error}</p>:<div style={{whiteSpace:"pre-wrap",lineHeight:1.8}}>{text||"Caricamento…"}</div>}</main>;
}
