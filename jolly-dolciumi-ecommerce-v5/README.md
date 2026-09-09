# Jolly Dolciumi

E-commerce protetto da account per dolci, snack, patatine, cioccolato, bibite e attrezzature per gelati/granite. Il cliente può scegliere la quantità disponibile, creare il carrello e inviare l’ordine; lo staff ha una control room per prodotti, immagini, stock, utenti, ordini, coupon, preventivi e impostazioni del negozio.

La nuova control room include anche magazzino con movimenti e scanner QR, soglie di scorta, importazione CSV, listini retail/business/VIP, sconti per quantità, avvisi di disponibilità, grafico incassi e installazione come app. Il QR di un prodotto apre direttamente la sua scheda dopo l’accesso.

## Supabase — prima configurazione

Il browser usa soltanto la chiave pubblica già presente in `public/config.js`.

1. Nel progetto Supabase corretto apri **SQL Editor** ed esegui tutto il file `supabase/AGGIORNAMENTO.sql`.
2. Dal sito crea il primo account e conferma l’email se la conferma email è attiva in **Authentication → Providers → Email**.
3. Nel blocco commentato alla fine di `supabase/AGGIORNAMENTO.sql` sostituisci l’email e assegna il ruolo `staff`.
4. Accedi come staff: dalla sezione **Utenti** potrai modificare ruolo, bloccare/riattivare account e inviare il recupero password. Il pulsante **Invita utente** richiede il secret server-side opzionale descritto più sotto.

In Supabase → **Authentication → URL Configuration**, imposta come **Site URL** l’URL pubblico Cloudflare e aggiungilo tra i **Redirect URLs**. Nel file `public/config.js` puoi anche valorizzare `authRedirectUrl` con lo stesso URL: così i link di conferma e recupero password non torneranno a `localhost:3000`.

Non caricare mai una chiave `sb_secret_...` su GitHub, in `public/config.js` o nel browser.

## GitHub e Cloudflare

Carica il contenuto di questo archivio nella radice della repository, mantenendo anche `.openai/hosting.json`. Non caricare una cartella esterna che contenga il progetto: `package.json`, `app/` e `.openai/hosting.json` devono essere visibili direttamente nella radice della repository.

In Cloudflare Workers → Builds & deployments imposta:

- **Build command:** `npm run build`
- **Deploy command:** `npx wrangler deploy --config dist/server/wrangler.json --name provasitojolly`
- **Production branch:** `main`

Il progetto genera il bundle Cloudflare in `dist/`; la cartella viene creata durante il build e non va caricata nel repository.

## Inviti staff e pagamenti con carta

Ordini, stock, coupon e disponibilità sono protetti da RLS e da funzioni SQL atomiche. Il flusso predefinito è l’ordine con conferma manuale/bonifico o ritiro; la carta resta disattivata finché non viene configurato un provider.

Per abilitare gli inviti dal pannello staff, aggiungi nei **Worker secrets** di Cloudflare:

```text
SUPABASE_URL=https://xwgzxdpamsleleliatjc.supabase.co
SUPABASE_PUBLISHABLE_KEY=<la chiave pubblica del progetto>
SUPABASE_SECRET_KEY=<la secret key del progetto, solo nei Worker secrets>
```

Per attivare Stripe aggiungi anche `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET`, poi registra in Stripe il webhook `https://TUO-DOMINIO/api/stripe-webhook` per gli eventi `checkout.session.completed`, `checkout.session.async_payment_succeeded` e `checkout.session.expired`. Solo dopo abilita **Pagamento con carta** dalla sezione **Negozio** dello staff.

Per inviare automaticamente una conferma ordine e gli aggiornamenti di stato, aggiungi nei Worker secrets `RESEND_API_KEY` e `MAIL_FROM` (un mittente verificato su Resend). Senza questi due valori gli ordini funzionano comunque e le email restano semplicemente disattivate.

Non inserire questi valori nei file del progetto. Finché non sono configurati, gli account possono comunque essere creati dal form pubblico e lo staff può gestire quelli esistenti; il negozio resta utilizzabile con ordine manuale, bonifico o ritiro.
