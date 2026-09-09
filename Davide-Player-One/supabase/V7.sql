-- V7: eseguire dopo AGGIORNAMENTO.sql (già inclusa nel file completo).
begin;
-- Kit: ogni componente è un prodotto reale. I kit annidati sono esclusi.
alter table public.order_items add column if not exists component_snapshot jsonb not null default '[]';
create or replace function public.validate_product_data() returns trigger language plpgsql set search_path=public as $$
declare x jsonb; component public.products%rowtype;
begin
 if length(trim(new.name))<2 then raise exception 'Il nome deve avere almeno due caratteri'; end if;
 for x in select * from jsonb_array_elements(new.quantity_discounts) loop
  if (x->>'min_quantity')::integer < 2 or (x->>'percent_off')::numeric not between 0.01 and 89.99 or x->>'min_quantity' is null or x->>'percent_off' is null then raise exception 'Sconto quantità non valido'; end if;
 end loop;
 for x in select * from jsonb_array_elements(new.bundle_items) loop
  if not (x ? 'product_id') then raise exception 'Collega i componenti del kit tramite SKU o ID articolo'; end if;
  select * into component from public.products where id=(x->>'product_id')::uuid;
  if not found or component.id=new.id or jsonb_array_length(component.bundle_items)>0 or component.purchase_mode='quote' or not component.is_active then raise exception 'Componente non valido: usa un articolo attivo, acquistabile, che non sia un kit'; end if;
  if (x->>'quantity')::integer not between 1 and 99 or x->>'quantity' is null then raise exception 'Quantità componente non valida'; end if;
 end loop;
 if jsonb_array_length(new.bundle_items)>0 and exists(select 1 from public.products p, jsonb_array_elements(p.bundle_items) b(value) where b.value->>'product_id'=new.id::text and p.id<>new.id) then raise exception 'Questo articolo è già un componente: non può diventare un kit'; end if;
 return new;
end $$;
drop trigger if exists validate_product_data on public.products;
create trigger validate_product_data before insert or update of name,quantity_discounts,bundle_items on public.products for each row execute function public.validate_product_data();

create or replace function public.available_stock(p_id uuid) returns integer language plpgsql stable security definer set search_path=public as $$
declare p public.products%rowtype; r record; available integer; c public.products%rowtype;
begin
 select * into p from public.products where id=p_id;
 if not found or not p.is_active then return 0; end if;
 available:=p.stock;
 for r in select (x->>'product_id')::uuid id,sum((x->>'quantity')::integer)::integer qty from jsonb_array_elements(p.bundle_items) x where x ? 'product_id' group by 1 loop
  select * into c from public.products where id=r.id;
  if not found or not c.is_active or c.purchase_mode='quote' then return 0; end if;
  available:=least(available,c.stock/r.qty);
 end loop;
 return available;
end $$;
revoke all on function public.available_stock(uuid) from public,anon;
grant execute on function public.available_stock(uuid) to authenticated,service_role;
-- RPC conserva lo stock fisico per staff e aggiunge la disponibilità vendibile.
create or replace function public.catalog_stock() returns table(id uuid,available integer) language sql stable security definer set search_path=public as $$
 select p.id,public.available_stock(p.id) from public.products p where public.is_active_user() and (p.is_active or public.is_staff());
$$;
revoke all on function public.catalog_stock() from public,anon;
grant execute on function public.catalog_stock() to authenticated,service_role;

create or replace function public.consume_kit() returns trigger language plpgsql security definer set search_path=public as $$
declare r record; c public.products%rowtype; parts jsonb;
begin
 select bundle_items into parts from public.products where id=new.product_id;
 for r in select (x->>'product_id')::uuid id,sum((x->>'quantity')::integer)::integer qty from jsonb_array_elements(coalesce(parts,'[]')) x where x ? 'product_id' group by 1 order by 1 loop
  select * into c from public.products where id=r.id for update;
  if not found or not c.is_active or c.purchase_mode='quote' or c.stock<r.qty*new.quantity then raise exception 'Componente kit non disponibile: %',coalesce(c.name,r.id::text); end if;
  update public.products set stock=stock-r.qty*new.quantity where id=r.id;
  new.component_snapshot:=new.component_snapshot||jsonb_build_array(jsonb_build_object('product_id',r.id,'quantity',r.qty*new.quantity));
 end loop;
 return new;
