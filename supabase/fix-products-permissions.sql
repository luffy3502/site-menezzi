create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10, 2) not null default 0,
  description text not null default '',
  category text not null default 'Sem categoria',
  image_url text not null default '',
  offer_type text not null default 'sem_oferta',
  is_offer boolean not null default false,
  is_available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products
  add column if not exists offer_type text not null default 'sem_oferta';

update public.products
set offer_type = case when is_offer then 'oferta_semana' else 'sem_oferta' end
where offer_type is null or offer_type = '';

create index if not exists products_available_sort_idx
  on public.products (is_available, sort_order, created_at);

create or replace function public.set_products_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists products_updated_at on public.products;

create trigger products_updated_at
before update on public.products
for each row
execute function public.set_products_updated_at();

alter table public.products enable row level security;
alter table public.products no force row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'products'
  loop
    execute format('drop policy if exists %I on public.products', policy_record.policyname);
  end loop;
end $$;

revoke all on public.products from anon;
revoke all on public.products from authenticated;
revoke all on public.products from service_role;

grant usage on schema public to anon, authenticated, service_role;
grant select on public.products to anon, authenticated;
grant all privileges on public.products to service_role;

create policy products_public_select_available
on public.products
for select
to anon, authenticated
using (is_available = true);

-- Admin INSERT, UPDATE and DELETE must be executed only by Vercel API routes
-- using SUPABASE_SERVICE_ROLE_KEY. Do not create public write policies.

insert into storage.buckets (id, name, public)
values ('products', 'products', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public can read products bucket" on storage.objects;

create policy "Public can read products bucket"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'products');

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.store_gallery (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  image_url text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.store_settings (
  id text primary key default 'main',
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.product_categories enable row level security;
alter table public.store_gallery enable row level security;
alter table public.store_settings enable row level security;

grant select on public.product_categories to anon, authenticated;
grant select on public.store_gallery to anon, authenticated;
grant select on public.store_settings to anon, authenticated;
grant all privileges on public.product_categories to service_role;
grant all privileges on public.store_gallery to service_role;
grant all privileges on public.store_settings to service_role;

drop policy if exists "Public can read product categories" on public.product_categories;
create policy "Public can read product categories"
on public.product_categories
for select
to anon, authenticated
using (true);

drop policy if exists "Public can read store gallery" on public.store_gallery;
create policy "Public can read store gallery"
on public.store_gallery
for select
to anon, authenticated
using (true);

drop policy if exists "Public can read store settings" on public.store_settings;
create policy "Public can read store settings"
on public.store_settings
for select
to anon, authenticated
using (true);

insert into public.product_categories (name, sort_order)
values
  ('Bolsas', 1),
  ('Carteiras', 2),
  ('Mochilas', 3),
  ('Acessorios', 4),
  ('Promocoes', 5),
  ('Outros', 6)
on conflict (name) do nothing;
