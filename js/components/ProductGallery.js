function imageValue(item) {
  return String(item?.image || item?.imageUrl || item?.image_url || item?.url || item || "").trim();
}

function imageRecords(product) {
  const tableImages = Array.isArray(product?.productImages)
    ? product.productImages
    : Array.isArray(product?.product_images)
      ? product.product_images
      : Array.isArray(product?.images)
        ? product.images
        : [];

  return [...tableImages].sort((a, b) => {
    const primaryA = a?.primary ?? a?.isPrimary ?? a?.is_primary ? -1 : 0;
    const primaryB = b?.primary ?? b?.isPrimary ?? b?.is_primary ? -1 : 0;
    if (primaryA !== primaryB) return primaryA - primaryB;
    return Number(a?.sortOrder ?? a?.sort_order ?? 0) - Number(b?.sortOrder ?? b?.sort_order ?? 0);
  });
}

export function productGalleryImages(product) {
  const seen = new Set();
  const images = [];

  function addImage(item) {
    const image = imageValue(item);
    const key = image.toLowerCase();
    if (!image || seen.has(key)) return;
    seen.add(key);
    images.push(image);
  }

  addImage(product?.image || product?.imageUrl || product?.image_url);

  const additionalImages = Array.isArray(product?.additionalImages)
    ? product.additionalImages
    : Array.isArray(product?.additional_images)
      ? product.additional_images
      : [];
  additionalImages.forEach(addImage);
  imageRecords(product).forEach(addImage);

  return images.length ? images : ["assets/logo-menezzi.jpg"];
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function arrowIcon(direction) {
  const path =
    direction === "prev"
      ? "M15 18l-6-6 6-6"
      : "M9 6l6 6-6 6";
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}" /></svg>`;
}

export function ProductGallery(product, options = {}) {
  const images = options.images || productGalleryImages(product);
  const alt = escapeHtml(options.alt || product?.name || "Produto MENEZZI");
  const hasGallery = images.length > 1;

  return `
    <div class="product-gallery" data-product-gallery>
      <div class="product-gallery-frame" data-gallery-frame>
        ${
          hasGallery
            ? `<button class="product-gallery-arrow prev" type="button" aria-label="Foto anterior" data-gallery-prev>${arrowIcon("prev")}</button>`
            : ""
        }
        <img src="${escapeHtml(images[0])}" alt="${alt}" data-gallery-main data-gallery-index="0" draggable="false" />
        ${
          hasGallery
            ? `<button class="product-gallery-arrow next" type="button" aria-label="Proxima foto" data-gallery-next>${arrowIcon("next")}</button>`
            : ""
        }
        ${hasGallery ? `<span class="product-gallery-counter" data-gallery-counter>1/${images.length}</span>` : ""}
      </div>
      ${
        hasGallery
          ? `<div class="product-detail-thumbs" data-gallery-thumbs>
              ${images
                .map(
                  (item, index) => `
                    <button class="${index === 0 ? "is-active" : ""}" type="button" data-gallery-thumb data-gallery-image="${escapeHtml(item)}" data-index="${index}" aria-label="Ver foto ${index + 1}">
                      <img src="${escapeHtml(item)}" alt="${alt}" loading="lazy" draggable="false" />
                    </button>
                  `
                )
                .join("")}
            </div>`
          : ""
      }
    </div>
  `;
}

export function initializeProductGallery(root) {
  if (!root || root.dataset.galleryReady === "true") return null;

  const main = root.querySelector("[data-gallery-main]");
  const thumbs = [...root.querySelectorAll("[data-gallery-thumb]")];
  const counter = root.querySelector("[data-gallery-counter]");
  const frame = root.querySelector("[data-gallery-frame]");
  const prev = root.querySelector("[data-gallery-prev]");
  const next = root.querySelector("[data-gallery-next]");

  if (!main) return null;
  root.dataset.galleryReady = "true";

  function setImage(src, index = -1, direction = 0) {
    if (!src || main.src === src) return;
    const thumbIndex = index >= 0 ? index : thumbs.findIndex((thumb) => thumb.dataset.galleryImage === src);
    if (thumbIndex >= 0) main.dataset.galleryIndex = String(thumbIndex);

    root.classList.remove("is-moving-prev", "is-moving-next");
    root.classList.add("is-switching", direction < 0 ? "is-moving-prev" : "is-moving-next");
    window.setTimeout(() => {
      main.onload = () => root.classList.remove("is-switching", "is-moving-prev", "is-moving-next");
      main.src = src;
      window.setTimeout(() => root.classList.remove("is-switching", "is-moving-prev", "is-moving-next"), 360);
    }, 90);

    const currentIndex = Number(main.dataset.galleryIndex || 0);
    if (counter && thumbs.length && thumbIndex >= 0) counter.textContent = `${currentIndex + 1}/${thumbs.length}`;
    thumbs.forEach((thumb, itemIndex) => {
      thumb.classList.toggle("is-active", itemIndex === currentIndex);
    });
    thumbs[currentIndex]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }

  function move(direction) {
    if (!thumbs.length) return;
    const current = Number(main.dataset.galleryIndex || 0);
    const nextIndex = (current + direction + thumbs.length) % thumbs.length;
    setImage(thumbs[nextIndex].dataset.galleryImage, nextIndex, direction);
  }

  root.addEventListener("click", (event) => {
    const thumb = event.target.closest("[data-gallery-thumb]");
    if (thumb) setImage(thumb.dataset.galleryImage, Number(thumb.dataset.index || 0));
    if (event.target.closest("[data-gallery-prev]")) move(-1);
    if (event.target.closest("[data-gallery-next]")) move(1);
  });

  let touchStartX = 0;
  let touchStartY = 0;
  frame?.addEventListener(
    "touchstart",
    (event) => {
      touchStartX = event.changedTouches[0].clientX;
      touchStartY = event.changedTouches[0].clientY;
    },
    { passive: true }
  );
  frame?.addEventListener(
    "touchend",
    (event) => {
      const deltaX = event.changedTouches[0].clientX - touchStartX;
      const deltaY = event.changedTouches[0].clientY - touchStartY;
      if (Math.abs(deltaX) > 42 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) move(deltaX > 0 ? -1 : 1);
    },
    { passive: true }
  );

  return { setImage, move, main, thumbs, counter, prev, next };
}

export function initializeProductGalleries(scope = document) {
  return [...scope.querySelectorAll("[data-product-gallery]")].map(initializeProductGallery).filter(Boolean);
}
