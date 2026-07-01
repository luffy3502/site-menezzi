import { buildWhatsappUrl, formatCurrency, getOfferLabel, getOfferType, productPath } from "../config.js";
import { initializeProductGallery, ProductGallery } from "./ProductGallery.js";

export function ProductModal(container) {
  function close() {
    container.hidden = true;
    container.innerHTML = "";
    document.body.classList.remove("modal-open");
  }

  function open(product) {
    const offerType = getOfferType(product);
    const variants = Array.isArray(product.variants) ? product.variants.filter((variant) => variant.colorName && variant.image) : [];

    container.innerHTML = `
      <article class="product-modal" role="dialog" aria-modal="true" aria-labelledby="modal-product-name">
        <button class="modal-close" type="button" aria-label="Fechar produto" data-close-product>X</button>
        <div class="modal-gallery">
          ${ProductGallery(product)}
        </div>
        <div class="modal-info">
          <div class="modal-labels">
            <span class="product-badge">${product.category}</span>
            ${offerType !== "sem_oferta" ? `<span class="offer-chip">${getOfferLabel(offerType)}</span>` : ""}
          </div>
          <h2 id="modal-product-name">${product.name}</h2>
          <p>${product.details || product.description}</p>
          <strong class="modal-price">${formatCurrency(product.price)}</strong>
          <span class="availability ${product.available ? "is-available" : "is-unavailable"}">
            ${product.available ? "Produto disponivel" : "Produto indisponivel no momento"}
          </span>
          ${
            variants.length
              ? `<div class="product-colors"><span>Cores</span>${variants
                  .map(
                    (variant) => `
                      <button type="button" data-modal-color-image="${variant.image}" title="${variant.colorName}">
                        <img src="${variant.image}" alt="${variant.colorName}" />
                        <strong>${variant.colorName}</strong>
                      </button>
                    `
                  )
                  .join("")}</div>`
              : ""
          }
          <div class="modal-actions">
            <a
              class="button button-primary ${product.available ? "" : "is-disabled"}"
              href="${buildWhatsappUrl(product)}"
              target="_blank"
              rel="noopener"
              aria-disabled="${product.available ? "false" : "true"}"
            >Pedir pelo WhatsApp</a>
            <a class="button button-light" href="${productPath(product)}">Ver pagina</a>
          </div>
        </div>
      </article>
    `;
    container.hidden = false;
    document.body.classList.add("modal-open");
    container.gallery = initializeProductGallery(container.querySelector("[data-product-gallery]"));
  }

  container.addEventListener("click", (event) => {
    if (event.target === container || event.target.closest("[data-close-product]")) {
      close();
      return;
    }
    const color = event.target.closest("[data-modal-color-image]");
    if (color) container.gallery?.setImage(color.dataset.modalColorImage);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !container.hidden) close();
    if (event.key === "ArrowLeft" && !container.hidden) container.gallery?.move(-1);
    if (event.key === "ArrowRight" && !container.hidden) container.gallery?.move(1);
  });

  return { open, close };
}
