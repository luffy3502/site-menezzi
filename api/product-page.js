const { isSupabaseConfigured, productFromDb, supabaseRest } = require("./_utils");

const WHATSAPP_NUMBER = "5575997092692";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;
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
  return `/produto/${product.id}-${slugify(product.name)}`;
}

function productIdFromKey(key) {
  const match = String(key || "").match(UUID_RE);
  return match ? match[0] : "";
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

function baseHead(title, description, image, url, type = "website") {
  return `
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${escapeHtml(image)}" />
    <meta property="og:url" content="${escapeHtml(url)}" />
    <meta property="og:type" content="${escapeHtml(type)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />
    <link rel="icon" href="/assets/logo-menezzi.jpg" />
    <link rel="stylesheet" href="/styles.css" />
  `;
}

function renderShell(req, statusCode, title, body) {
  const url = absoluteUrl(req, req.url || "/produto");
  const image = absoluteUrl(req, "/assets/logo-menezzi.jpg");
  return {
    statusCode,
    html: `<!DOCTYPE html>
<html lang="pt-BR">
  <head>${baseHead(`${title} | MENEZZI`, "Vitrine MENEZZI.", image, url)}</head>
  <body class="product-page">
    <header class="admin-topbar product-topbar">
      <a class="brand" href="/" aria-label="Voltar para a MENEZZI">
        <img src="/assets/logo-menezzi.jpg" alt="Logo MENEZZI" />
      </a>
      <div>
        <strong>MENEZZI</strong>
        <span>Vitrine de produtos</span>
      </div>
      <a class="button button-light" href="/#vitrine">Ver vitrine</a>
    </header>
    <main class="product-detail-shell">${body}</main>
  </body>
</html>`,
  };
}

function renderNotFound(req) {
  return renderShell(
    req,
    404,
    "Produto nao encontrado",
    `<section class="product-empty-page">
      <span class="section-kicker">Produto</span>
      <h1>Produto nao encontrado</h1>
      <p>Este link pode ser antigo ou o produto pode ter sido removido da vitrine.</p>
      <a class="button button-primary" href="/#vitrine">Voltar para a vitrine</a>
    </section>`
  );
}

function renderError(req) {
  return renderShell(
    req,
    500,
    "Produto indisponivel",
    `<section class="product-empty-page">
      <span class="section-kicker">Produto</span>
      <h1>Nao foi possivel carregar este produto</h1>
      <p>Tente novamente em instantes ou volte para a vitrine da MENEZZI.</p>
      <a class="button button-primary" href="/#vitrine">Voltar para a vitrine</a>
    </section>`
  );
}

function renderProduct(req, product, related) {
  const url = absoluteUrl(req, productPath(product));
  const image = imageUrl(req, product.image);
  const images = [image];
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
  <head>${baseHead(`${product.name} | MENEZZI`, description, image, url, "product")}</head>
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
          <div class="product-detail-thumbs">
            ${images.map((item) => `<img src="${escapeHtml(item)}" alt="${escapeHtml(product.name)}" loading="lazy" />`).join("")}
          </div>
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
          <div class="product-page-actions">
            <a class="button button-primary ${product.available ? "" : "is-disabled"}" href="${whatsappUrl(product, url)}" target="_blank" rel="noopener">
              Comprar pelo WhatsApp
            </a>
            <button class="button button-light" type="button" data-share-product>Compartilhar</button>
            <button class="button button-light" type="button" data-copy-product>Copiar link</button>
            <a class="button button-light" href="/#vitrine">Voltar</a>
          </div>
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
    <script>
      document.querySelector("[data-share-product]")?.addEventListener("click", async () => {
        if (navigator.share) await navigator.share({ title: ${JSON.stringify(product.name)}, url: ${JSON.stringify(url)} });
      });
      document.querySelector("[data-copy-product]")?.addEventListener("click", async (event) => {
        await navigator.clipboard?.writeText(${JSON.stringify(url)});
        event.currentTarget.textContent = "Link copiado";
      });
    </script>
  </body>
</html>`;
}

async function findProductByKey(key) {
  const cleanKey = String(key || "").replace(/^\/+|\/+$/g, "");
  const id = productIdFromKey(cleanKey);

  if (id) {
    const rows = await supabaseRest(`products?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
    if (rows.length) return productFromDb(rows[0]);
  }

  const rows = await supabaseRest("products?select=*&order=sort_order.asc,created_at.desc");
  return rows.map(productFromDb).find((item) => slugify(item.name) === cleanKey || `${item.id}-${slugify(item.name)}` === cleanKey);
}

module.exports = async function handler(req, res) {
  try {
    if (!isSupabaseConfigured()) {
      const page = renderError(req);
      res.writeHead(page.statusCode, { "Content-Type": "text/html; charset=utf-8" });
      res.end(page.html);
      return;
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    const key = url.searchParams.get("slug") || url.searchParams.get("id") || "";
    const product = await findProductByKey(key);

    if (!product) {
      const page = renderNotFound(req);
      res.writeHead(page.statusCode, { "Content-Type": "text/html; charset=utf-8" });
      res.end(page.html);
      return;
    }

    const relatedRows = await supabaseRest(
      `products?select=*&is_available=eq.true&category=eq.${encodeURIComponent(product.category)}&id=neq.${encodeURIComponent(product.id)}&order=sort_order.asc,created_at.desc&limit=4`
    );
    const related = relatedRows.map(productFromDb);

    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
    });
    res.end(renderProduct(req, product, related));
  } catch (error) {
    console.error("[Product page error]", error);
    const page = renderError(req);
    res.writeHead(page.statusCode, { "Content-Type": "text/html; charset=utf-8" });
    res.end(page.html);
  }
};
