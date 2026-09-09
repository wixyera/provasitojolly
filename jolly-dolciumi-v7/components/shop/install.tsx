"use client";
import {useEffect,useState} from "react";
import {Download} from "lucide-react";
import {Button} from "@/components/ui/button";
type InstallEvent=Event & {prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
export function InstallApp(){
 const [prompt,setPrompt]=useState<InstallEvent|null>(null),[installed,setInstalled]=useState(false),[help,setHelp]=useState(false);
 useEffect(()=>{setInstalled(matchMedia('(display-mode: standalone)').matches);const install=(e:Event)=>{e.preventDefault();setPrompt(e as InstallEvent);};const done=()=>{setInstalled(true);setPrompt(null);};window.addEventListener('beforeinstallprompt',install);window.addEventListener('appinstalled',done);return()=>{window.removeEventListener('beforeinstallprompt',install);window.removeEventListener('appinstalled',done);};},[]);
 if(installed)return null;
 return <div><Button className="btn btn-outline" onClick={async()=>{if(prompt){try{await prompt.prompt();await prompt.userChoice;}catch{setHelp(true);}setPrompt(null);}else setHelp(!help);}}><Download size={17}/> Installa Jolly</Button>{help&&<p className="notice">Su iPhone: apri il sito in Safari, premi Condividi e “Aggiungi alla schermata Home”. Su Chrome o Edge usa “Installa app” nel menu del browser, se disponibile. Il catalogo richiede una connessione.</p>}</div>;
}
