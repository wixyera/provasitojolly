"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Heart, LogOut, Pause, Play, Settings2, ShoppingBag, UserRound } from "lucide-react";
import { InstallApp } from "./install";
import { Brand, CategoryIcon } from "./shared";
import type { Profile } from "@/lib/shop";

const sectors = [
  { name: "Dolci & caramelle", category: "Caramelle", note: "Un mondo da scartare", image: "/assortment.png", color: "pink" },
  { name: "Snack & patatine", category: "Snack e patatine", note: "La pausa si fa croccante", image: "/assortment.png", color: "yellow" },
  { name: "Cioccolato", category: "Cioccolato", note: "Il tuo piccolo grande piacere", image: "/chocolate.png", color: "brown" },
  { name: "Bibite", category: "Bibite", note: "Una ventata di freschezza", image: "/assortment.png", color: "blue" },
  { name: "Gelati & granite", category: "Gelati e granite", note: "Il lato fresco di Jolly", image: "/equipment.png", color: "mint" },
  { name: "Attrezzature", category: "Attrezzature", note: "Grandi idee per la tua attività", image: "/equipment.png", color: "lilac" },
];
export function WelcomeHub({ profile, count, favorites, isStaff, onGo, onLogout, error, loading, onRetry }: {
  profile: Profile; count: number; favorites: number; isStaff: boolean;
  onGo: (view: "shop" | "wishlist" | "account" | "staff", category?: string) => void;
  onLogout: () => void; error?: string; loading?: boolean; onRetry?: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    if (!preference.matches) void el.play().catch(() => {});
    const changed = () => { if (preference.matches) el.pause(); };
    preference.addEventListener("change", changed);
    return () => preference.removeEventListener("change", changed);
  }, []);
  return <main className="jolly-world">
    <header className="world-header"><Brand/><nav aria-label="Il tuo spazio"><button onClick={() => onGo("wishlist")}><Heart size={19}/><span>Preferiti {favorites || ""}</span></button><button onClick={() => onGo("account")}><UserRound size={19}/><span>{profile.full_name?.split(" ")[0] || "Account"}</span></button><button onClick={onLogout}><LogOut size={19}/><span>Esci</span></button></nav></header>
    <section className="world-stage">
      <div className="world-stage-copy"><span className="world-kicker">BENVENUTO NEL MONDO JOLLY</span><h1>Tutto il buono.<br/><em>Tutto un mondo.</em></h1><p>Dolce, salato, fresco. E tutto quello che serve per creare qualcosa di speciale.</p><button className="world-cta" onClick={() => onGo("shop", "Tutto")}>Scopri l’assortimento <ArrowUpRight size={24}/></button><a className="world-explore" href="#settori">Oppure scegli il tuo settore ↓</a></div>
      <div className="world-film"><video ref={video} src="/jolly-intro-v6.mp4" poster="/assortment.png" muted loop playsInline preload="auto" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => setFailed(true)} aria-label="Animazione introduttiva dell’assortimento Jolly"/><span className="world-film-caption">LA TUA PROSSIMA PAUSA INIZIA QUI.</span><button className="world-play" disabled={failed} onClick={() => { const el = video.current; if (el) { if (el.paused) void el.play().catch(() => setFailed(true)); else el.pause(); } }} aria-label={playing ? "Metti in pausa il video" : "Riproduci il video"}>{playing ? <Pause size={18}/> : <Play size={18}/>}<span>{failed ? "Anteprima" : playing ? "Pausa" : "Riproduci"}</span></button></div>
    </section>
    <div className="world-ribbon" aria-hidden="true"><span>DOLCE.</span><span>SALATO.</span><span>FRESCO.</span><span>PROFESSIONALE.</span><span>SEMPRE JOLLY.</span></div>
    {error && <div className="world-error" role="alert"><p>{error}</p><button onClick={onRetry} disabled={loading}>Riprova a caricare il catalogo</button></div>}
    <section className="world-sectors" id="settori"><div className="world-section-heading"><div><span className="world-kicker">SEGUI IL TUO GUSTO</span><h2>Da dove cominciamo?</h2></div><button onClick={() => onGo("shop", "Tutto")}>Tutti i prodotti <ArrowUpRight size={19}/></button></div><div className="world-sector-grid">{sectors.map((s, i) => <button key={s.category} className={`world-sector sector-${s.color}`} onClick={() => onGo("shop", s.category)}><div className="world-sector-top"><span>0{i + 1}</span><CategoryIcon category={s.category} size={25}/></div><div className="world-sector-photo"><img src={s.image} alt="" loading="lazy"/></div><div className="world-sector-bottom"><span><strong>{s.name}</strong><small>{s.note}</small></span><ArrowUpRight size={24}/></div></button>)}</div></section>
    <section className="world-shortcuts" aria-label="Accessi rapidi"><button onClick={() => onGo("account")}><ShoppingBag/><span><strong>I tuoi ordini</strong><small>Segui e riordina le tue selezioni · {count} articoli nel carrello</small></span><ArrowUpRight/></button>{isStaff && <button onClick={() => onGo("staff")}><Settings2/><span><strong>La tua area staff</strong><small>Prodotti, magazzino, QR, utenti e ordini</small></span><ArrowUpRight/></button>}</section>
    <div className="page-wrap" style={{paddingBottom:24}}><InstallApp/></div><footer className="world-footer"><Brand small/><span>Dolce. Salato. Jolly.</span><span>Edizione 07 · <a href="/privacy">Privacy</a> · <a href="/termini">Condizioni</a></span></footer>
  </main>;
}
