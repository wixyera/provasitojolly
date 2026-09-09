-- JOLLY DOLCIUMI 3 · Installazione e aggiornamento non distruttivo.
-- Eseguire TUTTO nel SQL Editor del progetto xwgzxdpamsleleliatjc.
-- Vale anche su un progetto vuoto. Non elimina prodotti, utenti o ordini.
begin;
create extension if not exists pgcrypto;
create table if not exists public.profiles (id uuid primary key references auth.users(id) on delete cascade, full_name text, role text not null default 'customer', created_at timestamptz not null default now());
alter table public.profiles add column if not exists phone text not null default '';
alter table public.profiles add column if not exists email text not null default '';
alter table public.profiles add column if not exists is_blocked boolean not null default false;
alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles set role = 'staff' where role = 'admin';
alter table public.profiles add constraint profiles_role_check check (role in ('customer','staff'));
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id,full_name,email) values(new.id,coalesce(nullif(new.raw_user_meta_data->>'full_name',''),split_part(new.email,'@',1)),coalesce(new.email,''))
  on conflict(id) do update set email=excluded.email;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert or update of email on auth.users for each row execute function public.handle_new_user();
insert into public.profiles(id,full_name,email) select id,coalesce(nullif(raw_user_meta_data->>'full_name',''),split_part(email,'@',1)),coalesce(email,'') from auth.users
on conflict(id) do update set email=excluded.email;
create or replace function public.is_active_user() returns boolean language sql stable security definer set search_path = public as $$ select exists(select 1 from public.profiles where id=auth.uid() and not is_blocked); $$;
create or replace function public.is_staff() returns boolean language sql stable security definer set search_path = public as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='staff' and not is_blocked); $$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$ select public.is_staff(); $$;

create table if not exists public.products (
 id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique, category text not null default 'Caramelle', description text not null default '',
 price numeric(10,2) not null check(price>=0), compare_at_price numeric(10,2), image_url text, badge text, stock integer not null default 0 check(stock>=0),
 featured boolean not null default false, is_active boolean not null default true, created_at timestamptz not null default now()
);
alter table public.products add column if not exists sku text;
alter table public.products add column if not exists weight_label text;
alter table public.products add column if not exists ingredients text;
alter table public.products add column if not exists allergens text;
alter table public.products add column if not exists purchase_mode text not null default 'buy' check(purchase_mode in ('buy','quote'));

-- Catalogo dimostrativo iniziale: non sovrascrive i prodotti già inseriti.
-- Lo staff può modificarli o sostituirli dalla control room.
insert into public.products(name,slug,category,description,price,compare_at_price,badge,stock,featured,purchase_mode)
values
 ('Party Mix Rainbow','party-mix-rainbow','Gommose','Mix colorato di caramelle gommose, frutta e zucchero frizzante.',8.90,10.90,'Bestseller',60,true,'buy'),
 ('Patatine Crunchy Salted','patatine-crunchy-salted','Snack e patatine','Croccanti, saporite e perfette per una pausa salata.',2.50,null,'Croccanti',48,true,'buy'),
 ('Cola Frizz Original','cola-frizz-original','Bibite','La bibita frizzante da condividere, fresca e sempre pronta.',1.80,null,null,72,false,'buy'),
 ('Pistacchio Crunch','pistacchio-crunch','Cioccolato','Cioccolato al latte, pistacchio croccante e un finale leggermente salato.',12.50,null,'Nuovo',32,true,'buy'),
 ('Sour Galaxy','sour-galaxy','Caramelle','Nastri sour alla frutta con un’esplosione acidula.',6.50,null,'Acidissime',45,false,'buy'),
 ('Jolly Box','jolly-box','Box regalo','Una selezione sorpresa di dolcezze Jolly, pronta da regalare.',24.90,29.90,'Regalo',18,true,'buy'),
 ('Base Granita Tropicale','base-granita-tropicale','Gelati e granite','Base pronta per granite e bevande ghiacciate dal gusto tropicale.',19.90,null,null,24,false,'buy'),
 ('Macchina Granita Pro 2 Vasche','macchina-granita-pro-2-vasche','Attrezzature','Macchina professionale a due vasche per granite, sorbetti e bevande fredde.',0,null,'Per professionisti',5,true,'quote'),
 ('Soft Serve Compact','soft-serve-compact','Attrezzature','Macchina compatta per servire gelato soft e frozen dessert.',0,null,'Preventivo',3,false,'quote')
