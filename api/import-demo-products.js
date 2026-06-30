const {
  productFromDb,
  requireAdmin,
  requireSupabase,
  sendJson,
  supabaseRest,
} = require("./_utils");

const demoProducts = [
  {
    name: "Bolsa Elegance",
    price: 189.9,
    description: "Bolsa sofisticada para compor looks elegantes.",
    category: "Bolsas",
    image_url: "assets/bolsa-elegance.jpg",
    is_offer: true,
    is_available: true,
    sort_order: 1,
  },
  {
    name: "Bolsa Casual Chic",
    price: 180,
    description: "Praticidade e elegancia para o dia a dia.",
    category: "Bolsas",
    image_url: "assets/bolsa-casual-chic.jpg",
    is_offer: false,
    is_available: true,
    sort_order: 2,
  },
  {
    name: "Kit Presente Especial",
    price: 149.9,
    description: "Uma opcao charmosa para surpreender em datas especiais.",
    category: "Presentes",
    image_url: "assets/bolsa-tote.jpg",
    is_offer: true,
    is_available: true,
    sort_order: 3,
  },
  {
    name: "Perfume Feminino Premium",
    price: 129.9,
    description: "Fragrancia marcante e sofisticada.",
    category: "Perfumaria",
    image_url: "assets/bolsa-classica.jpg",
    is_offer: false,
    is_available: true,
    sort_order: 4,
  },
  {
    name: "Acessorio Dourado",
    price: 59.9,
    description: "Detalhe delicado para valorizar sua producao.",
    category: "Acessórios",
    image_url: "assets/hero-bolsa-preta.jpg",
    is_offer: false,
    is_available: true,
    sort_order: 5,
  },
  {
    name: "Bolsa Classica",
    price: 169.9,
    description: "Modelo atemporal para diversas ocasioes.",
    category: "Bolsas",
    image_url: "assets/bolsa-classica.jpg",
    is_offer: false,
    is_available: false,
    sort_order: 6,
  },
];

async function findExisting(product) {
  const name = encodeURIComponent(product.name);
  const category = encodeURIComponent(product.category);
  const rows = await supabaseRest(`products?select=*&name=eq.${name}&category=eq.${category}&limit=1`);
  return rows[0] || null;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Metodo nao permitido." });
  }

  if (!requireAdmin(req, res) || !requireSupabase(res)) return;

  try {
    const imported = [];
    const skipped = [];

    for (const product of demoProducts) {
      const existing = await findExisting(product);
      if (existing) {
        skipped.push(productFromDb(existing));
        continue;
      }

      const rows = await supabaseRest("products", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(product),
      });
      imported.push(productFromDb(rows[0]));
    }

    return sendJson(res, 200, { imported, skipped });
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
};
