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

function isMissingProductImagesTable(error) {
  const message = `${error.message || ""} ${error.supabase?.message || ""} ${error.supabase?.details || ""}`;
  return /product_images/i.test(message) && /relation|schema cache|does not exist|could not find/i.test(message);
}

function isMissingProductVariantsTable(error) {
  const message = `${error.message || ""} ${error.supabase?.message || ""} ${error.supabase?.details || ""}`;
  return /product_variants|product_colors/i.test(message) && /relation|schema cache|does not exist|could not find/i.test(message);
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
  const images = (Array.isArray(product.images) && product.images.length ? product.images : [{ image }]).map((item) =>
    imageUrl(req, item.image || item.imageUrl || image)
  );
  const variants = Array.isArray(product.variants) ? product.variants.filter((variant) => variant.colorName && variant.image) : [];
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
          <div class="product-gallery-frame" data-product-gallery-frame>
            <button class="product-gallery-arrow prev" type="button" aria-label="Foto anterior" data-product-gallery-prev>‹</button>
            <img src="${escapeHtml(images[0])}" alt="${escapeHtml(product.name)}" data-product-main-image data-gallery-index="0" />
            <button class="product-gallery-arrow next" type="button" aria-label="Proxima foto" data-product-gallery-next>›</button>
          </div>
          <div class="product-detail-thumbs">
            ${images
              .map(
                (item, index) => `
                  <button class="${index === 0 ? "is-active" : ""}" type="button" data-product-thumb="${escapeHtml(item)}" aria-label="Ver foto ${index + 1}">
                    <img src="${escapeHtml(item)}" alt="${escapeHtml(product.name)}" loading="lazy" />
                  </button>
                `
              )
              .join("")}
          </div>
          ${
            variants.length
              ? `<div class="product-colors"><span>Cores</span>${variants
                  .map(
                    (variant) => `
                      <button type="button" data-product-color-image="${escapeHtml(imageUrl(req, variant.image))}" title="${escapeHtml(variant.colorName)}">
                        <img src="${escapeHtml(imageUrl(req, variant.image))}" alt="${escapeHtml(variant.colorName)}" />
                        <strong>${escapeHtml(variant.colorName)}</strong>
                      </button>
                    `
                  )
                  .join("")}</div>`
              : ""
          }
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
      document.querySelectorAll("[data-product-thumb]").forEach((button) => {
        button.addEventListener("click", () => setProductImage(button.dataset.productThumb, Number(button.dataset.index || 0)));
      });
      function setProductImage(src, index = -1) {
        const main = document.querySelector("[data-product-main-image]");
        if (!main || !src) return;
        main.src = src;
        if (index >= 0) main.dataset.galleryIndex = String(index);
        document.querySelectorAll("[data-product-thumb]").forEach((item, itemIndex) => {
          item.classList.toggle("is-active", itemIndex === Number(main.dataset.galleryIndex || 0));
        });
      }
      function moveProductImage(direction) {
        const main = document.querySelector("[data-product-main-image]");
        const thumbs = [...document.querySelectorAll("[data-product-thumb]")];
        if (!main || !thumbs.length) return;
        const current = Number(main.dataset.galleryIndex || 0);
        const next = (current + direction + thumbs.length) % thumbs.length;
        setProductImage(thumbs[next].dataset.productThumb, next);
      }
      document.querySelector("[data-product-gallery-prev]")?.addEventListener("click", () => moveProductImage(-1));
      document.querySelector("[data-product-gallery-next]")?.addEventListener("click", () => moveProductImage(1));
      document.querySelectorAll("[data-product-color-image]").forEach((button) => {
        button.addEventListener("click", () => setProductImage(button.dataset.productColorImage));
      });
      const frame = document.querySelector("[data-product-gallery-frame]");
      let touchStartX = 0;
      frame?.addEventListener("touchstart", (event) => {
        touchStartX = event.changedTouches[0].clientX;
      }, { passive: true });
      frame?.addEventListener("touchend", (event) => {
        const delta = event.changedTouches[0].clientX - touchStartX;
        if (Math.abs(delta) > 42) moveProductImage(delta > 0 ? -1 : 1);
      }, { passive: true });
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

async function attachProductImages(product) {
  if (!product?.id) return product;
  try {
    const [rows, variantRows] = await Promise.all([
      supabaseRest(`product_images?select=*&product_id=eq.${encodeURIComponent(product.id)}&order=sort_order.asc,created_at.asc`),
      supabaseRest(`product_variants?select=*&product_id=eq.${encodeURIComponent(product.id)}&order=sort_order.asc,created_at.asc`).catch((error) => {
        if (isMissingProductVariantsTable(error)) return [];
        throw error;
      }),
    ]);
    if (!rows.length && !variantRows.length) return product;
    const images = rows.map((row) => ({
      id: row.id,
      image: row.image_url,
      imageUrl: row.image_url,
      sortOrder: Number(row.sort_order || 0),
      primary: row.is_primary ?? false,
    }));
    const primary = images.find((item) => item.primary) || images[0];
    const variants = variantRows.map((row) => ({
      id: row.id,
      colorName: row.color_name || "",
      image: row.image_url || "",
      imageUrl: row.image_url || "",
      sortOrder: Number(row.sort_order || 0),
    }));
    return { ...product, image: primary?.image || product.image, imageUrl: primary?.image || product.image, images: images.length ? images : product.images, variants };
  } catch (error) {
    if (isMissingProductImagesTable(error)) return product;
    throw error;
  }
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
    let product = await findProductByKey(key);

    if (!product) {
      const page = renderNotFound(req);
      res.writeHead(page.statusCode, { "Content-Type": "text/html; charset=utf-8" });
      res.end(page.html);
      return;
    }
    product = await attachProductImages(product);

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
