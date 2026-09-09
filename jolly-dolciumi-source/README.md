# Jolly Dolciumi

Storefront e pannello staff per il catalogo Jolly Dolciumi.

## Collegamento Supabase

Il sito è già predisposto per il progetto Supabase di test `xwgzxdpamsleleliatjc` e usa solo la chiave pubblica nel browser.

1. Apri `supabase/schema.sql` nel SQL Editor del progetto Supabase ed eseguilo.
2. Crea un account dal sito e conferma l’email se la conferma è attiva nel pannello Auth.
3. Per abilitarlo come staff, esegui nel SQL Editor:

```sql
update public.profiles
set role = 'staff'
where id = (select id from auth.users where email = 'la-tua-email@example.com');
```

Il sito richiede un account per entrare nel catalogo. I clienti possono consultare i prodotti e creare ordini; lo staff può gestire catalogo, immagini e stato degli ordini.

La tabella `payments` e i campi di pagamento sono già pronti, ma per addebitare davvero una carta serve ancora collegare un provider come Stripe, PayPal o Nexi e le relative chiavi server-side. La chiave `sb_secret_...` non va mai inserita in `public/config.js` o nel codice client.
