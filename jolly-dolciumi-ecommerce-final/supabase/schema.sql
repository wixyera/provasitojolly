-- Jolly Dolciumi · schema Supabase
-- Esegui tutto questo file nel SQL Editor del nuovo progetto Supabase.
-- Nel browser va usata solo la chiave publishable/anon: mai sb_secret_...

create extension if not exists pgcrypto;

-- Profili applicativi e ruoli.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'customer',
  created_at timestamptz not null default now()
);

-- Compatibilità con eventuali versioni precedenti dello schema.
update public.profiles set role = 'staff' where role = 'admin';
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('customer', 'staff'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Cliente Jolly'
    )
  )
  on conflict (id) do update
    set full_name = coalesce(excluded.full_name, public.profiles.full_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Recupera anche utenti eventualmente creati prima dell'esecuzione dello schema.
insert into public.profiles (id, full_name)
select
  id,
  coalesce(
    nullif(raw_user_meta_data ->> 'full_name', ''),
    nullif(split_part(coalesce(email, ''), '@', 1), ''),
    'Cliente Jolly'
  )
from auth.users
on conflict (id) do nothing;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'staff'
  );
$$;

-- Alias utile se una versione precedente del progetto usava il nome admin.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_staff();
$$;

-- Catalogo.
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  category text not null default 'Caramelle',
  description text not null default '',
  price numeric(10, 2) not null check (price >= 0),
  compare_at_price numeric(10, 2),
  image_url text,
  badge text,
  rating numeric(2, 1) not null default 4.8 check (rating >= 0 and rating <= 5),
  reviews integer not null default 0 check (reviews >= 0),
  stock integer not null default 0 check (stock >= 0),
  featured boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Ordini: il totale viene calcolato dal server tramite place_order().
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  customer_email text not null,
  status text not null default 'pending',
  total_amount numeric(10, 2) not null default 0,
  note text,
  payment_status text not null default 'unpaid',
  payment_provider text,
  payment_reference text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.orders add column if not exists note text;
alter table public.orders add column if not exists payment_status text not null default 'unpaid';
alter table public.orders add column if not exists payment_provider text;
alter table public.orders add column if not exists payment_reference text;
alter table public.orders add column if not exists paid_at timestamptz;
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending', 'confirmed', 'preparing', 'shipped', 'completed', 'cancelled'));
alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check
  check (payment_status in ('unpaid', 'pending', 'paid', 'failed', 'refunded'));

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10, 2) not null check (unit_price >= 0)
);

-- Struttura pronta per Stripe/PayPal/Nexi o altro provider futuro.
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  provider text not null default 'pending',
  status text not null default 'pending',
  amount numeric(10, 2) not null check (amount >= 0),
  external_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check
  check (status in ('pending', 'paid', 'failed', 'refunded'));

create index if not exists products_category_idx on public.products(category);
create index if not exists products_active_featured_idx on public.products(is_active, featured);
create index if not exists orders_user_created_idx on public.orders(user_id, created_at desc);
create index if not exists order_items_order_idx on public.order_items(order_id);
create index if not exists payments_user_idx on public.payments(user_id);

create or replace function public.set_payment_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
  before update on public.payments
  for each row execute procedure public.set_payment_updated_at();

-- Crea un ordine usando quantità, prezzi e disponibilità letti direttamente dal database.
create or replace function public.place_order(
  p_items jsonb,
  p_customer_email text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_order_id uuid;
  v_subtotal numeric(10, 2) := 0;
  v_shipping numeric(10, 2) := 0;
  v_total numeric(10, 2);
  v_item record;
  v_product public.products%rowtype;
  v_quantity integer;
  v_email text;
begin
  if v_user_id is null then
    raise exception 'Devi accedere prima di creare un ordine';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Il carrello è vuoto';
  end if;

  v_email := coalesce(
    nullif(trim(p_customer_email), ''),
    (select email from auth.users where id = v_user_id),
    ''
  );
  if v_email = '' then
    raise exception 'Email cliente non disponibile';
  end if;

  insert into public.orders (user_id, customer_email, status, total_amount, note, payment_status)
  values (v_user_id, v_email, 'pending', 0, nullif(trim(p_note), ''), 'unpaid')
  returning id into v_order_id;

  for v_item in
    select *
    from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer)
  loop
    v_quantity := v_item.quantity;
    if v_item.product_id is null or v_quantity is null or v_quantity < 1 or v_quantity > 99 then
      raise exception 'Quantità prodotto non valida';
    end if;

    select * into v_product
    from public.products
    where id = v_item.product_id and is_active = true
    for update;

    if not found then
      raise exception 'Prodotto non disponibile';
    end if;
    if v_product.stock < v_quantity then
      raise exception 'Disponibilità insufficiente per: %', v_product.name;
    end if;

    insert into public.order_items (order_id, product_id, product_name, quantity, unit_price)
    values (v_order_id, v_product.id, v_product.name, v_quantity, v_product.price);

    update public.products
    set stock = stock - v_quantity
    where id = v_product.id;

    v_subtotal := v_subtotal + (v_product.price * v_quantity);
  end loop;

  v_subtotal := round(v_subtotal, 2);
  if v_subtotal < 39 then
    v_shipping := 4.90;
  end if;
  v_total := round(v_subtotal + v_shipping, 2);

  update public.orders set total_amount = v_total where id = v_order_id;
  insert into public.payments (order_id, user_id, provider, status, amount)
  values (v_order_id, v_user_id, 'pending', 'pending', v_total);

  return jsonb_build_object('id', v_order_id, 'total_amount', v_total);
