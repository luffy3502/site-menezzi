const { readJson, requireAdmin, requireSupabase, sendJson, supabaseRest } = require("./_utils");

const DEFAULT_CATEGORIES = ["Bolsas", "Carteiras", "Mochilas", "Acessorios", "Promocoes", "Outros"];

function normalizeCategory(row) {
  return {
    id: row.id || row.name,
    name: row.name,
    image: row.image_url || "",
    active: row.is_active ?? true,
    sortOrder: Number(row.sort_order || 0),
  };
}

function normalizeGallery(row) {
  return {
    id: row.id,
    title: row.title || "",
    caption: row.caption || "",
    image: row.image_url || "",
    active: row.is_active ?? true,
    cover: row.is_cover ?? false,
    sortOrder: Number(row.sort_order || 0),
  };
}

function normalizeVisibility(row) {
  const isDeleted = row.deleted === true;
  const isActive = row.is_active ?? row.active ?? true;
  const isPublished = row.published ?? true;
  const isVisible = row.visible ?? true;
  return Boolean(isActive && isPublished && isVisible && !isDeleted);
}

function normalizeTestimonial(row) {
  return {
    id: row.id,
    name: row.name || "",
    city: row.city || "",
    image: row.image_url || "",
    rating: Number(row.rating || 5),
    comment: row.comment || "",
    active: normalizeVisibility(row),
    sortOrder: Number(row.sort_order || 0),
  };
}