on conflict(slug) do nothing;

create table if not exists public.orders (
 id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null, customer_email text not null, status text not null default 'pending',
 total_amount numeric(10,2) not null default 0, note text, payment_status text not null default 'unpaid', payment_provider text, payment_reference text, paid_at timestamptz, created_at timestamptz not null default now()
);
alter table public.orders add column if not exists subtotal numeric(10,2) not null default 0;
alter table public.orders add column if not exists shipping_amount numeric(10,2) not null default 0;
alter table public.orders add column if not exists discount_amount numeric(10,2) not null default 0;
alter table public.orders add column if not exists shipping_address jsonb;
alter table public.orders add column if not exists delivery_method text not null default 'shipping';
alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists gift_message text;
alter table public.orders add column if not exists tracking_url text;
alter table public.orders add column if not exists request_id uuid;
alter table public.orders add column if not exists stock_released boolean not null default false;
create unique index if not exists orders_request_unique on public.orders(user_id,request_id);
create table if not exists public.order_items (id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders(id) on delete cascade,product_id uuid references public.products(id) on delete set null,product_name text not null,quantity integer not null check(quantity>0),unit_price numeric(10,2) not null check(unit_price>=0));
create table if not exists public.payments (id uuid primary key default gen_random_uuid(),order_id uuid not null unique references public.orders(id) on delete cascade,user_id uuid references auth.users(id) on delete set null,provider text not null default 'manual',status text not null default 'pending',amount numeric(10,2) not null check(amount>=0),external_reference text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.store_settings (
 id integer primary key check(id=1), shipping_fee numeric(10,2) not null default 4.9 check(shipping_fee>=0), free_shipping_threshold numeric(10,2) not null default 39 check(free_shipping_threshold>=0),
 pickup_enabled boolean not null default false, pickup_address text not null default '', card_enabled boolean not null default false, bank_enabled boolean not null default false,
 bank_details text not null default '', contact_email text not null default '', contact_phone text not null default '', announcement text not null default 'Dolce, salato e tutto quello che cerchi.'
);
insert into public.store_settings(id) values(1) on conflict do nothing;
create table if not exists public.coupons(code text primary key check(code=upper(code) and length(code) between 3 and 30),percent_off integer not null check(percent_off between 1 and 90),min_amount numeric(10,2) not null default 0 check(min_amount>=0),expires_at timestamptz,is_active boolean not null default true);
create table if not exists public.cart_items(user_id uuid not null references auth.users(id) on delete cascade,product_id uuid not null references public.products(id) on delete cascade,quantity integer not null check(quantity between 1 and 99),primary key(user_id,product_id));
create table if not exists public.wishlist(user_id uuid not null references auth.users(id) on delete cascade,product_id uuid not null references public.products(id) on delete cascade,primary key(user_id,product_id));
create table if not exists public.addresses(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,label text not null default 'Indirizzo principale',
 full_name text not null,phone text not null,street text not null,city text not null,postal_code text not null,country text not null default 'IT' check(country='IT'),company text,tax_id text,created_at timestamptz not null default now()
);
create table if not exists public.quote_requests(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,product_id uuid references public.products(id) on delete set null,product_name text not null,message text not null,phone text not null,status text not null default 'new' check(status in ('new','contacted','closed')),created_at timestamptz not null default now());
create table if not exists public.stripe_events(id text primary key,created_at timestamptz not null default now());
create table if not exists public.staff_audit(id uuid primary key default gen_random_uuid(),actor_id uuid,action text not null,target_id uuid,created_at timestamptz not null default now());
create index if not exists orders_user_created_idx on public.orders(user_id,created_at desc);
create index if not exists order_items_order_idx on public.order_items(order_id);
create index if not exists addresses_user_idx on public.addresses(user_id);
create index if not exists quotes_user_idx on public.quote_requests(user_id);
create index if not exists products_catalog_idx on public.products(is_active,category,created_at);

-- Rimpiazza esclusivamente le policy delle tabelle di questa applicazione.
do $$ declare r record; begin
 for r in select tablename,policyname from pg_policies where schemaname='public' and tablename in ('profiles','products','orders','order_items','payments','store_settings','coupons','cart_items','wishlist','addresses','quote_requests','stripe_events','staff_audit')
 loop execute format('drop policy %I on public.%I',r.policyname,r.tablename); end loop;
 for r in select unnest(array['profiles','products','orders','order_items','payments','store_settings','coupons','cart_items','wishlist','addresses','quote_requests','stripe_events','staff_audit']) as t
 loop execute format('alter table public.%I enable row level security',r.t); execute format('revoke all on public.%I from anon, authenticated',r.t); end loop;
end $$;
grant select on public.profiles,public.products,public.orders,public.order_items,public.payments,public.store_settings,public.coupons,public.cart_items,public.wishlist,public.addresses,public.quote_requests,public.staff_audit to authenticated;
grant insert,update on public.products,public.coupons to authenticated;
grant update on public.store_settings to authenticated;
grant update(status) on public.quote_requests to authenticated;
grant insert,delete on public.wishlist,public.addresses to authenticated;
grant all on public.profiles,public.products,public.orders,public.order_items,public.payments,public.store_settings,public.coupons,public.cart_items,public.wishlist,public.addresses,public.quote_requests,public.stripe_events,public.staff_audit to service_role;
create policy profile_read on public.profiles for select to authenticated using(id=auth.uid() or public.is_staff());
create policy product_read on public.products for select to authenticated using(public.is_active_user() and (is_active or public.is_staff()));
create policy product_insert on public.products for insert to authenticated with check(public.is_staff());
create policy product_update on public.products for update to authenticated using(public.is_staff()) with check(public.is_staff());
create policy order_read on public.orders for select to authenticated using(public.is_active_user() and (user_id=auth.uid() or public.is_staff()));
create policy item_read on public.order_items for select to authenticated using(exists(select 1 from public.orders where id=order_id));
create policy payment_read on public.payments for select to authenticated using(public.is_active_user() and (user_id=auth.uid() or public.is_staff()));
create policy settings_read on public.store_settings for select to authenticated using(public.is_active_user());
create policy settings_write on public.store_settings for update to authenticated using(public.is_staff()) with check(public.is_staff());
create policy coupon_staff on public.coupons for all to authenticated using(public.is_staff()) with check(public.is_staff());
create policy cart_read on public.cart_items for select to authenticated using(user_id=auth.uid() and public.is_active_user());
create policy wishlist_owner on public.wishlist for all to authenticated using(user_id=auth.uid() and public.is_active_user()) with check(user_id=auth.uid() and public.is_active_user());
create policy address_owner on public.addresses for all to authenticated using(user_id=auth.uid() and public.is_active_user()) with check(user_id=auth.uid() and public.is_active_user());
create policy quote_read on public.quote_requests for select to authenticated using(public.is_active_user() and (user_id=auth.uid() or public.is_staff()));
create policy quote_staff_update on public.quote_requests for update to authenticated using(public.is_staff()) with check(public.is_staff());
create policy audit_read on public.staff_audit for select to authenticated using(public.is_staff());

create or replace function public.update_own_profile(p_name text,p_phone text) returns void language plpgsql security definer set search_path = public as $$
begin
 if not public.is_active_user() then raise exception 'Account non autorizzato'; end if;
 if length(trim(p_name)) not between 2 and 120 or length(p_phone)>40 then raise exception 'Nome o telefono non valido'; end if;
 update public.profiles set full_name=trim(p_name),phone=trim(p_phone) where id=auth.uid();
end $$;
create or replace function public.staff_user_update(p_user_id uuid,p_name text,p_phone text,p_role text,p_blocked boolean) returns void language plpgsql security definer set search_path = public as $$
begin
 perform pg_advisory_xact_lock(884923);
 if not public.is_staff() then raise exception 'Solo lo staff può gestire gli utenti'; end if;
 if p_role not in ('customer','staff') or p_role is null or p_blocked is null or length(trim(p_name)) not between 2 and 120 or length(p_phone)>40 then raise exception 'Dati utente non validi'; end if;
 if p_user_id=auth.uid() and (p_role<>'staff' or p_blocked) then raise exception 'Non puoi bloccare o rimuovere il tuo accesso staff'; end if;
 update public.profiles set full_name=trim(p_name),phone=trim(p_phone),role=p_role,is_blocked=p_blocked where id=p_user_id;
 if not found then raise exception 'Utente non trovato'; end if;
 insert into public.staff_audit(actor_id,action,target_id) values(auth.uid(),'user_updated',p_user_id);
end $$;

create or replace function public.set_cart_quantity(p_product_id uuid,p_quantity integer) returns setof public.cart_items language plpgsql security definer set search_path = public as $$
declare p public.products%rowtype;
begin
 if not public.is_active_user() then raise exception 'Account non autorizzato'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,78));
 if p_quantity is null or p_quantity<0 or p_quantity>99 then raise exception 'Scegli una quantità tra 0 e 99'; end if;
 if p_quantity=0 then delete from public.cart_items where user_id=auth.uid() and product_id=p_product_id;
 else
  select * into p from public.products where id=p_product_id and is_active for update;
  if not found or p.purchase_mode='quote' then raise exception 'Articolo non acquistabile'; end if;
  if p_quantity>p.stock then raise exception 'Disponibilità aggiornata: restano % pezzi di %',p.stock,p.name; end if;
  insert into public.cart_items(user_id,product_id,quantity) values(auth.uid(),p_product_id,p_quantity) on conflict(user_id,product_id) do update set quantity=excluded.quantity;
 end if;
 return query select * from public.cart_items where user_id=auth.uid() order by product_id;
