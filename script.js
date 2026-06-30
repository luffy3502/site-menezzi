import { buildWhatsappUrl } from "./js/config.js";
import { getCategories, loadProducts } from "./js/products-store.js";
import { CategoryFilter } from "./js/components/CategoryFilter.js";
import { ProductGrid } from "./js/components/ProductGrid.js";
import { ProductModal } from "./js/components/ProductModal.js";

const state = {
  products: [],
  search: "",
  category: "Todos",
};

const header = document.querySelector("[data-header]");
const nav = document.querySelector("[data-nav]");
const menuToggle = document.querySelector("[data-menu-toggle]");
const searchInput = document.querySelector("[data-product-search]");
const categoryFilterEl = document.querySelector("[data-category-filter]");
const categorySummary = document.querySelector("[data-category-summary]");
const productGridEl = document.querySelector("[data-product-grid]");
const offersGridEl = document.querySelector("[data-offers-grid]");
const emptyState = document.querySelector("[data-empty-state]");
const galleryEl = document.querySelector("[data-store-gallery]");
const galleryModal = document.querySelector("[data-gallery-modal]");
const modal = ProductModal(document.querySelector("[data-product-modal]"));

let revealObserver;
const categoryFilter = CategoryFilter(categoryFilterEl, (category) => {
  state.category = category;
  renderCatalog();
});
const productGrid = ProductGrid(productGridEl, emptyState, openProduct);
const offersGrid = ProductGrid(offersGridEl, null, openProduct);

function renderSkeletons() {
  const skeleton = Array.from({ length: 6 }, () => '<article class="product-skeleton"></article>').join("");
  productGridEl.innerHTML = skeleton;
  offersGridEl.innerHTML = Array.from({ length: 3 }, () => '<article class="product-skeleton"></article>').join("");
}

function availableProducts() {
  return state.products.filter((product) => product.available);
}

function filteredProducts() {
  const term = state.search.trim().toLowerCase();

  return availableProducts().filter((product) => {
    const matchesCategory = state.category === "Todos" || product.category === state.category;
    const matchesSearch = !term || product.name.toLowerCase().includes(term);
    return matchesCategory && matchesSearch;
  });
}

function openProduct(productId) {
  const product = state.products.find((item) => item.id === productId);
  if (product) modal.open(product);
}

function renderCatalog() {
  productGrid.render(filteredProducts());
  if (!availableProducts().length) {
    emptyState.hidden = false;
    emptyState.textContent = "Nenhum produto disponivel no momento.";
  } else if (!filteredProducts().length) {
    emptyState.hidden = false;
    emptyState.textContent = "Nenhum produto encontrado com os filtros atuais.";
  }
  observeRevealItems();
}

function renderOffers() {
  const offers = availableProducts().filter((product) => product.weeklyOffer);
  offersGrid.render(offers);
}

function renderCategories() {
  const categories = getCategories(availableProducts());
  categoryFilter.render(categories);
  categorySummary.innerHTML = categories.length
    ? categories
        .map((category) => {
          const total = availableProducts().filter((product) => product.category === category).length;
          return `
            <article class="category-card reveal">
              <span class="icon icon-bag" aria-hidden="true"></span>
              <h3>${category}</h3>
              <p>${total} ${total === 1 ? "produto disponivel" : "produtos disponiveis"} na vitrine.</p>
            </article>
          `;
        })
        .join("")
    : `<p class="empty-state">As categorias aparecem aqui assim que houver produtos disponiveis.</p>`;
}

function setWhatsappLinks() {
  document.querySelectorAll("[data-whatsapp-general]").forEach((link) => {
    link.href = buildWhatsappUrl();
  });
}

function observeRevealItems() {
  const revealItems = document.querySelectorAll(".reveal:not(.is-visible)");

  if (!("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  if (!revealObserver) {
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16 }
    );
  }

  revealItems.forEach((item) => revealObserver.observe(item));
}

async function boot() {
  renderSkeletons();
  state.products = await loadProducts();
  setWhatsappLinks();
  renderCategories();
  renderOffers();
  renderCatalog();
  observeRevealItems();
}

function openGalleryImage(src, alt) {
  galleryModal.innerHTML = `
    <figure class="gallery-dialog">
      <button class="modal-close" type="button" aria-label="Fechar imagem" data-close-gallery>X</button>
      <img src="${src}" alt="${alt}" />
    </figure>
  `;
  galleryModal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeGalleryImage() {
  galleryModal.hidden = true;
  galleryModal.innerHTML = "";
  document.body.classList.remove("modal-open");
}

searchInput.addEventListener("input", (event) => {
  state.search = event.target.value;
  renderCatalog();
});

if (menuToggle && nav) {
  menuToggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });

  nav.addEventListener("click", (event) => {
    if (event.target.matches("a")) {
      nav.classList.remove("is-open");
      menuToggle.setAttribute("aria-expanded", "false");
    }
  });
}

window.addEventListener("scroll", () => {
  if (header) header.classList.toggle("is-scrolled", window.scrollY > 24);
});

window.addEventListener("products:updated", (event) => {
  state.products = event.detail;
  renderCategories();
  renderOffers();
  renderCatalog();
});

if (galleryEl && galleryModal) {
  galleryEl.addEventListener("click", (event) => {
    const button = event.target.closest("[data-gallery-image]");
    if (!button) return;
    const image = button.querySelector("img");
    openGalleryImage(button.dataset.galleryImage, image?.alt || "Foto da loja MENEZZI");
  });

  galleryModal.addEventListener("click", (event) => {
    if (event.target === galleryModal || event.target.closest("[data-close-gallery]")) closeGalleryImage();
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && galleryModal && !galleryModal.hidden) closeGalleryImage();
});

boot().catch((error) => {
  setWhatsappLinks();
  categoryFilter.render([]);
  categorySummary.innerHTML = `<p class="empty-state">As categorias aparecem aqui quando os produtos forem carregados do Supabase.</p>`;
  offersGrid.render([]);
  productGridEl.innerHTML = "";
  emptyState.hidden = false;
  emptyState.textContent =
    error.status === 503
      ? "Supabase ainda nao esta configurado. Verifique as variaveis de ambiente na Vercel."
      : "Nao foi possivel carregar os produtos do Supabase agora.";
  observeRevealItems();
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}
