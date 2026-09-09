# Jolly Dolciumi — Edizione 07

Questa guida accompagna lo ZIP v7. Il codice è stato aggiornato e verificato localmente; non è stato caricato nel tuo Cloudflare e non è stata modificata la configurazione del tuo Supabase. Per attivarlo segui i passaggi in ordine. I nomi dei menu possono essere tradotti diversamente in italiano.

## 1. Estrai lo ZIP e prepara GitHub

1. Scarica `jolly-dolciumi-v7.zip` ed estrailo con **Estrai tutto** su Windows.
2. Apri la repository `wixyera/provasitojolly` su GitHub.
3. Carica nella radice i file estratti, sostituendo quelli omonimi. Nella prima schermata della repository devono vedersi `package.json`, `package-lock.json`, `app`, `components`, `public`, `supabase`, `worker`, `vite.config.ts` e `.openai/hosting.json`.
4. Non caricare lo ZIP come unico file: Cloudflare ha bisogno dei sorgenti estratti. Non caricare `node_modules` o `dist`.
5. Se usi **Add file → Upload files**, carica gruppi con meno di 100 file. Il progetto supera quel numero: separa le cartelle in più caricamenti. Durante gli upload intermedi un deploy può fallire perché mancano ancora file: considera quello successivo all’ultimo commit.
6. Per caricare tutto in un unico commit puoi usare GitHub Desktop: **File → Clone repository → URL**, incolla l’URL della repository, scegli una cartella; copia lì il contenuto estratto; apri Desktop, controlla i cambiamenti, scrivi `Aggiornamento Jolly v7`, premi **Commit to main**, poi **Push origin**. Conserva la cartella `.git` creata dalla clonazione.

Non cancellare i prodotti dal sito per fare l’aggiornamento. I dati sono su Supabase, non nello ZIP.

## 2. Aggiorna il database Supabase

1. Apri il progetto **xwgzxdpamsleleliatjc** nel tuo pannello Supabase.
2. Apri **SQL Editor → New query**.
3. Sul PC apri `supabase/AGGIORNAMENTO.sql` con un editor di testo.
4. Copia **tutto il file**, incollalo nella query e premi **Run**.
5. Aspetta il completamento senza errori. Il file comprende già la V7: non devi eseguire separatamente `V7.sql`.
6. In **Table Editor** controlla che ci siano `products`, `profiles`, `cart_items`, `orders`, `order_items`, `inventory_movements`, `stock_alerts`, `email_outbox` e `legal_settings`.

La migrazione non svuota le tabelle e può essere rieseguita. È stata provata su schema iniziale e su schema già aggiornato. Se il tuo database contiene modifiche manuali diverse dal progetto, conserva il messaggio di errore completo: non cancellare tabelle per risolverlo.

Se un vecchio kit contiene solo nomi descrittivi, aprilo nello staff e sostituisci i componenti con SKU o ID reali (passaggio 8). Gli ordini precedenti restano nello storico.

## 3. Configura build e deploy Cloudflare

Questo progetto usa **Cloudflare Workers** con funzioni server, non un semplice caricamento statico in Pages.

1. Apri **Workers & Pages → provasitojolly → Settings → Build**.
2. Verifica repository `wixyera/provasitojolly` e branch `main`.
3. Imposta **Root directory** sulla radice del repository (`/` o campo vuoto secondo il pannello).
4. Imposta **Build command**:

```text
npm run build
```

5. Imposta **Deploy command**:

```text
npx wrangler deploy --config dist/server/wrangler.json --name provasitojolly
```

6. Se il tuo Worker ha un nome diverso, sostituisci soltanto `provasitojolly` con il nome effettivo.
7. Salva e avvia il deploy dell’ultimo commit. `dist` viene generata durante la build.
8. Copia l’indirizzo HTTPS pubblico del Worker: nelle istruzioni successive viene chiamato **URL DEL SITO**. Non usare l’indirizzo del pannello Cloudflare o Supabase.
9. Apri `URL DEL SITO/aggiorna.html` e premi **Apri la nuova versione**. Dopo il login, il footer della home deve mostrare **Edizione 07**.

