create extension if not exists pgcrypto;

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

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin'
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role';
$$;

alter table public.product_images enable row level security;
alter table public.product_images no force row level security;

grant usage on schema public to anon, authenticated, service_role;
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant all privileges on public.products to service_role;
grant select on public.product_images to anon, authenticated;
grant insert, update, delete on public.product_images to authenticated;
grant all privileges on public.product_images to service_role;

drop policy if exists "Public can read product images" on public.product_images;
drop policy if exists "Admins can manage product images" on public.product_images;
drop policy if exists "Service role can manage product images" on public.product_images;

create policy "Public can read product images"
on public.product_images
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.products p
    where p.id = product_images.product_id
      and p.is_available = true
  )
);

create policy "Admins can manage product images"
on public.product_images
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Service role can manage product images"
on public.product_images
for all
to service_role
using (true)
with check (true);

drop policy if exists "Admins can manage products" on public.products;
drop policy if exists "Service role can manage products" on public.products;

create policy "Admins can manage products"
on public.products
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Service role can manage products"
on public.products
for all
to service_role
using (true)
with check (true);

insert into storage.buckets (id, name, public)
values ('products', 'products', true)
on conflict (id) do update set public = excluded.public;

grant usage on schema storage to anon, authenticated, service_role;
grant select on storage.objects to anon, authenticated;
grant insert, update, delete on storage.objects to authenticated;
grant all privileges on storage.objects to service_role;

drop policy if exists "Public can read products bucket" on storage.objects;
drop policy if exists "Admins can upload products bucket" on storage.objects;
drop policy if exists "Admins can update products bucket" on storage.objects;
drop policy if exists "Admins can delete products bucket" on storage.objects;

create policy "Public can read products bucket"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'products');

create policy "Admins can upload products bucket"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'products' and public.is_admin());

create policy "Admins can update products bucket"
on storage.objects
for update
to authenticated
using (bucket_id = 'products' and public.is_admin())
with check (bucket_id = 'products' and public.is_admin());

create policy "Admins can delete products bucket"
on storage.objects
for delete
to authenticated
using (bucket_id = 'products' and public.is_admin());
