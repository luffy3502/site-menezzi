const {
  isSupabaseConfigured,
  productFromDb,
  productToDb,
  readJson,
  requireAdmin,
  requireSupabase,
  sendJson,
  supabaseRest,
} = require("./_utils");
const { demoProducts } = require("./_demo-products");

function supabaseErrorPayload(error) {
  return {
    error: error.message,
    status: error.status,
    statusText: error.statusText,
    supabase: error.supabase,
    request: error.request,
  };
}

async function seedDemoProductsIfEmpty() {
  if (!isSupabaseConfigured()) return [];

  const existingRows = await supabaseRest("products?select=id&limit=1");
  if (existingRows.length) return [];

  const inserted = [];
  for (const product of demoProducts) {
    const rows = await supabaseRest("products", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(product),
    });
    inserted.push(productFromDb(rows[0]));
  }

  return inserted;
}

async function listProducts(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const isAdmin = url.searchParams.get("admin") === "1";

  if (isAdmin) {
    if (!requireAdmin(req, res) || !requireSupabase(res)) return;
    const rows = await supabaseRest("products?select=*&order=sort_order.asc,created_at.desc");
    return sendJson(res, 200, rows.map(productFromDb));
  }

  if (!requireSupabase(res)) return;

  await seedDemoProductsIfEmpty().catch(() => []);

  const rows = await supabaseRest("products?select=*&is_available=eq.true&order=sort_order.asc,created_at.desc");
  return sendJson(res, 200, rows.map(productFromDb));
}

async function createProduct(req, res) {
  if (!requireAdmin(req, res) || !requireSupabase(res)) return;
  const product = productToDb(await readJson(req));
  const rows = await supabaseRest("products", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(product),
  });
  return sendJson(res, 201, productFromDb(rows[0]));
}

async function updateProduct(req, res) {
  if (!requireAdmin(req, res) || !requireSupabase(res)) return;
  const body = await readJson(req);
  if (!body.id) return sendJson(res, 400, { error: "ID obrigatorio." });
  const rows = await supabaseRest(`products?id=eq.${encodeURIComponent(body.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(productToDb(body)),
  });
  return sendJson(res, 200, productFromDb(rows[0]));
}

async function deleteProduct(req, res) {
  if (!requireAdmin(req, res) || !requireSupabase(res)) return;
  const url = new URL(req.url, `http://${req.headers.host}`);
  const id = url.searchParams.get("id");
  if (!id) return sendJson(res, 400, { error: "ID obrigatorio." });
  await supabaseRest(`products?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  return sendJson(res, 200, { ok: true });
}

async function reorderProducts(req, res) {
  if (!requireAdmin(req, res) || !requireSupabase(res)) return;
  const { ids } = await readJson(req);
  if (!Array.isArray(ids)) return sendJson(res, 400, { error: "Lista de IDs obrigatoria." });

  await Promise.all(
    ids.map((id, index) =>
      supabaseRest(`products?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ sort_order: index + 1 }),
      })
    )
  );

  const rows = await supabaseRest("products?select=*&order=sort_order.asc,created_at.desc");
  return sendJson(res, 200, rows.map(productFromDb));
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") return await listProducts(req, res);
    if (req.method === "POST") return await createProduct(req, res);
    if (req.method === "PUT" || req.method === "PATCH") {
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (url.searchParams.get("action") === "reorder") return await reorderProducts(req, res);
      return await updateProduct(req, res);
    }
    if (req.method === "DELETE") return await deleteProduct(req, res);
    return sendJson(res, 405, { error: "Metodo nao permitido." });
  } catch (error) {
    console.error("[Products API error]", supabaseErrorPayload(error));
    return sendJson(res, 500, supabaseErrorPayload(error));
  }
};
