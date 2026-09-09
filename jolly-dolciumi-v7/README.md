# Jolly Dolciumi — Edizione 07

Apri **GUIDA_PASSO_PASSO.md**: contiene installazione GitHub/Cloudflare, SQL Supabase, recupero password con codice, email, Stripe test e prove del negozio.

- Home animata con video e sei settori; logo SVG e icone app.
- Accesso clienti/staff, catalogo, foto, quantità, carrello e controlli stock nel database.
- QR locali scaricabili, scanner con fallback software, movimenti e soglie.
- Import CSV, listini retail/business/VIP, sconti quantità e kit con componenti reali.
- Coda persistente per email ordini e ritorno disponibilità; elaborazione Worker ogni cinque minuti.
- Pannello staff per utenti, servizi, incassi e testi legali pubblici.

Esegui tutto `supabase/AGGIORNAMENTO.sql`, che include la V7. `supabase/V7.sql` è conservato anche come riferimento separato.

Build: `npm run build`.
Deploy Cloudflare Workers: `npx wrangler deploy --config dist/server/wrangler.json --name provasitojolly`.

Non caricare lo ZIP come unico file su GitHub: estrai e carica il contenuto. Le chiavi segrete vanno nei Worker secrets runtime, mai nel repository. Il file `public/config.js` contiene solo la configurazione pubblica Supabase.

I file CSV di prova e il template email OTP sono in `docs/`. Le credenziali dei provider e i dati/testi legali reali vanno configurati dal proprietario. La versione include un filmato animato dell’assortimento, non riprese reali dell’azienda.