end $$;
create or replace function public.check_coupon(p_code text,p_subtotal numeric) returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.coupons%rowtype;
begin
 if not public.is_active_user() then raise exception 'Account non autorizzato'; end if;
 select * into c from public.coupons where code=upper(trim(p_code)) and is_active and (expires_at is null or expires_at>now());
 if not found then raise exception 'Codice sconto non valido o scaduto'; end if;
 if p_subtotal is null or p_subtotal<c.min_amount then raise exception 'Questo codice richiede almeno % € di prodotti',c.min_amount; end if;
 return to_jsonb(c);
end $$;
create or replace function public.checkout_order(p_items jsonb,p_address jsonb,p_delivery text,p_payment text,p_coupon text,p_note text,p_gift text,p_request_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.store_settings%rowtype; p public.products%rowtype; r record; o public.orders%rowtype; v_id uuid; v_sub numeric(10,2):=0; v_discount numeric(10,2):=0; v_ship numeric(10,2):=0; v_coupon jsonb; v_email text;
begin
 if not public.is_active_user() then raise exception 'Accedi con un account attivo per ordinare'; end if;
 if p_request_id is null then raise exception 'Identificativo richiesta mancante'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,78));
 select * into o from public.orders where user_id=auth.uid() and request_id=p_request_id;
 if found then return jsonb_build_object('id',o.id,'total_amount',o.total_amount); end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Il carrello è vuoto o contiene troppi articoli'; end if;
 if p_delivery is null or p_delivery not in ('shipping','pickup') or p_payment is null or p_payment not in ('manual','bank_transfer','pickup','stripe') then raise exception 'Consegna o pagamento non valido'; end if;
 if p_address is null or jsonb_typeof(p_address)<>'object' or coalesce(length(trim(p_address->>'full_name')),0)<2 or coalesce(length(trim(p_address->>'phone')),0)<6 then raise exception 'Inserisci nome e telefono validi'; end if;
 if p_delivery='shipping' and (coalesce(p_address->>'country','')<>'IT' or coalesce(length(trim(p_address->>'street')),0)<4 or coalesce(length(trim(p_address->>'city')),0)<2 or coalesce(p_address->>'postal_code','') !~ '^[0-9]{5}$') then raise exception 'Completa un indirizzo italiano valido con CAP a 5 cifre'; end if;
 if length(p_address::text)>5000 or length(coalesce(p_note,''))>2000 or length(coalesce(p_gift,''))>500 then raise exception 'Testo troppo lungo'; end if;
 select * into strict s from public.store_settings where id=1;
 if p_delivery='pickup' and not s.pickup_enabled then raise exception 'Ritiro non disponibile'; end if;
 if p_payment='pickup' and p_delivery<>'pickup' then raise exception 'Il pagamento al ritiro richiede il ritiro in sede'; end if;
 if p_payment='stripe' and not s.card_enabled then raise exception 'Pagamento con carta non attivo'; end if;
 if p_payment='bank_transfer' and (not s.bank_enabled or trim(s.bank_details)='') then raise exception 'Bonifico non attivo'; end if;
 select email into v_email from auth.users where id=auth.uid();
 insert into public.orders(user_id,customer_email,shipping_address,delivery_method,payment_provider,note,gift_message,request_id)
 values(auth.uid(),v_email,p_address,p_delivery,p_payment,nullif(trim(p_note),''),nullif(trim(p_gift),''),p_request_id) returning id into v_id;
 -- Ordine deterministico dei lock: richieste concorrenti non possono vendere oltre lo stock.
 for r in select product_id,sum(quantity)::integer as quantity from jsonb_to_recordset(p_items) as x(product_id uuid,quantity integer) group by product_id order by product_id
 loop
  if r.product_id is null or r.quantity is null or r.quantity not between 1 and 99 then raise exception 'Quantità non valida'; end if;
  -- Rifiuta anche righe negative/nulle che potrebbero essere nascoste da una somma.
  if exists(select 1 from jsonb_to_recordset(p_items) as x(product_id uuid,quantity integer) where quantity is null or quantity not between 1 and 99) then raise exception 'Quantità non valida'; end if;
  select * into p from public.products where id=r.product_id and is_active for update;
  if not found or p.purchase_mode='quote' then raise exception 'Un articolo non è più acquistabile'; end if;
  if p.stock<r.quantity then raise exception 'Disponibilità insufficiente per %: restano % pezzi',p.name,p.stock; end if;
  insert into public.order_items(order_id,product_id,product_name,quantity,unit_price) values(v_id,p.id,p.name,r.quantity,p.price);
  update public.products set stock=stock-r.quantity where id=p.id;
  v_sub:=v_sub+p.price*r.quantity;
  delete from public.cart_items where user_id=auth.uid() and product_id=p.id and quantity<=r.quantity;
  update public.cart_items set quantity=quantity-r.quantity where user_id=auth.uid() and product_id=p.id;
 end loop;
 if nullif(trim(p_coupon),'') is not null then v_coupon:=public.check_coupon(p_coupon,v_sub); v_discount:=round(v_sub*(v_coupon->>'percent_off')::numeric/100,2); end if;
 if p_delivery='shipping' and v_sub-v_discount<s.free_shipping_threshold then v_ship:=s.shipping_fee; end if;
 update public.orders set subtotal=v_sub,discount_amount=v_discount,shipping_amount=v_ship,total_amount=v_sub-v_discount+v_ship,coupon_code=v_coupon->>'code' where id=v_id;
 insert into public.payments(order_id,user_id,provider,amount) values(v_id,auth.uid(),p_payment,v_sub-v_discount+v_ship);
 return jsonb_build_object('id',v_id,'total_amount',v_sub-v_discount+v_ship);