end;
$$;

revoke all on function public.place_order(jsonb, text, text) from public;
grant execute on function public.place_order(jsonb, text, text) to authenticated;

-- Row Level Security: il catalogo e gli ordini richiedono sempre un account.
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;

drop policy if exists "Users can view their profile" on public.profiles;
drop policy if exists "Staff can view all profiles" on public.profiles;
create policy "Users and staff can view profiles"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());

drop policy if exists "Active products are public" on public.products;
drop policy if exists "Authenticated users can view products" on public.products;
drop policy if exists "Staff can insert products" on public.products;
drop policy if exists "Admins can insert products" on public.products;
drop policy if exists "Staff can update products" on public.products;
drop policy if exists "Admins can update products" on public.products;
drop policy if exists "Staff can delete products" on public.products;
drop policy if exists "Admins can delete products" on public.products;
create policy "Authenticated users can view products"
  on public.products for select to authenticated
  using (is_active = true or public.is_staff());
create policy "Staff can insert products"
  on public.products for insert to authenticated
  with check (public.is_staff());
create policy "Staff can update products"
  on public.products for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy "Staff can delete products"
  on public.products for delete to authenticated
  using (public.is_staff());

drop policy if exists "Users can view their orders" on public.orders;
drop policy if exists "Staff can view all orders" on public.orders;
drop policy if exists "Customers can create their orders" on public.orders;
drop policy if exists "Staff can update orders" on public.orders;
create policy "Customers and staff can view orders"
  on public.orders for select to authenticated
  using (user_id = auth.uid() or public.is_staff());
create policy "Staff can update orders"
  on public.orders for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists "Users can view items from their orders" on public.order_items;
drop policy if exists "Staff can view all order items" on public.order_items;
drop policy if exists "Customers can create their order items" on public.order_items;
create policy "Customers and staff can view order items"
  on public.order_items for select to authenticated
  using (
    public.is_staff()
    or exists (
      select 1 from public.orders
      where public.orders.id = order_items.order_id
        and public.orders.user_id = auth.uid()
    )
  );

drop policy if exists "Users can view their payments" on public.payments;
drop policy if exists "Staff can view all payments" on public.payments;
drop policy if exists "Staff can update payments" on public.payments;
create policy "Customers and staff can view payments"
  on public.payments for select to authenticated
  using (user_id = auth.uid() or public.is_staff());
create policy "Staff can update payments"
  on public.payments for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- Bucket pubblico solo per le immagini prodotto; scrittura consentita allo staff.
insert into storage.buckets (id, name, public)
values ('products', 'products', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can view product images" on storage.objects;
drop policy if exists "Staff can upload product images" on storage.objects;
drop policy if exists "Staff can update product images" on storage.objects;
drop policy if exists "Staff can delete product images" on storage.objects;
create policy "Public can view product images"
  on storage.objects for select
  using (bucket_id = 'products');
create policy "Staff can upload product images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'products' and public.is_staff());
create policy "Staff can update product images"
  on storage.objects for update to authenticated
  using (bucket_id = 'products' and public.is_staff())
  with check (bucket_id = 'products' and public.is_staff());
create policy "Staff can delete product images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'products' and public.is_staff());

-- Prodotti demo: non sovrascrive eventuali dati già inseriti.
insert into public.products (name, slug, category, description, price, compare_at_price, badge, rating, reviews, stock, featured)
values
  ('Party Mix Rainbow', 'party-mix-rainbow', 'Gommose', 'Un mix colorato di caramelle gommose, frutta e zucchero frizzante.', 8.90, 10.90, 'Bestseller', 4.9, 128, 60, true),
  ('Pistacchio Crunch', 'pistacchio-crunch', 'Cioccolato', 'Cioccolato al latte, pistacchio croccante e un finale leggermente salato.', 12.50, null, 'Nuovo', 4.8, 64, 32, true),
  ('Sour Galaxy', 'sour-galaxy', 'Caramelle', 'Nastri sour alla frutta con un’esplosione acidula.', 6.50, null, 'Acidissime', 4.7, 92, 45, false),
  ('Jolly Box', 'jolly-box', 'Box regalo', 'Una selezione sorpresa di dolcezze Jolly, pronta da regalare.', 24.90, 29.90, 'Regalo', 5.0, 38, 18, true),
  ('Marshmallow Cloud', 'marshmallow-cloud', 'Gommose', 'Nuvolette soffici, leggere e irresistibilmente vanigliate.', 7.90, null, null, 4.6, 51, 70, false),
  ('Choco Pop', 'choco-pop', 'Cioccolato', 'Bocconi croccanti ricoperti di cioccolato e granella.', 9.90, null, 'Crunch', 4.8, 77, 40, false),
  ('Fruit Rings', 'fruit-rings', 'Caramelle', 'Anelli alla frutta dai colori vivaci e dal gusto pieno.', 5.90, null, null, 4.5, 32, 90, false),
  ('Pick & Mix', 'pick-and-mix', 'Box regalo', 'Componi il tuo assortimento personale di caramelle preferite.', 16.90, null, 'Il tuo mix', 4.9, 86, 25, true)
on conflict (slug) do nothing;

-- Dopo aver creato l'account staff, sostituisci l'email nella query seguente:
-- update public.profiles
-- set role = 'staff'
-- where id = (select id from auth.users where email = 'la-tua-email@example.com');
