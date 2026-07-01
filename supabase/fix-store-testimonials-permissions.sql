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

alter table public.store_testimonials
  add column if not exists city text not null default '',
  add column if not exists image_url text not null default '',
  add column if not exists rating integer not null default 5,
  add column if not exists comment text not null default '',
  add column if not exists is_active boolean not null default true,
  add column if not exists sort_order integer not null default 0,
  add column if not exists created_at timestamptz not null default now();

alter table public.store_testimonials enable row level security;
alter table public.store_testimonials no force row level security;

grant usage on schema public to anon, authenticated, service_role;
grant select on public.store_testimonials to anon, authenticated;
grant insert, update, delete on public.store_testimonials to authenticated;
grant all privileges on public.store_testimonials to service_role;

drop policy if exists "Public can read store testimonials" on public.store_testimonials;
drop policy if exists "Admins can manage store testimonials" on public.store_testimonials;
drop policy if exists "Service role can manage store testimonials" on public.store_testimonials;

create policy "Public can read store testimonials"
on public.store_testimonials
for select
to anon, authenticated
using (is_active = true);

create policy "Admins can manage store testimonials"
on public.store_testimonials
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Service role can manage store testimonials"
on public.store_testimonials
for all
to service_role
using (true)
with check (true);
