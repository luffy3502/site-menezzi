insert into public.products
  (name, price, description, category, image_url, offer_type, is_offer, is_available, sort_order)
select
  seed.name,
  seed.price,
  seed.description,
  seed.category,
  seed.image_url,
  seed.offer_type,
  seed.is_offer,
  seed.is_available,
  seed.sort_order
from (
  values
    ('Bolsa Elegance', 189.90, 'Bolsa sofisticada para compor looks elegantes.', 'Bolsas', 'assets/bolsa-elegance.jpg', 'oferta_semana', true, true, 1),
    ('Bolsa Casual Chic', 180.00, 'Praticidade e elegancia para o dia a dia.', 'Bolsas', 'assets/bolsa-casual-chic.jpg', 'sem_oferta', false, true, 2),
    ('Kit Presente Especial', 149.90, 'Uma opcao charmosa para surpreender em datas especiais.', 'Presentes', 'assets/bolsa-tote.jpg', 'oferta_semana', true, true, 3),
    ('Perfume Feminino Premium', 129.90, 'Fragrancia marcante e sofisticada.', 'Perfumes', 'assets/bolsa-classica.jpg', 'sem_oferta', false, true, 4),
    ('Acessorio Dourado', 59.90, 'Detalhe delicado para valorizar sua producao.', 'Acessorios', 'assets/hero-bolsa-preta.jpg', 'sem_oferta', false, true, 5),
    ('Bolsa Classica', 169.90, 'Modelo atemporal para diversas ocasioes.', 'Bolsas', 'assets/bolsa-classica.jpg', 'sem_oferta', false, false, 6)
) as seed(name, price, description, category, image_url, offer_type, is_offer, is_available, sort_order)
where not exists (
  select 1
  from public.products existing
  where existing.name = seed.name
    and existing.category = seed.category
);