end $$;
drop trigger if exists consume_kit on public.order_items;
create trigger consume_kit before insert on public.order_items for each row execute function public.consume_kit();
create or replace function public.restore_kit() returns trigger language plpgsql security definer set search_path=public as $$
declare r record;
begin
 if new.stock_released and not old.stock_released then
  for r in select (x->>'product_id')::uuid id,sum((x->>'quantity')::integer)::integer qty from public.order_items i,jsonb_array_elements(i.component_snapshot) x where i.order_id=new.id group by 1 order by 1 loop
   update public.products set stock=stock+r.qty where id=r.id;
  end loop;
 end if;
 return new;
end $$;
drop trigger if exists restore_kit on public.orders;
create trigger restore_kit after update of stock_released on public.orders for each row execute function public.restore_kit();
-- Controlla anche componenti condivisi tra più righe del carrello.
create or replace function public.validate_cart_stock() returns trigger language plpgsql security definer set search_path=public as $$
declare r record;
begin
 for r in
  with lines as(select product_id,quantity from public.cart_items where user_id=new.user_id), demands as(
   select product_id id,quantity qty from lines
   union all select (x->>'product_id')::uuid,l.quantity*(x->>'quantity')::integer from lines l join public.products p on p.id=l.product_id cross join lateral jsonb_array_elements(p.bundle_items) x where x ? 'product_id')
  select d.id,sum(qty) qty,p.stock,p.name,p.is_active from demands d join public.products p on p.id=d.id group by d.id,p.stock,p.name,p.is_active
 loop
  if not r.is_active or r.qty>r.stock then raise exception 'Disponibilità insufficiente per % (anche nei kit): % pezzi',r.name,r.stock; end if;
 end loop;
 return new;
end $$;
drop trigger if exists validate_cart_stock on public.cart_items;
create trigger validate_cart_stock after insert or update on public.cart_items for each row execute function public.validate_cart_stock();

-- Traccia automaticamente anche vendite e modifiche dalla scheda prodotto.
alter table public.inventory_movements alter column staff_id drop not null;
create or replace function public.log_stock_change() returns trigger language plpgsql security definer set search_path=public as $$
declare d integer;
begin
 d:=case when tg_op='INSERT' then new.stock else new.stock-old.stock end;
 if d<>0 then insert into public.inventory_movements(product_id,staff_id,delta,reason,note)
 values(new.id,auth.uid(),d,coalesce(nullif(current_setting('jolly.stock_reason',true),''),'correction'),coalesce(nullif(current_setting('jolly.stock_note',true),''),'Aggiornamento giacenza'));
 end if;return new;
end $$;
drop trigger if exists log_stock_change on public.products;
create trigger log_stock_change after insert or update of stock on public.products for each row execute function public.log_stock_change();
-- Outbox: gli eventi sopravvivono a chiusura browser, errori email e webhook.
create table if not exists public.email_outbox(
 id uuid primary key default gen_random_uuid(),event_key text not null unique,recipient text not null,subject text not null,body text not null,
 status text not null default 'pending' check(status in ('pending','processing','sent','failed')),attempts integer not null default 0,
 available_at timestamptz not null default now(),lease_token uuid,sent_at timestamptz,last_error text,created_at timestamptz not null default now()
);
alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from anon,authenticated;
grant select on public.email_outbox to authenticated;
grant all on public.email_outbox to service_role;
drop policy if exists staff_email_read on public.email_outbox;
create policy staff_email_read on public.email_outbox for select to authenticated using(public.is_staff());
create index if not exists email_pending_idx on public.email_outbox(status,available_at);
create or replace function public.queue_order_mail() returns trigger language plpgsql security definer set search_path=public as $$
declare o public.orders%rowtype; key text; title text; state text;
begin
 if tg_table_name='payments' then select * into o from public.orders where id=new.order_id;key:='order:'||o.id;title:='Ordine ricevuto';
 else
  if new.status is not distinct from old.status and new.payment_status is not distinct from old.payment_status and new.tracking_url is not distinct from old.tracking_url then return new; end if;
  o:=new;key:='update:'||o.id||':'||gen_random_uuid();title:='Aggiornamento ordine';
 end if;
 state:=case o.status when 'pending' then 'Da confermare' when 'confirmed' then 'Confermato' when 'preparing' then 'In preparazione' when 'shipped' then 'Spedito' when 'completed' then 'Consegnato' when 'cancelled' then 'Annullato' else o.status end;
 insert into public.email_outbox(event_key,recipient,subject,body) values(key,o.customer_email,'Jolly · '||title,
 'Ordine JL-'||upper(left(o.id::text,8))||E'\nStato: '||state||E'\nTotale: '||o.total_amount||E' EUR\n'||case when o.payment_status='paid' then E'Pagamento ricevuto.\n' else E'Pagamento in attesa.\n' end||coalesce(E'Tracking: '||o.tracking_url,E'')||E'\nAccedi al sito Jolly per i dettagli.') on conflict(event_key) do nothing;
 return new;
