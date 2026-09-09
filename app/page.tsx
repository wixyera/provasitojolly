"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ArrowDown, Gamepad2, Zap, Trophy, Footprints, Pause, Play, Menu, X, MoveUpRight } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import "./personal.css";

const worlds = [
  { id:"pokemon", number:"01", label:"POKÉMON", kicker:"L’avventura non ha età.", title:"Sempre pronto a scegliere uno starter.", text:"Un nuovo percorso, una squadra da costruire e quella voglia di vedere cosa c’è oltre la prossima palestra. Alcune passioni non si evolvono via. Si evolvono con te.", tags:["Esplorare", "Collezionare", "Evolversi"], icon:Zap, color:"#ff8b45" },
  { id:"gaming", number:"02", label:"GAMING", kicker:"Ancora una partita.", title:"Il mio tasto preferito? Play.", text:"Mondi in cui perdersi, sfide da riprovare e partite che diventano storie. Dal primo caricamento all’ultimo boss, il bello è tutto quello che succede nel mezzo.", tags:["Avventura", "Competizione", "Multiplayer"], icon:Gamepad2, color:"#bbabff" },
  { id:"calcio", number:"03", label:"SERIE A", kicker:"Novanta minuti. Mille emozioni.", title:"Il weekend ha un altro ritmo.", text:"Le rivalità, i gol all’ultimo minuto, le discussioni che continuano anche dopo il fischio finale. Il calcio è una passione che non resta dentro uno stadio.", tags:["Matchday", "Serie A", "Passione"], icon:Trophy, color:"#d1ff5b" },
  { id:"moda", number:"04", label:"STREET STYLE", kicker:"Lo stile è personale.", title:"Il dettaglio fa il look.", text:"Sneakers, forme, materiali. Mi piace la moda che racconta qualcosa, anche senza dire una parola. Un pezzo alla volta, un abbinamento alla volta.", tags:["Sneakers", "Streetwear", "Dettagli"], icon:Footprints, color:"#b9d7e7" },
];
export default function PersonalHome(){
 const [selected,setSelected]=useState<number|null>(null); const [menu,setMenu]=useState(false); const [paused,setPaused]=useState(false); const [videoReady,setVideoReady]=useState(false); const [videoError,setVideoError]=useState(false);
 const video=useRef<HTMLVideoElement>(null); const hero=useRef<HTMLElement>(null);
 useEffect(()=>{
  // Preserve confirmation and password recovery links belonging to the existing account area.
  const q=new URLSearchParams(location.search); if(q.has("code")||q.has("token_hash")||q.has("type")||q.has("payment")||q.has("product")||/access_token=|error_description=/.test(location.hash)){location.replace("/area-riservata"+location.search+location.hash);return;}
  const media=matchMedia("(prefers-reduced-motion: reduce)"); const sync=()=>setPaused(media.matches); sync();media.addEventListener("change",sync);
  document.querySelector(".dv-site")?.classList.add("dv-enhanced");
  const obs=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add("dv-visible");obs.unobserve(e.target);}}),{threshold:0.12});document.querySelectorAll(".dv-reveal").forEach(el=>obs.observe(el));
  return()=>{obs.disconnect();media.removeEventListener("change",sync);};
 },[]);
 useEffect(()=>{if(paused)video.current?.pause();else video.current?.play().catch(()=>setPaused(true));},[paused]);
 const w=selected===null?null:worlds[selected];
 return <div className={`dv-site ${paused?"dv-paused":""}`}>
  <a href="#mondi" className="dv-skip">Vai ai miei mondi</a>
  <header className="dv-nav"><a href="#" className="dv-logo" aria-label="Davide, home">d<span>v</span><i>®</i></a><nav aria-label="Navigazione principale"><a href="#mondi">I miei mondi</a><a href="#about">Questo sono io</a></nav><a className="dv-access" href="/area-riservata">Area riservata <ArrowUpRight size={16}/></a><button className="dv-menu" onClick={()=>setMenu(!menu)} aria-expanded={menu} aria-label={menu?"Chiudi menu":"Apri menu"}>{menu?<X/>:<Menu/>}</button></header>
  {menu&&<nav className="dv-mobile-nav" aria-label="Navigazione mobile"><a onClick={()=>setMenu(false)} href="#mondi">I miei mondi</a><a onClick={()=>setMenu(false)} href="#about">Questo sono io</a><a href="/area-riservata">Area riservata ↗</a></nav>}
  <main>
   <section className="dv-hero" ref={hero} onPointerMove={e=>{if(paused||e.pointerType!=="mouse")return;const r=e.currentTarget.getBoundingClientRect();e.currentTarget.style.setProperty("--mx",`${((e.clientX-r.left)/r.width-.5)*14}px`);e.currentTarget.style.setProperty("--my",`${((e.clientY-r.top)/r.height-.5)*10}px`);}} onPointerLeave={()=>{hero.current?.style.setProperty("--mx","0px");hero.current?.style.setProperty("--my","0px");}}>
    <div className="dv-hero-top"><span>DAVIDE’S PERSONAL UNIVERSE</span><span>EST. 2005 / ITALIA</span></div>
    <div className="dv-hero-art"><img src="/davide-universe.webp" alt="Controller trasparente, sfera da collezione, pallone e sneaker illuminati in verde acido" fetchPriority="high"/><video ref={video} muted loop playsInline preload="metadata" poster="/davide-universe.webp" onCanPlay={()=>setVideoReady(true)} onError={()=>setVideoError(true)} aria-label="Ambientazione animata delle passioni di Davide" className={videoReady&&!videoError?"dv-video-ready":""}><source src="/davide-motion.mp4" type="video/mp4"/></video></div>
    <div className="dv-hero-copy"><div className="dv-eyebrow"><span className="dv-cross">+</span> PIACERE, SONO DAVIDE.</div><h1>PLAYER<br/><span>ONE.</span><sup>™</sup></h1><p>Quattro passioni.<br/>Un solo modo di essere me.</p><a href="#mondi" className="dv-cta">Entra nel mio mondo <ArrowUpRight size={20}/></a></div>
    <div className="dv-hero-bottom"><a href="#mondi"><ArrowDown size={18}/> SCROLL TO EXPLORE</a><span className="dv-hero-note">POKÉMON / GAMING / FOOTBALL / STYLE</span><button onClick={()=>setPaused(!paused)} aria-label={paused?"Riprendi animazioni":"Metti in pausa animazioni"} aria-pressed={paused}>{paused?<Play size={16}/>:<Pause size={16}/>}<span>{paused?"Riprendi":"Pausa"}</span></button></div>
   </section>
   <div className="dv-ticker" aria-hidden="true"><div>{[0,1,2,3].map(n=><span key={n}>CATCH ’EM ALL <b>✳</b> PLAY YOUR GAME <b>✳</b> LIVE THE MATCH <b>✳</b> OWN YOUR STYLE <b>✳</b> </span>)}</div></div>
   <section className="dv-worlds" id="mondi"><div className="dv-section-heading dv-reveal"><div><span className="dv-eyebrow">01 — LE MIE COORDINATE</span><h2>Non una sola<br/>dimensione<span>.</span></h2></div><p>Ci sono cose che mi accendono.<br/>Queste sono le mie.</p></div>
    <div className="dv-world-grid">{worlds.map((item,i)=>{const Icon=item.icon;return <button key={item.id} className={`dv-world dv-world-${item.id} dv-reveal`} onClick={()=>setSelected(i)} style={{"--world-color":item.color} as React.CSSProperties}><div className="dv-world-head"><span>{item.number} / WORLD</span><Icon size={21}/></div>{i===0?<img className="dv-world-image" src="/davide-charizard.webp" alt="Charizard in un’arena illuminata dalle braci" loading="lazy"/>:i===3?<img className="dv-world-image" src="/davide-style.webp" alt="Sneaker argentata affacciata su uno stadio notturno" loading="lazy"/>:i===1?<div className="dv-type-art" aria-hidden="true">PLAY<br/><span>AGAIN.</span></div>:<div className="dv-type-art dv-football-type" aria-hidden="true">90<span>′</span><small>FINO ALL’ULTIMO.</small></div>}<div className="dv-world-caption"><p>{item.kicker}</p><h3>{item.label}<span><ArrowUpRight size={23}/></span></h3></div></button>})}</div>
   </section>
   <section className="dv-about dv-reveal" id="about"><div className="dv-about-label"><span className="dv-eyebrow">02 — NO FILTER</span><span className="dv-monogram">dv.</span></div><div className="dv-about-copy"><h2>Un po’ nerd.<br/>Un po’ da stadio.<br/><span>Sempre me.</span></h2><p>Mi piacciono i Pokémon, i videogiochi, il calcio e la moda. Questo è il mio spazio: un punto d’incontro tra mondi diversi che, insieme, raccontano qualcosa di me.</p><div className="dv-signature">Davide <MoveUpRight size={30}/></div></div></section>
   <section className="dv-end dv-reveal"><span className="dv-eyebrow">NESSUN GAME OVER.</span><a href="#">JUST <span>RESTART.</span><ArrowUpRight/></a></section>
  </main>
  <footer className="dv-footer"><a className="dv-logo" href="#">d<span>v</span><i>®</i></a><span>IL MIO MONDO, LE MIE REGOLE.</span><span>© {new Date().getFullYear()} DAVIDE</span><a href="/area-riservata">Area riservata ↗</a></footer>
  <Dialog open={selected!==null} onOpenChange={open=>{if(!open)setSelected(null);}}><DialogContent className="dv-dialog" style={w?{"--world-color":w.color} as React.CSSProperties:undefined}>{w&&<><span className="dv-eyebrow">WORLD {w.number} / {w.label}</span><DialogTitle className="dv-dialog-title">{w.title}</DialogTitle><DialogDescription className="dv-dialog-text">{w.text}</DialogDescription><div className="dv-dialog-tags">{w.tags.map(tag=><span key={tag}>{tag}</span>)}</div><div className="dv-dialog-bottom"><span>{w.number} / 04</span><button onClick={()=>setSelected(((selected??0)+1)%4)}>Prossimo mondo <ArrowUpRight size={20}/></button></div></>}</DialogContent></Dialog>
 </div>;
}
