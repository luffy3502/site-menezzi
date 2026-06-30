create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10, 2) not null default 0,
  description text not null default '',
  category text not null default 'Sem categoria',
  image_url text not null default '',
  is_offer boolean not null default false,
  is_available boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

drop policy if exists "Public can read available products" on public.products;
create policy "Public can read available products"
on public.products
for select
using (is_available = true);

-- Admin writes are performed by Vercel serverless functions using SUPABASE_SERVICE_ROLE_KEY.

insert into storage.buckets (id, name, public)
values ('products', 'products', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public can read products bucket" on storage.objects;
create policy "Public can read products bucket"
on storage.objects
for select
using (bucket_id = 'products');
