import { buildWhatsappUrl, formatCurrency, getOfferLabel, getOfferType, productPath } from "../config.js";

export function ProductModal(container) {
  function close() {
    container.hidden = true;
    container.innerHTML = "";
    document.body.classList.remove("modal-open");
  }

  function open(product) {
    const offerType = getOfferType(product);
    const images = Array.isArray(product.images) && product.images.length ? product.images : [{ image: product.image }];
    const variants = Array.isArray(product.variants) ? product.variants.filter((variant) => variant.colorName && variant.image) : [];

    container.innerHTML = `
      <article class="product-modal" role="dialog" aria-modal="true" aria-labelledby="modal-product-name">
        <button class="modal-close" type="button" aria-label="Fechar produto" data-close-product>X</button>
        <div class="modal-gallery">
          <div class="product-gallery-frame">
            <button class="product-gallery-arrow prev" type="button" aria-label="Foto anterior" data-modal-gallery-prev>‹</button>
            <img src="${images[0].image || images[0].imageUrl}" alt="${product.name}" data-modal-main-image data-gallery-index="0" />
            <button class="product-gallery-arrow next" type="button" aria-label="Proxima foto" data-modal-gallery-next>›</button>
          </div>
          <div class="product-detail-thumbs">
            ${images
              .map(
                (item, index) => `
                  <button class="${index === 0 ? "is-active" : ""}" type="button" data-modal-thumb="${item.image || item.imageUrl}" data-index="${index}" aria-label="Ver foto ${index + 1}">
                    <img src="${item.image || item.imageUrl}" alt="${product.name}" loading="lazy" />
                  </button>
                `
              )
              .join("")}
          </div>
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
    const frame = container.querySelector(".product-gallery-frame");
    let touchStartX = 0;
    frame?.addEventListener(
      "touchstart",
      (event) => {
        touchStartX = event.changedTouches[0].clientX;
      },
      { passive: true }
    );
    frame?.addEventListener(
      "touchend",
      (event) => {
        const delta = event.changedTouches[0].clientX - touchStartX;
        if (Math.abs(delta) > 42) moveModalImage(delta > 0 ? -1 : 1);
      },
      { passive: true }
    );
  }

  function setModalImage(src, index = -1) {
    const main = container.querySelector("[data-modal-main-image]");
    const thumbs = [...container.querySelectorAll("[data-modal-thumb]")];
    if (!main || !src) return;
    main.src = src;
    if (index >= 0) main.dataset.galleryIndex = String(index);
    thumbs.forEach((thumb, thumbIndex) => {
      thumb.classList.toggle("is-active", thumbIndex === Number(main.dataset.galleryIndex || 0));
    });
  }

  function moveModalImage(direction) {
    const main = container.querySelector("[data-modal-main-image]");
    const thumbs = [...container.querySelectorAll("[data-modal-thumb]")];
    if (!main || !thumbs.length) return;
    const current = Number(main.dataset.galleryIndex || 0);
    const next = (current + direction + thumbs.length) % thumbs.length;
    setModalImage(thumbs[next].dataset.modalThumb, next);
  }

  container.addEventListener("click", (event) => {
    if (event.target === container || event.target.closest("[data-close-product]")) {
      close();
      return;
    }
    const thumb = event.target.closest("[data-modal-thumb]");
    if (thumb) setModalImage(thumb.dataset.modalThumb, Number(thumb.dataset.index || 0));
    if (event.target.closest("[data-modal-gallery-prev]")) moveModalImage(-1);
    if (event.target.closest("[data-modal-gallery-next]")) moveModalImage(1);
    const color = event.target.closest("[data-modal-color-image]");
    if (color) setModalImage(color.dataset.modalColorImage);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !container.hidden) close();
    if (event.key === "ArrowLeft" && !container.hidden) moveModalImage(-1);
    if (event.key === "ArrowRight" && !container.hidden) moveModalImage(1);
  });

  return { open, close };
}
