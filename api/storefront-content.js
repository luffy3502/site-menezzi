const { requirePublicSupabase, sendJson, supabasePublicRest } = require("./_utils");

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

function normalizeCategory(row) {
  return {
    id: row.id || row.name,
    name: row.name,
    image: row.image_url || "",
    active: row.is_active ?? true,
    sortOrder: Number(row.sort_order || 0),
  };
}

function normalizeTestimonial(row) {
  return {
    id: row.id,
    name: row.name || "",
    city: row.city || "",
    image: row.image_url || "",
    rating: Number(row.rating || 5),
    comment: row.comment || "",
    active: row.is_active ?? true,
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
    return await supabasePublicRest(path);
  } catch (error) {
    if (error.status === 404 || /relation|schema cache|does not exist/i.test(error.message || "")) return fallback;
    throw error;
  }
}

module.exports = async function handler(req, res) {
  try {
    if (!requirePublicSupabase(res)) return;
    const [galleryRows, settingsRows, categoryRows, testimonialRows, instagramRows] = await Promise.all([
      safeSelect("store_gallery?select=*&order=sort_order.asc,created_at.desc", []),
      safeSelect("store_settings?select=*&id=eq.main&limit=1", []),
      safeSelect("product_categories?select=*&order=sort_order.asc,name.asc", []),
      safeSelect("store_testimonials?select=*&is_active=eq.true&order=sort_order.asc,created_at.desc", []),
      safeSelect("store_instagram?select=*&order=sort_order.asc,created_at.desc", []),
    ]);
    return sendJson(res, 200, {
      gallery: galleryRows.map(normalizeGallery),
      categories: categoryRows.map(normalizeCategory),
      testimonials: testimonialRows.map(normalizeTestimonial),
      instagram: instagramRows.map(normalizeInstagramPhoto),
      settings: normalizeSettings(settingsRows[0]),
    });
  } catch (error) {
    console.error("[Storefront content API error]", error);
    return sendJson(res, 500, { error: "Nao foi possivel carregar o conteudo da loja." });
  }
};
