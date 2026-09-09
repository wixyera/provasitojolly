# Davide — Player One

Restyle personale del progetto allegato: una home cinematografica dedicata a Pokémon, gaming, Serie A e street style.

## Le pagine

- `/`: nuova home personale, con video atmosferico, grafica originale, parallax leggero, titoli animati, sezioni a comparsa e quattro mondi interattivi.
- `/area-riservata`: applicazione originale, con le funzioni già presenti e la configurazione esistente.
- `/privacy` e `/termini`: documenti dell’area originale.

Il pulsante Pausa interrompe il video e le animazioni continue. Il sito rispetta le preferenze di movimento ridotto. Se il video non viene riprodotto, resta visibile l’immagine di copertina.

## Avvio

Richiede Node.js 22.13 o superiore.

```sh
npm ci
npm run dev
```

Per preparare la versione di produzione:

```sh
npm run build
```

Il progetto mantiene React / Vinext e il runtime Cloudflare originale. Non è un sito composto soltanto da file HTML: le funzioni dell’area riservata richiedono il relativo server e la configurazione Supabase già predisposta. Le chiavi segrete vanno conservate nelle variabili del server, mai nel codice pubblico.

## Personalizzazione

- Testi, sezioni e navigazione: `app/page.tsx`.
- Aspetto della home: `app/personal.css`.
- Titolo e metadati: `app/layout.tsx`.
- Immagini, icona e video personali: `public/davide-*`.
- Applicazione originale: `app/area-riservata/page.tsx`, `components/shop`, `lib`, `app/api`.

I collegamenti originali di conferma account, recupero password, pagamento e prodotto che arrivano alla home vengono inoltrati all’area riservata mantenendo i parametri.

`GUIDA_PASSO_PASSO.md` conserva la guida originale del negozio. Non è necessaria per visualizzare la nuova home.

Le illustrazioni sono artwork digitali creati per questo restyle. Il video è una breve animazione atmosferica della copertina, senza audio. Pokémon e gli altri marchi citati appartengono ai rispettivi titolari; questo è un sito personale non ufficiale.