end $$;

-- Funzione interna: mai invocabile dal browser. Annullamento e reintegro una volta sola.
create or replace function public.release_order_stock(p_order_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype; r record;
begin
 select * into o from public.orders where id=p_order_id for update;
 if not found then raise exception 'Ordine non trovato'; end if;
 if o.payment_status='paid' then raise exception 'Ordine pagato: serve prima un rimborso tramite il provider'; end if;
 if not o.stock_released then
  for r in select product_id,sum(quantity)::integer as qty from public.order_items where order_id=p_order_id and product_id is not null group by product_id order by product_id
  loop update public.products set stock=stock+r.qty where id=r.product_id; end loop;
 end if;
 update public.orders set status='cancelled',stock_released=true where id=p_order_id;
 update public.payments set status='failed',updated_at=now() where order_id=p_order_id and status<>'paid';
end $$;
create or replace function public.cancel_order(p_order_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype;
begin
 if not public.is_active_user() then raise exception 'Account non autorizzato'; end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found or (o.user_id<>auth.uid() and not public.is_staff()) then raise exception 'Ordine non autorizzato'; end if;
 if o.status='cancelled' then return; end if;
 if o.status<>'pending' and not public.is_staff() then raise exception 'Ordine già in lavorazione. Contatta lo staff'; end if;
 if o.payment_provider='stripe' then raise exception 'Gli ordini con carta vanno annullati dalla gestione pagamenti'; end if;
 perform public.release_order_stock(p_order_id);
end $$;
create or replace function public.staff_order_update(p_order_id uuid,p_status text,p_tracking text,p_mark_paid boolean default false) returns void language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype;
begin
 if not public.is_staff() then raise exception 'Operazione riservata allo staff'; end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found then raise exception 'Ordine non trovato'; end if;
 if p_status is null or p_status not in ('pending','confirmed','preparing','shipped','completed','cancelled') then raise exception 'Stato non valido'; end if;
 if o.status='cancelled' then raise exception 'Un ordine annullato non può essere riaperto'; end if;
 if p_status='cancelled' then perform public.cancel_order(p_order_id); return; end if;
 if nullif(p_tracking,'') is not null and (p_tracking !~ '^https://' or length(p_tracking)>1000) then raise exception 'Il tracking deve essere un link HTTPS'; end if;
 if p_mark_paid and o.payment_provider='stripe' then raise exception 'I pagamenti Stripe vengono verificati automaticamente'; end if;
 if o.payment_provider='stripe' and o.payment_status<>'paid' and p_status<>'pending' then raise exception 'Attendi la conferma del pagamento Stripe'; end if;
 update public.orders set status=p_status,tracking_url=nullif(p_tracking,''),payment_status=case when p_mark_paid then 'paid' else payment_status end,paid_at=case when p_mark_paid then coalesce(paid_at,now()) else paid_at end where id=p_order_id;
 if p_mark_paid then update public.payments set status='paid',updated_at=now() where order_id=p_order_id; end if;
 insert into public.staff_audit(actor_id,action,target_id) values(auth.uid(),'order_updated',p_order_id);
end $$;
create or replace function public.request_quote(p_product_id uuid,p_message text,p_phone text) returns void language plpgsql security definer set search_path = public as $$
declare p public.products%rowtype;
begin
 if not public.is_active_user() then raise exception 'Account non autorizzato'; end if;
 if coalesce(length(trim(p_message)),0) not between 10 and 2000 or coalesce(length(trim(p_phone)),0) not between 6 and 40 then raise exception 'Inserisci un messaggio e un telefono valido'; end if;
 select * into p from public.products where id=p_product_id and is_active and purchase_mode='quote';
 if not found then raise exception 'Preventivo non disponibile per questo articolo'; end if;
 insert into public.quote_requests(user_id,product_id,product_name,message,phone) values(auth.uid(),p.id,p.name,trim(p_message),trim(p_phone));
end $$;

-- Chiamate esclusivamente dal Worker con segreto server: importi sempre confrontati con l'ordine.
create or replace function public.attach_stripe_session(p_order_id uuid,p_session_id text) returns void language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype;
begin
 select * into o from public.orders where id=p_order_id for update;
 if not found or o.payment_provider<>'stripe' or o.status<>'pending' or o.payment_status='paid' then raise exception 'Ordine non pagabile'; end if;
 if o.payment_reference is not null and o.payment_reference<>p_session_id then raise exception 'Sessione di pagamento già assegnata'; end if;
 update public.orders set payment_reference=p_session_id,payment_status='pending' where id=p_order_id;
 update public.payments set external_reference=p_session_id,updated_at=now() where order_id=p_order_id;
end $$;
create or replace function public.stripe_event(p_event_id text,p_order_id uuid,p_session_id text,p_paid boolean,p_expired boolean,p_amount bigint,p_currency text) returns void language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype;
begin
 select * into o from public.orders where id=p_order_id for update;
 if not found or o.payment_provider<>'stripe' or o.payment_reference is distinct from p_session_id then raise exception 'Riferimento pagamento non valido'; end if;
 if p_currency is distinct from 'eur' or p_amount is distinct from round(o.total_amount*100)::bigint then raise exception 'Importo pagamento non corrispondente'; end if;
 insert into public.stripe_events(id) values(p_event_id) on conflict do nothing;
 if not found then return; end if;
 if p_paid then
  if o.stock_released or o.status='cancelled' then raise exception 'Ordine annullato: verificare il pagamento e rimborsare'; end if;
  update public.orders set payment_status='paid',paid_at=coalesce(paid_at,now()),status=case when status='pending' then 'confirmed' else status end where id=p_order_id;
  update public.payments set status='paid',updated_at=now() where order_id=p_order_id;
 elsif p_expired and o.payment_status<>'paid' then perform public.release_order_stock(p_order_id);
 end if;
end $$;

-- Revoca il vecchio checkout che non conosce ruoli bloccati, indirizzi e promozioni.
do $$ begin if to_regprocedure('public.place_order(jsonb,text,text)') is not null then execute 'revoke all on function public.place_order(jsonb,text,text) from public,anon,authenticated'; end if; end $$;
revoke all on function public.release_order_stock(uuid),public.attach_stripe_session(uuid,text),public.stripe_event(text,uuid,text,boolean,boolean,bigint,text) from public,anon,authenticated;
grant execute on function public.release_order_stock(uuid),public.attach_stripe_session(uuid,text),public.stripe_event(text,uuid,text,boolean,boolean,bigint,text) to service_role;
do $$ declare r record; begin
 for r in select oid::regprocedure as f from pg_proc where pronamespace='public'::regnamespace and proname in ('is_active_user','is_staff','is_admin','update_own_profile','staff_user_update','set_cart_quantity','check_coupon','checkout_order','cancel_order','staff_order_update','request_quote')
 loop execute format('revoke all on function %s from public,anon',r.f); execute format('grant execute on function %s to authenticated,service_role',r.f); end loop;
end $$;

-- Foto pubbliche, caricamento e modifica riservati allo staff attivo.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('products','products',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
drop policy if exists "Public can view product images" on storage.objects;
drop policy if exists "Staff can upload product images" on storage.objects;
drop policy if exists "Staff can update product images" on storage.objects;
drop policy if exists "Staff can delete product images" on storage.objects;
create policy "Public can view product images" on storage.objects for select using(bucket_id='products');
create policy "Staff can upload product images" on storage.objects for insert to authenticated with check(bucket_id='products' and public.is_staff());
create policy "Staff can update product images" on storage.objects for update to authenticated using(bucket_id='products' and public.is_staff()) with check(bucket_id='products' and public.is_staff());
create policy "Staff can delete product images" on storage.objects for delete to authenticated using(bucket_id='products' and public.is_staff());
notify pgrst, 'reload schema';
commit;

-- SOLO per il primo staff: crea prima l'account dal sito, poi esegui questa query
-- sostituendo l'indirizzo con la TUA email. I successivi ruoli si gestiscono dal sito.
-- update public.profiles set role='staff',is_blocked=false where id=(select id from auth.users where email='LA-TUA-EMAIL');
