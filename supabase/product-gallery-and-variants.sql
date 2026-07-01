create extension if not exists pgcrypto;

create or replace function public.jsonb_text_array(value jsonb)
returns text[]
language sql
immutable
as $$
  select coalesce(array_agg(item), '{}'::text[])
  from jsonb_array_elements_text(
    case when jsonb_typeof(value) = 'array' then value else '[]'::jsonb end
  ) as item;
$$;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'additional_images'
  ) then
    alter table public.products add column additional_images text[] not null default '{}';
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'additional_images'
      and udt_name <> '_text'
  ) then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'products'
        and column_name = 'additional_images'
        and data_type = 'jsonb'
    ) then
      alter table public.products
        alter column additional_images type text[]
        using public.jsonb_text_array(additional_images);
    else
      alter table public.products
        alter column additional_images type text[]
        using '{}'::text[];
    end if;
  end if;
  alter table public.products alter column additional_images set default '{}';
  update public.products set additional_images = '{}' where additional_images is null;
  alter table public.products alter column additional_images set not null;
end $$;

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

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  color_name text not null default '',
  image_url text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists product_variants_product_sort_idx
  on public.product_variants (product_id, sort_order, created_at);

insert into public.product_images (product_id, image_url, sort_order, is_primary)
select p.id, p.image_url, 1, true
from public.products p
where p.image_url <> ''
  and not exists (
    select 1
    from public.product_images pi
    where pi.product_id = p.id
  );

update public.products p
set additional_images = coalesce(images.urls, '{}')
from (
  select product_id, array_agg(image_url order by sort_order, created_at) filter (where not is_primary) as urls
  from public.product_images
  group by product_id
) images
where images.product_id = p.id;

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
alter table public.product_variants enable row level security;
alter table public.product_images no force row level security;
alter table public.product_variants no force row level security;

grant usage on schema public to anon, authenticated, service_role;
grant select on public.product_images to anon, authenticated;
grant insert, update, delete on public.product_images to authenticated;
grant all privileges on public.product_images to service_role;
grant select on public.product_variants to anon, authenticated;
grant insert, update, delete on public.product_variants to authenticated;
grant all privileges on public.product_variants to service_role;

drop policy if exists "Public can read product images" on public.product_images;
drop policy if exists "Admins can manage product images" on public.product_images;
drop policy if exists "Service role can manage product images" on public.product_images;
drop policy if exists "Public can read product variants" on public.product_variants;
drop policy if exists "Admins can manage product variants" on public.product_variants;
drop policy if exists "Service role can manage product variants" on public.product_variants;

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

create policy "Public can read product variants"
on public.product_variants
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.products p
    where p.id = product_variants.product_id
      and p.is_available = true
  )
);

create policy "Admins can manage product variants"
on public.product_variants
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Service role can manage product variants"
on public.product_variants
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