function normalizeInstagramPhoto(row) {
  return {
    id: row.id,
    title: row.title || "",
    image: row.image_url || "",
    link: row.link_url || "",
    active: row.is_active ?? true,
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
    heroSlogan: settings.heroSlogan || "Elegancia, qualidade e exclusividade para mulheres que valorizam cada detalhe.",
    impactPhrase: settings.impactPhrase || "Curadoria feminina com atendimento proximo e acabamento impecavel.",
    facebook: settings.facebook || "",
    mapUrl: settings.mapUrl || "",
    paymentMethods: settings.paymentMethods || "Pix, credito, debito e dinheiro",
    footerDescription: settings.footerDescription || "Bolsas, acessorios, perfumaria e presentes selecionados com olhar de boutique.",
    institutionalVideo: settings.institutionalVideo || "",
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
  const [testimonialRows, instagramRows] = await Promise.all([
    safeSelect("store_testimonials?select=*&order=sort_order.asc,created_at.desc", []),
    safeSelect("store_instagram?select=*&order=sort_order.asc,created_at.desc", []),
  ]);

  return {
    categories: categoriesRows.length
      ? categoriesRows.map(normalizeCategory)
      : DEFAULT_CATEGORIES.map((name, index) => ({ id: name, name, image: "", active: true, sortOrder: index + 1 })),
    gallery: galleryRows.map(normalizeGallery),
    testimonials: testimonialRows.map(normalizeTestimonial),
    instagram: instagramRows.map(normalizeInstagramPhoto),
    settings: normalizeSettings(settingsRows[0]),
  };
}

async function createCategory(body) {
  const name = String(body.name || "").trim();
  if (!name) throw new Error("Nome da categoria obrigatorio.");
  const oldName = String(body.oldName || body.id || "").trim();
  const payload = {
    name,
    image_url: String(body.image || body.imageUrl || "").trim(),
    is_active: body.active ?? body.isActive ?? true,
    sort_order: Number(body.sortOrder || 0),
  };
  if (oldName && oldName !== name) {
    await supabaseRest(`product_categories?name=eq.${encodeURIComponent(oldName)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });
    const rows = await supabaseRest(`product_categories?name=eq.${encodeURIComponent(name)}&limit=1`);
    return normalizeCategory(rows[0]);
  }
  const rows = await supabaseRest("product_categories", {
    method: "POST",
    headers: { Prefer: "return=representation,resolution=merge-duplicates" },
    body: JSON.stringify(payload),
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
    caption: String(body.caption || "").trim(),
    image_url: String(body.image || body.imageUrl || "").trim(),
    is_active: body.active ?? body.isActive ?? true,
    is_cover: body.cover ?? body.isCover ?? false,
    sort_order: Number(body.sortOrder || 0),
  };
  if (!payload.image_url) throw new Error("Imagem da galeria obrigatoria.");
  if (payload.is_cover) {
    await supabaseRest("store_gallery?is_cover=eq.true", {
      method: "PATCH",
      body: JSON.stringify({ is_cover: false }),
    }).catch(() => null);
  }
  const path = body.id ? `store_gallery?id=eq.${encodeURIComponent(body.id)}` : "store_gallery";
  const rows = await supabaseRest(path, {
    method: body.id ? "PATCH" : "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  return normalizeGallery(rows[0]);
}

async function saveTestimonial(body) {
  const active = body.active ?? body.isActive ?? true;
  const basePayload = {
    name: String(body.name || "").trim(),
    city: String(body.city || "").trim(),
    image_url: String(body.image || body.imageUrl || "").trim(),
    rating: Math.max(1, Math.min(5, Number(body.rating || 5))),
    comment: String(body.comment || "").trim(),
    is_active: active,
    sort_order: Number(body.sortOrder || 0),
  };
  const extendedPayload = {
    ...basePayload,
    active,
    published: true,
    visible: true,
    deleted: false,
  };
  if (!basePayload.name || !basePayload.comment) throw new Error("Nome e comentario sao obrigatorios.");
  const path = body.id ? `store_testimonials?id=eq.${encodeURIComponent(body.id)}` : "store_testimonials";
  let rows;
  try {
    rows = await supabaseRest(path, {
      method: body.id ? "PATCH" : "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(extendedPayload),
    });
  } catch (error) {
    if (!/column|schema cache|active|published|visible|deleted/i.test(error.message || "")) throw error;
    rows = await supabaseRest(path, {
      method: body.id ? "PATCH" : "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(basePayload),
    });
  }
  const saved = rows[0];
  if (!saved?.id) throw new Error("O Supabase nao retornou o depoimento salvo.");
  const persistedRows = await supabaseRest(`store_testimonials?select=*&id=eq.${encodeURIComponent(saved.id)}&limit=1`);
  if (!persistedRows.length) throw new Error("Depoimento nao permaneceu gravado no Supabase.");
  return normalizeTestimonial(persistedRows[0]);
}

async function deleteTestimonial(id) {
  await supabaseRest(`store_testimonials?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  return { ok: true };
}

async function reorderTestimonials(ids) {
  await Promise.all(
    ids.map((id, index) =>
      supabaseRest(`store_testimonials?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ sort_order: index + 1 }),
      })
    )
  );
  const rows = await supabaseRest("store_testimonials?select=*&order=sort_order.asc,created_at.desc");
  return rows.map(normalizeTestimonial);
}

async function saveInstagram(body) {
  const payload = {
    title: String(body.title || "").trim(),
    image_url: String(body.image || body.imageUrl || "").trim(),
    link_url: String(body.link || body.linkUrl || "").trim(),
    is_active: body.active ?? body.isActive ?? true,
    sort_order: Number(body.sortOrder || 0),
  };
  if (!payload.image_url) throw new Error("Imagem do Instagram obrigatoria.");
  const path = body.id ? `store_instagram?id=eq.${encodeURIComponent(body.id)}` : "store_instagram";
  const rows = await supabaseRest(path, {
    method: body.id ? "PATCH" : "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  return normalizeInstagramPhoto(rows[0]);
}

async function deleteInstagram(id) {
  await supabaseRest(`store_instagram?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  return { ok: true };
}

async function reorderInstagram(ids) {
  await Promise.all(
    ids.map((id, index) =>
      supabaseRest(`store_instagram?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ sort_order: index + 1 }),
      })
    )
  );
  const rows = await supabaseRest("store_instagram?select=*&order=sort_order.asc,created_at.desc");
  return rows.map(normalizeInstagramPhoto);
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
    if (resource === "testimonials" && req.method === "POST") return sendJson(res, 201, await saveTestimonial(body));
    if (resource === "testimonials" && req.method === "PATCH" && action === "reorder") return sendJson(res, 200, await reorderTestimonials(body.ids || []));
    if (resource === "testimonials" && req.method === "DELETE") return sendJson(res, 200, await deleteTestimonial(url.searchParams.get("id")));
    if (resource === "instagram" && req.method === "POST") return sendJson(res, 201, await saveInstagram(body));
    if (resource === "instagram" && req.method === "PATCH" && action === "reorder") return sendJson(res, 200, await reorderInstagram(body.ids || []));
    if (resource === "instagram" && req.method === "DELETE") return sendJson(res, 200, await deleteInstagram(url.searchParams.get("id")));
    if (resource === "settings" && req.method === "POST") return sendJson(res, 200, await saveSettings(body));

    return sendJson(res, 405, { error: "Metodo nao permitido." });
  } catch (error) {
    console.error("[Admin content API error]", error);
    return sendJson(res, 500, {
      error: error.message || "Erro ao salvar conteudo.",
      supabase: error.supabase || null,
      request: error.request || null,
    });
  }
};
