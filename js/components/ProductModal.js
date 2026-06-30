import { buildWhatsappUrl, formatCurrency } from "../config.js";

export function ProductModal(container) {
  function close() {
    container.hidden = true;
    container.innerHTML = "";
    document.body.classList.remove("modal-open");
  }

  function open(product) {
    container.innerHTML = `
      <article class="product-modal" role="dialog" aria-modal="true" aria-labelledby="modal-product-name">
        <button class="modal-close" type="button" aria-label="Fechar produto" data-close-product>×</button>
        <div class="modal-gallery">
          <img src="${product.image}" alt="${product.name}" />
        </div>
        <div class="modal-info">
          <div class="modal-labels">
            <span class="product-badge">${product.category}</span>
            ${product.weeklyOffer ? '<span class="offer-chip">Oferta da Semana</span>' : ""}
          </div>
          <h2 id="modal-product-name">${product.name}</h2>
          <p>${product.details || product.description}</p>
          <strong class="modal-price">${formatCurrency(product.price)}</strong>
          <span class="availability ${product.available ? "is-available" : "is-unavailable"}">
            ${product.available ? "Produto disponivel" : "Produto indisponivel no momento"}
          </span>
          <div class="modal-actions">
            <a
              class="button button-primary ${product.available ? "" : "is-disabled"}"
              href="${buildWhatsappUrl(product)}"
              target="_blank"
              rel="noopener"
              aria-disabled="${product.available ? "false" : "true"}"
            >Pedir pelo WhatsApp</a>
            <button class="button button-light" type="button" data-close-product>Voltar</button>
          </div>
        </div>
      </article>
    `;
    container.hidden = false;
    document.body.classList.add("modal-open");
  }

  container.addEventListener("click", (event) => {
    if (event.target === container || event.target.closest("[data-close-product]")) {
      close();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !container.hidden) close();
  });

  return { open, close };
}
