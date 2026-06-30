const { readJson, requireAdmin, requireSupabase, sendJson, supabaseRest } = require("./_utils");

const DEFAULT_CATEGORIES = ["Bolsas", "Carteiras", "Mochilas", "Acessorios", "Promocoes", "Outros"];

function normalizeCategory(row) {
  return {
    id: row.id || row.name,
    name: row.name,
    sortOrder: Number(row.sort_order || 0),
  };
}

function normalizeGallery(row) {
  return {
    id: row.id,
    title: row.title || "",
    image: row.image_url || "",
    sortOrder: Number(row.sort_order || 0),
  };
}

function normalizeSettings(row) {
  const settings = row?.settings || row || {};
  return {
    storeName: settings.storeName || "MENEZZI",
    logo: settings.logo || "assets/logo-menezzi.jpg",
    whatsapp: settings.whatsapp || "5575997092692",
    instagram: settings.instagram || "https://www.instagram.com/lojamenezzi/",
    address: settings.address || "",
    hours: settings.hours || "",
    primaryColor: settings.primaryColor || "#101010",
    accentColor: settings.accentColor || "#c6a133",
    bannerImage: settings.bannerImage || "assets/hero-bolsa-preta.jpg",
    bannerTitle: settings.bannerTitle || "Produtos escolhidos com elegancia e carinho.",
    bannerSubtitle:
      settings.bannerSubtitle ||
      "Veja bolsas, acessorios, perfumaria e presentes em uma vitrine simples. Escolha o produto e finalize o atendimento diretamente pelo WhatsApp.",
    bannerButtonText: settings.bannerButtonText || "Ver produtos",
    bannerButtonLink: settings.bannerButtonLink || "#vitrine",
  };
}

async function safeSelect(path, fallback) {
  try {
    return await supabaseRest(path);
  } catch (error) {
    if (error.status === 404 || /relation|schema cache|does not exist/i.test(error.message || "")) return fallback;
    throw error;
  }
}

async function loadContent() {
  const [categoriesRows, galleryRows, settingsRows] = await Promise.all([
    safeSelect("product_categories?select=*&order=sort_order.asc,name.asc", []),
    safeSelect("store_gallery?select=*&order=sort_order.asc,created_at.desc", []),
    safeSelect("store_settings?select=*&id=eq.main&limit=1", []),
  ]);

  return {
    categories: categoriesRows.length
      ? categoriesRows.map(normalizeCategory)
      : DEFAULT_CATEGORIES.map((name, index) => ({ id: name, name, sortOrder: index + 1 })),
    gallery: galleryRows.map(normalizeGallery),
    settings: normalizeSettings(settingsRows[0]),
  };
}

async function createCategory(body) {
  const name = String(body.name || "").trim();
  if (!name) throw new Error("Nome da categoria obrigatorio.");
  const rows = await supabaseRest("product_categories", {
    method: "POST",
    headers: { Prefer: "return=representation,resolution=merge-duplicates" },
    body: JSON.stringify({ name, sort_order: Number(body.sortOrder || 0) }),
  });
  return normalizeCategory(rows[0]);
}

async function deleteCategory(name) {
  await supabaseRest(`product_categories?name=eq.${encodeURIComponent(name)}`, { method: "DELETE" });
  return { ok: true };
}

async function saveGallery(body) {
  const payload = {
    title: String(body.title || "").trim(),
    image_url: String(body.image || body.imageUrl || "").trim(),
    sort_order: Number(body.sortOrder || 0),
  };
  if (!payload.image_url) throw new Error("Imagem da galeria obrigatoria.");
  const path = body.id ? `store_gallery?id=eq.${encodeURIComponent(body.id)}` : "store_gallery";
  const rows = await supabaseRest(path, {
    method: body.id ? "PATCH" : "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  return normalizeGallery(rows[0]);
}

async function deleteGallery(id) {
  await supabaseRest(`store_gallery?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  return { ok: true };
}

async function reorderGallery(ids) {
  await Promise.all(
    ids.map((id, index) =>
      supabaseRest(`store_gallery?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ sort_order: index + 1 }),
      })
    )
  );
  const rows = await supabaseRest("store_gallery?select=*&order=sort_order.asc,created_at.desc");
  return rows.map(normalizeGallery);
}

async function saveSettings(body) {
  const settings = normalizeSettings(body);
  const rows = await supabaseRest("store_settings", {
    method: "POST",
    headers: { Prefer: "return=representation,resolution=merge-duplicates" },
    body: JSON.stringify({ id: "main", settings }),
  });
  return normalizeSettings(rows[0]);
}

module.exports = async function handler(req, res) {
  try {
    if (!requireAdmin(req, res) || !requireSupabase(res)) return;
    const url = new URL(req.url, `http://${req.headers.host}`);
    const resource = url.searchParams.get("resource");
    const action = url.searchParams.get("action");

    if (req.method === "GET") return sendJson(res, 200, await loadContent());

    const body = await readJson(req);
    if (resource === "categories" && req.method === "POST") return sendJson(res, 201, await createCategory(body));
    if (resource === "categories" && req.method === "DELETE") return sendJson(res, 200, await deleteCategory(url.searchParams.get("id")));
    if (resource === "gallery" && req.method === "POST") return sendJson(res, 201, await saveGallery(body));
    if (resource === "gallery" && req.method === "PATCH" && action === "reorder") return sendJson(res, 200, await reorderGallery(body.ids || []));
    if (resource === "gallery" && req.method === "DELETE") return sendJson(res, 200, await deleteGallery(url.searchParams.get("id")));
    if (resource === "settings" && req.method === "POST") return sendJson(res, 200, await saveSettings(body));

    return sendJson(res, 405, { error: "Metodo nao permitido." });
  } catch (error) {
    console.error("[Admin content API error]", error);
    return sendJson(res, 500, { error: error.message || "Erro ao salvar conteudo." });
  }
};