I push su `main` attivano i nuovi deploy. Le credenziali necessarie al sito vanno nelle impostazioni runtime indicate sotto, non soltanto nelle variabili di build. [Documentazione Cloudflare Builds](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/).

## 4. Risolvi il recupero password con codice email

Il nuovo flusso è: **Password dimenticata → email → codice → nuova password**. Non richiede di seguire un link.

1. In Supabase apri **Authentication → URL Configuration**.
2. Sostituisci `http://localhost:3000` in **Site URL** con l’URL HTTPS del sito.
3. In **Redirect URLs** aggiungi l’URL esatto con slash finale, per esempio `https://TUO-DOMINIO/`. Serve anche per conferma account e inviti.
4. Apri **Authentication → Email Templates → Reset Password** (in alcune viste è sotto **Emails**).
5. Apri il file `docs/RESET_PASSWORD_EMAIL.html` con un editor di testo e copia il sorgente HTML nel corpo del template. Deve contenere esattamente `{{ .Token }}`. Non copiare l’anteprima del browser.
6. Imposta l’oggetto `Jolly — codice per recuperare la password` e salva.
7. Dal sito esci dall’account, premi **Password dimenticata?**, inserisci l’email e premi **Invia codice**.
8. Copia il codice dell’ultima email ricevuta, premi **Verifica codice**, inserisci due volte una nuova password di almeno 10 caratteri e salva.

Non usare un vecchio messaggio di recupero: i vecchi link non vengono riscritti. Non rimuovere la variabile `{{ .Token }}` dal template. Il formato OTP è supportato da [Supabase Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates).

### Se le email non arrivano

Le email di login/registrazione/recupero sono inviate da **Supabase Auth**. Quelle di ordini e disponibilità sono inviate dal **Worker tramite Resend**: sono due configurazioni distinte.

