const {
  productFromDb,
  requireAdmin,
  requireSupabase,
  sendJson,
  supabaseRest,
} = require("./_utils");
const { demoProducts } = require("./_demo-products");

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
