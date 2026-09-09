"use client";
import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, ShieldCheck, Sparkles, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Brand, Field } from "./shared";
import { ShopApi, errorMessage } from "@/lib/supabase";
import type { Profile } from "@/lib/shop";

export function Auth({ api, onUser, initialError = "" }: { api: ShopApi | null; onUser: (p: Profile) => void; initialError?: string }) {
  const [mode,setMode] = useState<"login"|"signup"|"reset">("login");
  const [email,setEmail] = useState(""); const [password,setPassword] = useState(""); const [name,setName] = useState("");
  const [busy,setBusy] = useState(false); const [message,setMessage] = useState(initialError); const [success,setSuccess] = useState(false); const [show,setShow] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); if (!api) return; setBusy(true); setMessage(""); setSuccess(false);
    try {
      if (mode === "reset") { await api.reset(email); setSuccess(true); setMessage("Se l’indirizzo è registrato, riceverai un’email per scegliere una nuova password."); }
      else { const p = mode === "signup" ? await api.signUp(email,password,name) : await api.signIn(email,password); if(p) onUser(p); else { setSuccess(true); setMessage("Controlla la tua email e conferma l’account. Poi potrai accedere."); } }
    } catch(e) { setMessage(errorMessage(e)); } finally { setBusy(false); }
  }
  return <main className="auth-page"><section className="auth-story"><Brand /><div className="auth-story-copy"><span className="eyebrow"><Sparkles size={16} /> BENVENUTO NEL MONDO JOLLY</span><h1>Tutto il buono.<br /><em>In un solo posto.</em></h1><p>Dalle caramelle alle patatine, dalle bibite alle attrezzature per gelati e granite. Il tuo prossimo assortimento comincia qui.</p><div className="auth-category-list"><span>Dolci & cioccolato</span><span>Snack & bibite</span><span>Gelati & attrezzature</span></div></div><div className="auth-photo"><img src="/assortment.png" alt="Assortimento illustrativo di snack, dolci e bibite" /><span className="image-caption">Una pausa, mille possibilità.</span></div><div className="auth-footnote">IL LATO BUONO DELLA TUA GIORNATA.</div></section>
    <section className="auth-panel"><div className="auth-mobile-brand"><Brand /></div><div className="auth-form-wrap"><span className="pill"><ShieldCheck size={16} /> Catalogo riservato</span><h2>{mode === "login" ? "Ciao, bentornato." : mode === "signup" ? "Piacere, Jolly." : "Ripartiamo da qui."}</h2><p className="muted">{mode === "login" ? "Accedi al tuo account per scoprire il catalogo e fare il tuo ordine." : mode === "signup" ? "Crea il tuo account cliente e trova il tuo prossimo assortimento." : "Ti invieremo un link per scegliere una nuova password."}</p>
      {!api ? <div className="notice error" role="alert">Configurazione Supabase mancante. Verifica il file public/config.js.</div> : <form onSubmit={submit} className="form-stack">
        {mode === "signup" && <Field label="Nome e cognome"><Input autoComplete="name" value={name} onChange={e => setName(e.target.value)} minLength={2} maxLength={120} required placeholder="Il tuo nome" /></Field>}
        <Field label="Indirizzo email"><Input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} placeholder="nome@esempio.it" /></Field>
        {mode !== "reset" && <Field label="Password"><div className="password-wrap"><Input type={show ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)} required minLength={mode === "signup" ? 10 : 1} maxLength={128} placeholder={mode === "signup" ? "Almeno 10 caratteri" : "La tua password"} /><button type="button" onClick={() => setShow(!show)} aria-label={show ? "Nascondi password" : "Mostra password"}>{show ? <EyeOff size={19} /> : <Eye size={19} />}</button></div></Field>}
        {mode === "login" && <button className="text-button auth-forgot" type="button" onClick={() => {setMode("reset");setMessage("");}}>Password dimenticata?</button>}
        {message && <p className={`notice ${success ? "success" : "error"}`} role={success ? "status" : "alert"}>{message}</p>}
        <Button type="submit" className="btn full btn-lg" disabled={busy}>{busy ? "Un momento…" : mode === "login" ? "Accedi al catalogo" : mode === "signup" ? "Crea il tuo account" : "Invia il link"}<ArrowRight size={18} /></Button>
      </form>}
      <div className="auth-switch">{mode === "login" ? "È la tua prima volta qui?" : "Hai già un account?"} <button onClick={() => {setMode(mode === "login" ? "signup" : "login");setMessage("");setSuccess(false);}}>{mode === "login" ? "Registrati" : "Accedi"}</button></div><p className="auth-disclaimer"><KeyRound size={16} /> Lo stesso accesso per clienti e staff.<br />Le funzioni disponibili dipendono dal tuo ruolo.</p>
    </div></section></main>;
}
export function PasswordSetup({ api, onDone }: { api: ShopApi; onDone: () => void }) {
  const [password,setPassword] = useState(""); const [again,setAgain] = useState(""); const [busy,setBusy] = useState(false); const [error,setError] = useState("");
  return <main className="password-page"><Brand /><form className="panel form-stack" onSubmit={async e => {e.preventDefault();if(password!==again){setError("Le password non coincidono.");return;}setBusy(true);try{await api.password(password);onDone();}catch(e){setError(errorMessage(e));}finally{setBusy(false);}}}><span className="pill"><KeyRound size={16} /> Accesso personale</span><h1>Scegli la tua password</h1><Field label="Nuova password"><Input type="password" autoComplete="new-password" minLength={10} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} required /></Field><Field label="Ripeti password"><Input type="password" autoComplete="new-password" value={again} onChange={e=>setAgain(e.target.value)} required /></Field>{error&&<p className="notice error" role="alert">{error}</p>}<Button className="btn" disabled={busy}>Salva e accedi <ArrowRight size={18}/></Button></form></main>;
}
