const { productFromDb, requirePublicSupabase, sendJson, supabasePublicRest } = require("./_utils");

const WHATSAPP_NUMBER = "5575997092692";
const OFFER_LABELS = {
  sem_oferta: "Sem oferta",
  oferta_semana: "Oferta da semana",
  promocao: "Promocao",
  lancamento: "Lancamento",
  mais_vendido: "Mais vendido",
};

function slugify(value) {
  return String(value || "produto")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function absoluteUrl(req, path) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return new URL(path, `${proto}://${host}`).href;
}

function imageUrl(req, image) {
  if (/^https?:\/\//i.test(image)) return image;
  return absoluteUrl(req, `/${String(image || "assets/logo-menezzi.jpg").replace(/^\/+/, "")}`);
}

function productPath(product) {
  return `/produto/${slugify(product.name)}`;
}

function whatsappUrl(product, url) {
  const text = `Ola! Tenho interesse neste produto.

Produto:
${product.name}

Preco:
${formatCurrency(product.price)}

Categoria:
${product.category}

Link do produto:
${url}

Gostaria de mais informacoes.`;

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

function renderProduct(req, product, related) {
  const url = absoluteUrl(req, productPath(product));
  const image = imageUrl(req, product.image);
  const offerLabel = OFFER_LABELS[product.offerType] || "Oferta";
  const description = product.description || "Produto selecionado da MENEZZI.";
  const relatedCards = related
    .map(
      (item) => `
        <a class="related-card" href="${productPath(item)}">
          <img src="${escapeHtml(imageUrl(req, item.image))}" alt="${escapeHtml(item.name)}" loading="lazy" />
          <span>${escapeHtml(item.category)}</span>
          <strong>${escapeHtml(item.name)}</strong>
          <em>${formatCurrency(item.price)}</em>
        </a>
      `
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(product.name)} | MENEZZI</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta property="og:title" content="${escapeHtml(product.name)} | MENEZZI" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${escapeHtml(image)}" />
    <meta property="og:url" content="${escapeHtml(url)}" />
    <meta property="og:type" content="product" />
    <link rel="icon" href="/assets/logo-menezzi.jpg" />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body class="product-page">
    <header class="admin-topbar product-topbar">
      <a class="brand" href="/" aria-label="Voltar para a MENEZZI">
        <img src="/assets/logo-menezzi.jpg" alt="Logo MENEZZI" />
      </a>
      <div>
        <strong>MENEZZI</strong>
        <span>Produto selecionado</span>
      </div>
      <a class="button button-light" href="/#vitrine">Ver vitrine</a>
    </header>

    <main class="product-detail-shell">
      <article class="product-detail">
        <div class="product-detail-media">
          <img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" />
        </div>
        <div class="product-detail-info">
          <div class="modal-labels">
            <span class="product-badge">${escapeHtml(product.category)}</span>
            <span class="availability ${product.available ? "is-available" : "is-unavailable"}">
              ${product.available ? "Disponivel" : "Indisponivel"}
            </span>
            ${
              product.offerType !== "sem_oferta"
                ? `<span class="offer-chip">${escapeHtml(offerLabel)}</span>`
                : '<span class="status-soft">Sem oferta</span>'
            }
          </div>
          <h1>${escapeHtml(product.name)}</h1>
          <p>${escapeHtml(description)}</p>
          <strong class="modal-price">${formatCurrency(product.price)}</strong>
          <a class="button button-primary ${product.available ? "" : "is-disabled"}" href="${whatsappUrl(product, url)}" target="_blank" rel="noopener">
            Comprar pelo WhatsApp
          </a>
        </div>
      </article>

      <section class="section related-products">
        <div class="section-heading">
          <span class="section-kicker">Relacionados</span>
          <h2>Produtos relacionados</h2>
        </div>
        <div class="related-grid">${relatedCards || '<p class="empty-state">Nenhum produto relacionado no momento.</p>'}</div>
      </section>
    </main>
  </body>
</html>`;
}

module.exports = async function handler(req, res) {
  try {
    if (!requirePublicSupabase(res)) return;
    const url = new URL(req.url, `http://${req.headers.host}`);
    const slug = String(url.searchParams.get("slug") || "").replace(/^\/+|\/+$/g, "");
    const rows = await supabasePublicRest("products?select=*&is_available=eq.true&order=sort_order.asc,created_at.desc");
    const products = rows.map(productFromDb);
    const product = products.find((item) => slugify(item.name) === slug);

    if (!product) {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<h1>Produto nao encontrado</h1><p>Volte para a <a href=\"/#vitrine\">vitrine MENEZZI</a>.</p>");
      return;
    }

    const related = products
      .filter((item) => item.id !== product.id && (item.category === product.category || item.weeklyOffer))
      .slice(0, 4);

    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
    });
    res.end(renderProduct(req, product, related));
  } catch (error) {
    console.error("[Product page error]", error);
    sendJson(res, 500, { error: "Nao foi possivel carregar o produto." });
  }
};
