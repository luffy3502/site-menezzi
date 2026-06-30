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
const modal = ProductModal(document.querySelector("[data-product-modal]"));

let revealObserver;
const categoryFilter = CategoryFilter(categoryFilterEl, (category) => {
  state.category = category;
  renderCatalog();
});
const productGrid = ProductGrid(productGridEl, emptyState, openProduct);
const offersGrid = ProductGrid(offersGridEl, null, openProduct);

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
  observeRevealItems();
}

function renderOffers() {
  offersGrid.render(availableProducts().filter((product) => product.weeklyOffer));
}

function renderCategories() {
  const categories = getCategories(availableProducts());
  categoryFilter.render(categories);
  categorySummary.innerHTML = categories
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
    .join("");
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
  state.products = await loadProducts();
  setWhatsappLinks();
  renderCategories();
  renderOffers();
  renderCatalog();
  observeRevealItems();
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

boot().catch(() => {
  productGridEl.innerHTML = "";
  emptyState.hidden = false;
  emptyState.textContent = "Nao foi possivel carregar os produtos.";
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}
