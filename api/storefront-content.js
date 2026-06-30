const { requirePublicSupabase, sendJson, supabasePublicRest } = require("./_utils");

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
    return await supabasePublicRest(path);
  } catch (error) {
    if (error.status === 404 || /relation|schema cache|does not exist/i.test(error.message || "")) return fallback;
    throw error;
  }
}

module.exports = async function handler(req, res) {
  try {
    if (!requirePublicSupabase(res)) return;
    const [galleryRows, settingsRows] = await Promise.all([
      safeSelect("store_gallery?select=*&order=sort_order.asc,created_at.desc", []),
      safeSelect("store_settings?select=*&id=eq.main&limit=1", []),
    ]);
    return sendJson(res, 200, {
      gallery: galleryRows.map(normalizeGallery),
      settings: normalizeSettings(settingsRows[0]),
    });
  } catch (error) {
    console.error("[Storefront content API error]", error);
    return sendJson(res, 500, { error: "Nao foi possivel carregar o conteudo da loja." });
  }
};
