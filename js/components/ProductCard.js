import { buildWhatsappUrl, formatCurrency, getOfferLabel, getOfferType, productPath } from "../config.js";

export function ProductCard(product) {
  const statusClass = product.available ? "is-available" : "is-unavailable";
  const statusText = product.available ? "Disponivel" : "Indisponivel";
  const disabledAttr = product.available ? "" : "disabled";
  const offerType = getOfferType(product);

  return `
    <article class="product-card reveal ${statusClass}" data-product-id="${product.id}">
      <button class="product-card-main" type="button" data-view-product="${product.id}">
        <div class="product-image">
          <img src="${product.image}" alt="${product.name}" loading="lazy" />
          <span class="product-badge">${product.category}</span>
          ${offerType !== "sem_oferta" ? `<span class="offer-badge">${getOfferLabel(offerType)}</span>` : ""}
        </div>
        <div class="product-body">
          <div class="product-meta">
            <span>${statusText}</span>
          </div>
          <h3>${product.name}</h3>
          <p>${product.description}</p>
          <strong class="product-price">${formatCurrency(product.price)}</strong>
        </div>
      </button>
      <a class="product-link" href="${productPath(product)}">Ver pagina do produto</a>
      <a class="button button-primary product-whatsapp ${disabledAttr ? "is-disabled" : ""}"
        href="${buildWhatsappUrl(product)}"
        target="_blank"
        rel="noopener"
        aria-disabled="${product.available ? "false" : "true"}"
        ${disabledAttr}
      >Pedir pelo WhatsApp</a>
    </article>
  `;
}
