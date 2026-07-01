alter table public.store_testimonials enable row level security;
alter table public.store_testimonials no force row level security;

grant usage on schema public to anon, authenticated, service_role;
grant select on public.store_testimonials to anon, authenticated;
grant insert, update, delete on public.store_testimonials to authenticated;
grant all privileges on public.store_testimonials to service_role;

drop policy if exists "Public can read store testimonials" on public.store_testimonials;
create policy "Public can read store testimonials"
on public.store_testimonials
for select
to anon, authenticated
using (is_active = true);

drop policy if exists "Admins can manage store testimonials" on public.store_testimonials;
create policy "Admins can manage store testimonials"
on public.store_testimonials
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Service role can manage store testimonials" on public.store_testimonials;
create policy "Service role can manage store testimonials"
on public.store_testimonials
for all
to service_role
using (true)
with check (true);