Per inviare messaggi Auth a clienti reali configura **Custom SMTP** in Supabase usando i dati SMTP forniti dal tuo servizio email: host, porta, username, password, mittente e nome `Jolly Dolciumi`. Puoi usare Resend anche come provider SMTP. Il servizio email predefinito di Supabase limita i destinatari e il numero di invii: non è sufficiente per un negozio aperto ad altri clienti. [Supabase Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

## 5. Abilita gestione inviti, email e pagamenti

In **Cloudflare → Worker → Settings → Variables and Secrets**, aggiungi questi valori come **Secret** runtime e salva/distribuisci le modifiche:

| Nome | Valore da inserire |
|---|---|
| `SUPABASE_SECRET_KEY` | La secret key del progetto Supabase corretto, copiata dal suo pannello |
| `RESEND_API_KEY` | La API key del tuo account Resend |
| `MAIL_FROM` | Un mittente verificato, ad esempio `Jolly Dolciumi <ordini@TUO-DOMINIO>` |
| `STRIPE_SECRET_KEY` | La secret key Stripe di test, se vuoi provare i pagamenti con carta |
| `STRIPE_WEBHOOK_SECRET` | Il segreto del webhook Stripe creato al passaggio 6 |

L’URL Supabase e la publishable key del progetto sono già configurati. Se vuoi impostarli anche come variabili runtime usa `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` con gli stessi valori di `public/config.js`. Non cambiare progetto solo nel server lasciando il browser collegato a un altro.

Le secret key non vanno nel repository, nei file pubblici o nel template email.

Per Resend:

1. Nel tuo account Resend apri **Domains**, aggiungi un dominio che controlli e inserisci nel DNS i record richiesti da Resend.
2. Aspetta che il dominio risulti verificato.
3. Crea una API key abilitata all’invio e inseriscila in `RESEND_API_KEY`.
4. Usa in `MAIL_FROM` un indirizzo appartenente a quel dominio. Un indirizzo inventato non funziona.
5. Nel sito apri **Area staff → Servizi e testi**: la voce email deve risultare configurata.
6. Crea un ordine di prova e controlla la coda. Puoi premere **Elabora email in attesa** per elaborare subito fino a 10 email.
7. In Cloudflare verifica **Settings → Trigger Events → Cron Triggers**: il deploy deve avere creato `*/5 * * * *`, cioè ogni cinque minuti. È già incluso in `vite.config.ts` e nel Worker compilato. Non creare un secondo Worker per le email.

La coda ritenta gli errori temporanei fino a 15 volte. In **Servizi e testi** vedi gli errori; dopo aver corretto la configurazione puoi ritentare gli invii falliti. La chiave di idempotenza evita duplicati entro la finestra del provider; un ritentativo manuale dopo oltre 24 ore può duplicare un invio dall’esito incerto. [Resend idempotenza](https://resend.com/docs/dashboard/emails/idempotency-keys), [Cloudflare Cron](https://developers.cloudflare.com/workers/configuration/cron-triggers/).

## 6. Pagamenti con carta in modalità test

1. Apri Stripe in modalità **Test/Sandbox**.
2. Crea un endpoint webhook con URL `URL DEL SITO/api/stripe-webhook`.
3. Seleziona gli eventi `checkout.session.completed`, `checkout.session.async_payment_succeeded` e `checkout.session.expired`.
4. Copia il signing secret dell’endpoint in `STRIPE_WEBHOOK_SECRET` su Cloudflare. Usa la secret API key dello stesso ambiente di test in `STRIPE_SECRET_KEY`.
5. Nel sito, **Area staff → Negozio**, abilita il pagamento con carta.
6. Crea un ordine e completa il checkout usando i dati di test indicati da Stripe. Controlla che il webhook venga consegnato e che l’ordine risulti pagato.

Prima di configurare Stripe puoi comunque provare ordini manuali, bonifico e ritiro (se abilitati nelle impostazioni del negozio). Non abilitare la carta soltanto perché compare un pulsante: servono entrambe le credenziali e il webhook.

## 7. Crea il primo account staff

1. Registrati dal sito con la tua email e confermala, se richiesto.
2. In Supabase SQL Editor esegui la query seguente sostituendo l’email:

```sql
update public.profiles
set role = 'staff', is_blocked = false
where id = (
  select id from auth.users where email = 'LA-TUA-EMAIL'
);
```

3. Esci e rientra nel sito. Vedrai **Area staff**.
4. Apri **Utenti → Gestisci** per assegnare ruolo, listino retail/business/VIP e sospendere o riattivare un cliente.
5. **Invita utente** richiede il secret Supabase server e l’invio email Auth configurato. Non comunica password allo staff: il destinatario sceglie la propria.

## 8. Aggiungi prodotti e crea kit

### Prodotto normale

1. **Area staff → Articoli → Aggiungi articolo**.
2. Inserisci nome, categoria, prezzo, giacenza intera e descrizione.
3. Assegna uno SKU riconoscibile, ad esempio `COLA01`.
4. Carica un’immagine JPG/PNG/WebP fino a 5 MB oppure inserisci un URL HTTPS.
5. Imposta soglia scorta e posizione magazzino, se utili.
6. Salva. Il prodotto entra nel catalogo e si apre la sua etichetta QR scaricabile e stampabile.

Le attrezzature possono usare **Solo su preventivo**. I prodotti normali devono avere un prezzo di almeno 0,01 € nel modulo.

### Importazione CSV

1. Prova `docs/PRODOTTI_ESEMPIO.csv` tramite **Articoli → Importa CSV**.
2. I prezzi possono usare la virgola; il separatore del file di esempio è `;`.
3. Puoi importare fino a 200 articoli per file. La funzione aggiunge prodotti; non aggiorna automaticamente quelli già esistenti. Non importare due volte lo stesso file pensando che sovrascriva gli articoli.
4. Il risultato indica quante righe sono state importate e quali sono state scartate. Se l’importazione si interrompe, quelle già salvate restano: correggi e importa soltanto le righe mancanti.

### Kit con componenti reali

1. Crea prima gli articoli che compongono il kit e assegna loro SKU distinti.
2. Crea il prodotto kit, il suo prezzo e la sua giacenza massima vendibile (es. numero di box o confezioni disponibili).
3. In **Composizione box / kit**, scrivi per esempio `COLA01:2, PAT01:2`.
4. Ogni kit venduto scala una unità dalla giacenza del kit, due da `COLA01` e due da `PAT01`.
5. La disponibilità del kit è limitata anche dai componenti. L’annullamento reintegra le quantità effettivamente usate nell’ordine, anche se nel frattempo modifichi la composizione.
6. Non sono ammessi kit contenenti altri kit.
7. Dopo aver importato i prodotti di esempio puoi importare `docs/KIT_ESEMPIO.csv` per provarlo.

I listini business/VIP sono assegnati al cliente in **Utenti**. Gli sconti quantità usano `10:5, 20:10`: da dieci unità 5%, da venti 10%. Quando più soglie si applicano, viene usato lo sconto percentuale maggiore, anche nel database.

## 9. Prova carrello, magazzino e avvisi

1. Imposta un prodotto con stock **3**.
2. Accedi come cliente, scegli **2** nel selettore e aggiungi. La scheda deve mostrare **2 nel carrello**, con **1** ancora disponibile.
3. Aggiungi l’ultima unità: il pulsante deve diventare disabilitato. Rimuovi una unità e verifica che torni selezionabile.
4. Conferma l’ordine: lo stock viene scalato nel database. Il carrello da solo non prenota merce per tutti i clienti; la disponibilità viene ricontrollata alla conferma.
5. Da staff apri **Magazzino** e verifica il movimento. Usa **Scansiona QR** e autorizza la fotocamera; in alternativa usa uno scanner USB come tastiera nel campo SKU/codice.
6. Porta un prodotto a stock zero; come cliente premi **Avvisami quando torna**; come staff registra un carico positivo. Dopo l’elaborazione programmata deve arrivare l’avviso.
7. Registra un pagamento ricevuto nell’ordine: il grafico incassi lo attribuisce al giorno del pagamento, nel fuso italiano. I vecchi ordini senza `paid_at` non vengono attribuiti arbitrariamente a una giornata.
8. Cambia stato all’ordine: viene accodata l’email di aggiornamento anche se il browser del cliente è chiuso.

Lo scanner usa anche un decoder software, senza dipendere soltanto da BarcodeDetector. Per la fotocamera serve HTTPS e il permesso del browser. I QR sono generati nel sito, senza inviare i link a un servizio esterno.

## 10. Completa estetica, app e pagine pubbliche

- La home dopo il login contiene il video animato, pausa/riproduzione e i sei settori. L’intro è un’animazione dell’assortimento, non un filmato girato in azienda.
- Il logo personalizzato è in `public/jolly-logo.svg`; le icone PNG per l’app sono incluse.
- Premi **Installa Jolly** nella home. Su iPhone usa Safari → Condividi → Aggiungi alla schermata Home. L’app richiede internet per login, catalogo e ordini.
- In **Area staff → Servizi e testi**, inserisci ragione sociale, sede, partita IVA, email e i testi completi di Privacy e Condizioni. Salvali e controlla `/privacy` e `/termini`.
- Non sono stati inventati dati societari o condizioni contrattuali: finché non inserisci i testi, le pagine indicano che il documento non è ancora pubblicato.

## 11. Cosa è stato verificato e cosa verificare sul tuo account

Verificato localmente: compilazione TypeScript, build Cloudflare, migrazione iniziale e ripetuta su PostgreSQL tramite PGlite, creazione articolo staff con RLS, divieti cliente, limiti stock, componenti kit condivisi, sconti lato server, idempotenza checkout, reintegro una sola volta, coda email, lease e ritentativi, flusso OTP con richieste simulate e lettura QR tramite decoder software.

Non sono stati eseguiti acquisti reali, invii email reali, prove fotocamera fisica, installazione PWA sul tuo telefono o modifiche al tuo Supabase. La compilazione non sostituisce queste prove. Dopo aver completato la guida, esegui un ordine di test e il recupero password per verificare i servizi collegati.

Se compare un errore, invia il messaggio completo e indica il passaggio: database, deploy, login, salvataggio prodotto o email. La pagina staff **Servizi e testi** rende visibili anche gli errori di invio.
