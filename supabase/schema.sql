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

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null default '',
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists product_images_product_sort_idx
  on public.product_images (product_id, sort_order, created_at);

insert into public.product_images (product_id, image_url, sort_order, is_primary)
select p.id, p.image_url, 1, true
from public.products p
where p.image_url <> ''
  and not exists (
    select 1
    from public.product_images pi
    where pi.product_id = p.id
  );

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
alter table public.product_images enable row level security;

drop policy if exists "Public can read available products" on public.products;
create policy "Public can read available products"
on public.products
for select
using (is_available = true);

drop policy if exists "Public can read product images" on public.product_images;
create policy "Public can read product images"
on public.product_images
for select
using (true);

-- Admin writes are performed by Vercel serverless functions using SUPABASE_SERVICE_ROLE_KEY.

insert into storage.buckets (id, name, public)
values ('products', 'products', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public can read products bucket" on storage.objects;
create policy "Public can read products bucket"
on storage.objects
for select
using (bucket_id = 'products');

create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  image_url text not null default '',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.product_categories
  add column if not exists image_url text not null default '',
  add column if not exists is_active boolean not null default true;

create table if not exists public.store_gallery (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  caption text not null default '',
  image_url text not null default '',
  is_active boolean not null default true,
  is_cover boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.store_gallery
  add column if not exists caption text not null default '',
  add column if not exists is_active boolean not null default true,
  add column if not exists is_cover boolean not null default false;

create table if not exists public.store_testimonials (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  city text not null default '',
  image_url text not null default '',
  rating integer not null default 5,
  comment text not null default '',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.store_instagram (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  image_url text not null default '',
  link_url text not null default '',
  is_active boolean not null default true,
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
alter table public.store_testimonials enable row level security;
alter table public.store_instagram enable row level security;

drop policy if exists "Public can read product categories" on public.product_categories;
create policy "Public can read product categories"
on public.product_categories
for select
using (true);

drop policy if exists "Public can read store gallery" on public.store_gallery;
create policy "Public can read store gallery"
on public.store_gallery
for select
using (true);

drop policy if exists "Public can read store settings" on public.store_settings;
create policy "Public can read store settings"
on public.store_settings
for select
using (true);

drop policy if exists "Public can read store testimonials" on public.store_testimonials;
create policy "Public can read store testimonials"
on public.store_testimonials
for select
using (true);

drop policy if exists "Public can read store instagram" on public.store_instagram;
create policy "Public can read store instagram"
on public.store_instagram
for select
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