end $$;
drop trigger if exists order_mail_created on public.payments;
create trigger order_mail_created after insert on public.payments for each row execute function public.queue_order_mail();
drop trigger if exists order_mail_updated on public.orders;
create trigger order_mail_updated after update of status,payment_status,tracking_url on public.orders for each row execute function public.queue_order_mail();
create or replace function public.claim_emails() returns setof public.email_outbox language plpgsql security definer set search_path=public as $$
begin
 -- Risolve disponibilità anche quando torna disponibile un componente del kit.
 insert into public.email_outbox(event_key,recipient,subject,body)
 select 'stock:'||a.user_id||':'||a.product_id||':'||a.created_at,p.email,'Jolly · Di nuovo disponibile',prod.name||E' è tornato disponibile.\nAccedi al catalogo per acquistarlo: la disponibilità può cambiare.'
 from public.stock_alerts a join public.profiles p on p.id=a.user_id join public.products prod on prod.id=a.product_id
 where not p.is_blocked and public.available_stock(prod.id)>0 on conflict(event_key) do nothing;
 delete from public.stock_alerts a where exists(select 1 from public.email_outbox e where e.event_key='stock:'||a.user_id||':'||a.product_id||':'||a.created_at and e.status='sent');
 update public.email_outbox set status='failed',last_error=coalesce(last_error,'Numero massimo di tentativi raggiunto') where attempts>=15 and status in ('pending','processing') and available_at<=now();
 return query with picked as(select id from public.email_outbox where status in ('pending','processing') and attempts<15 and available_at<=now() order by created_at for update skip locked limit 10)
 update public.email_outbox e set status='processing',attempts=e.attempts+1,lease_token=gen_random_uuid(),available_at=now()+interval '5 minutes' from picked where e.id=picked.id returning e.*;
end $$;
create or replace function public.finish_email(p_id uuid,p_lease uuid,p_error text default null) returns void language plpgsql security definer set search_path=public as $$
begin
 update public.email_outbox set status=case when p_error is null then 'sent' when attempts>=15 then 'failed' else 'pending' end,sent_at=case when p_error is null then now() else null end,last_error=left(p_error,300),available_at=now()+interval '5 minutes',lease_token=null where id=p_id and lease_token=p_lease and status='processing';
end $$;
create or replace function public.retry_failed_emails() returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_staff() then raise exception 'Solo lo staff può ritentare gli invii'; end if;
 update public.email_outbox set status='pending',attempts=0,available_at=now(),lease_token=null where status='failed';
end $$;
revoke all on function public.retry_failed_emails() from public,anon;
grant execute on function public.retry_failed_emails() to authenticated;
revoke all on function public.claim_emails(),public.finish_email(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_emails(),public.finish_email(uuid,uuid,text) to service_role;
-- Solo i dati legali sono pubblici, mai catalogo o utenti.
create table if not exists public.legal_settings(id integer primary key check(id=1),business_name text not null default '',registered_address text not null default '',vat_number text not null default '',contact_email text not null default '',privacy_text text not null default '',terms_text text not null default '',updated_at timestamptz not null default now());
insert into public.legal_settings(id) values(1) on conflict do nothing;
alter table public.legal_settings enable row level security;
grant select on public.legal_settings to anon,authenticated;
grant update on public.legal_settings to authenticated;
drop policy if exists legal_public on public.legal_settings;create policy legal_public on public.legal_settings for select using(true);
drop policy if exists legal_staff on public.legal_settings;create policy legal_staff on public.legal_settings for update to authenticated using(public.is_staff()) with check(public.is_staff());
notify pgrst,'reload schema';
commit;
