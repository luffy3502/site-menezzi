import { buildWhatsappUrl, storeConfig } from "./js/config.js";
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
const heroImage = document.querySelector("[data-hero-image]");
const bannerTitle = document.querySelector("[data-banner-title]");
const bannerSubtitle = document.querySelector("[data-banner-subtitle]");
const bannerButton = document.querySelector("[data-banner-button]");
const heroSlogan = document.querySelector("[data-hero-slogan]");
const impactPhrase = document.querySelector("[data-impact-phrase]");
const testimonialsSection = document.querySelector("[data-testimonials-section]");
const testimonialCarousel = document.querySelector("[data-testimonial-carousel]");
const instagramGrid = document.querySelector("[data-instagram-grid]");
const instagramLink = document.querySelector("[data-instagram-link]");
const footerDescription = document.querySelector("[data-footer-description]");
const footerInstagram = document.querySelector("[data-footer-instagram]");
const footerFacebook = document.querySelector("[data-footer-facebook]");
const footerAddress = document.querySelector("[data-footer-address]");
const footerHours = document.querySelector("[data-footer-hours]");
const footerPayments = document.querySelector("[data-footer-payments]");
const footerMap = document.querySelector("[data-footer-map]");
const modal = ProductModal(document.querySelector("[data-product-modal]"));

let revealObserver;
let navObserver;
let storefrontContent = { gallery: [], categories: [], testimonials: [], instagram: [], settings: {} };
let activeGallery = [];
let activeGalleryIndex = 0;
let testimonialTimer;
let storefrontRefreshTimer;
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
  if (testimonialCarousel && testimonialsSection) {
    testimonialsSection.hidden = false;
    testimonialCarousel.innerHTML = Array.from({ length: 3 }, () => '<article class="testimonial-skeleton"></article>').join("");
  }
}

async function loadStorefrontContent() {
  const response = await fetch(storeConfig.storefrontContentApiUrl, { cache: "no-store", credentials: "same-origin" });
  if (!response.ok) return null;
  return response.json();
}

function applyStorefrontContent(content) {
  if (!content) {
    renderTestimonials();
    renderInstagram();
    return;
  }
  storefrontContent = {
    gallery: content.gallery || [],
    categories: content.categories || [],
    testimonials: content.testimonials || [],
    instagram: content.instagram || [],
    settings: content.settings || {},
  };
  const settings = content.settings || {};
  if (settings.primaryColor) document.documentElement.style.setProperty("--ink", settings.primaryColor);
  if (settings.accentColor) document.documentElement.style.setProperty("--gold", settings.accentColor);
  if (settings.whatsapp) storeConfig.whatsappNumber = String(settings.whatsapp).replace(/\D/g, "") || storeConfig.whatsappNumber;
  if (settings.bannerImage && heroImage) heroImage.src = settings.bannerImage;
  if (settings.bannerTitle && bannerTitle) bannerTitle.textContent = settings.bannerTitle;
  if (settings.bannerSubtitle && bannerSubtitle) bannerSubtitle.textContent = settings.bannerSubtitle;
  if (settings.heroSlogan && heroSlogan) heroSlogan.textContent = settings.heroSlogan;
  if (settings.impactPhrase && impactPhrase) impactPhrase.textContent = settings.impactPhrase;
  if (settings.bannerButtonText && bannerButton) bannerButton.innerHTML = `<span aria-hidden="true">→</span> ${settings.bannerButtonText}`;
  if (settings.bannerButtonLink && bannerButton) bannerButton.href = settings.bannerButtonLink;
  if (settings.instagram && instagramLink) instagramLink.href = settings.instagram;
  if (settings.instagram && footerInstagram) footerInstagram.href = settings.instagram;
  if (settings.facebook && footerFacebook) {
    footerFacebook.href = settings.facebook;
    footerFacebook.hidden = false;
  }
  if (settings.footerDescription && footerDescription) footerDescription.textContent = settings.footerDescription;
  if (footerAddress) footerAddress.textContent = settings.address || "";
  if (footerHours) footerHours.textContent = settings.hours || "";
  if (footerPayments) footerPayments.textContent = settings.paymentMethods || "";
  if (settings.mapUrl && footerMap) {
    footerMap.href = settings.mapUrl;
    footerMap.hidden = false;
  }

  const gallery = (content.gallery || []).filter((item) => item.active !== false);
  if (gallery.length && galleryEl) {
    const cover = gallery.find((item) => item.cover);
    activeGallery = cover ? [cover, ...gallery.filter((item) => item.id !== cover.id)] : gallery;
    galleryEl.innerHTML = activeGallery
      .slice(0, 6)
      .map(
        (item, index) => `
          <button type="button" class="mosaic-item ${index === 0 ? "large" : ""} ${index === 3 ? "tall" : ""}" data-gallery-index="${index}" data-gallery-image="${item.image}">
            <img src="${item.image}" alt="${item.title || "Foto da loja MENEZZI"}" loading="lazy" />
            <span>${item.title || "MENEZZI"}</span>
          </button>
        `
      )
      .join("");
  }
  renderTestimonials();
  renderInstagram();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function testimonialStars(rating) {
  const value = Math.max(1, Math.min(5, Number(rating || 5)));
  return `${"★".repeat(value)}${"☆".repeat(5 - value)}`;
}

function testimonialRatingLabel(rating) {
  return ["uma estrela", "duas estrelas", "tres estrelas", "quatro estrelas", "cinco estrelas"][
    Math.max(1, Math.min(5, Number(rating || 5))) - 1
  ];
}

function testimonialInitials(name) {
  return String(name || "Cliente")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function renderTestimonialsLegacy() {
  const testimonials = (storefrontContent.testimonials || []).filter((item) => item.active !== false);
  if (!testimonialCarousel || !testimonialsSection) return;
  window.clearInterval(testimonialTimer);
  if (!testimonials.length) {
    testimonialsSection.hidden = false;
    testimonialCarousel.innerHTML = `
      <div class="testimonial-empty">
        <span class="section-kicker">Depoimentos</span>
        <p>Ainda nao ha avaliacoes cadastradas.</p>
      </div>
    `;
    return;
  }
  testimonialsSection.hidden = false;
  testimonialCarousel.innerHTML = testimonials
    .map(
      (item, index) => `
        <article class="testimonial-card reveal ${index === 0 ? "is-active" : ""}" data-testimonial-slide="${index}">
          <div class="testimonial-person">
            ${
              item.image
                ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name || "Cliente MENEZZI")}" loading="lazy" />`
                : `<span class="testimonial-avatar" aria-hidden="true">${escapeHtml(testimonialInitials(item.name))}</span>`
            }
            <div>
              <strong>${escapeHtml(item.name || "Cliente MENEZZI")}</strong>
              <span>${escapeHtml(item.city || "Cliente MENEZZI")}</span>
            </div>
          </div>
          <div class="stars" aria-label="${item.rating || 5} estrelas">${"★".repeat(Number(item.rating || 5))}</div>
          <p>${item.comment}</p>
        </article>
      `
    )
    .join("");

  window.clearInterval(testimonialTimer);
  if (testimonials.length > 1) {
    let index = 0;
    testimonialTimer = window.setInterval(() => {
      const slides = testimonialCarousel.querySelectorAll("[data-testimonial-slide]");
      slides[index]?.classList.remove("is-active");
      index = (index + 1) % slides.length;
      slides[index]?.classList.add("is-active");
    }, 5200);
  }
}

function renderTestimonials() {
  const testimonials = (storefrontContent.testimonials || []).filter((item) => item.active !== false);
  if (!testimonialCarousel || !testimonialsSection) return;
  window.clearInterval(testimonialTimer);

  if (!testimonials.length) {
    testimonialsSection.hidden = false;
    testimonialCarousel.innerHTML = `
      <div class="testimonial-empty">
        <span class="section-kicker">Depoimentos</span>
        <p>Ainda nao ha avaliacoes cadastradas.</p>
      </div>
    `;
    return;
  }

  testimonialsSection.hidden = false;
  testimonialCarousel.innerHTML = testimonials
    .map(
      (item, index) => `
        <article class="testimonial-card reveal ${index === 0 ? "is-active" : ""}" data-testimonial-slide="${index}">
          <div class="testimonial-person">
            ${
              item.image
                ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name || "Cliente MENEZZI")}" loading="lazy" />`
                : `<span class="testimonial-avatar" aria-hidden="true">${escapeHtml(testimonialInitials(item.name))}</span>`
            }
            <div>
              <strong>${escapeHtml(item.name || "Cliente MENEZZI")}</strong>
              <span>${escapeHtml(item.city || "Cliente MENEZZI")}</span>
            </div>
          </div>
          <div class="stars" aria-label="${testimonialRatingLabel(item.rating)}">${testimonialStars(item.rating)}</div>
          <p>${escapeHtml(item.comment)}</p>
        </article>
      `
    )
    .join("");
  observeRevealItems();
}

function renderInstagram() {
  if (!instagramGrid) return;
  const photos = (storefrontContent.instagram || []).filter((item) => item.active !== false);
  const fallback = [
    { image: "assets/bolsa-elegance.jpg", title: "Novidades MENEZZI", link: storefrontContent.settings.instagram },
    { image: "assets/bolsa-tote.jpg", title: "Produtos selecionados", link: storefrontContent.settings.instagram },
    { image: "assets/bolsa-classica.jpg", title: "Estilo premium", link: storefrontContent.settings.instagram },
    { image: "assets/bolsa-casual-chic.jpg", title: "Curadoria feminina", link: storefrontContent.settings.instagram },
  ];
  const items = photos.length ? photos : fallback;
  instagramGrid.innerHTML = items
    .slice(0, 6)
    .map(
      (item) => `
        <a class="instagram-tile" href="${item.link || storefrontContent.settings.instagram || "https://www.instagram.com/lojamenezzi/"}" target="_blank" rel="noopener">
          <img src="${item.image}" alt="${item.title || "Instagram MENEZZI"}" loading="lazy" />
          <span>${item.title || "Ver no Instagram"}</span>
        </a>
      `
    )
    .join("");
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
  const contentCategories = (storefrontContent.categories || []).filter((category) => category.active !== false);
  const productCategories = getCategories(availableProducts());
  const categories = contentCategories.length
    ? contentCategories.filter((category) => productCategories.includes(category.name) || category.active !== false)
    : productCategories.map((name) => ({ name, image: "", active: true }));
  categoryFilter.render(categories.map((category) => category.name || category));
  categorySummary.innerHTML = categories.length
    ? categories
        .map((category) => {
          const name = category.name || category;
          const total = availableProducts().filter((product) => product.category === name).length;
          const firstProduct = availableProducts().find((product) => product.category === name);
          const image = category.image || firstProduct?.image || "assets/logo-menezzi.jpg";
          return `
            <article class="category-card reveal">
              <img src="${image}" alt="${name}" loading="lazy" />
              <div>
                <span class="icon icon-bag" aria-hidden="true"></span>
                <h3>${name}</h3>
              </div>
              <p>${total} ${total === 1 ? "produto disponivel" : "produtos disponiveis"} na vitrine.</p>
              <a class="button button-light" href="#vitrine" data-category-jump="${name}">Ver produtos</a>
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

function observeActiveNav() {
  const links = [...document.querySelectorAll(".site-nav a[href^='#']")];
  const sections = links.map((link) => document.querySelector(link.getAttribute("href"))).filter(Boolean);
  if (!("IntersectionObserver" in window) || !sections.length) return;
  navObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      links.forEach((link) => link.classList.toggle("is-active", link.getAttribute("href") === `#${visible.target.id}`));
    },
    { rootMargin: "-30% 0px -55% 0px", threshold: [0.12, 0.3, 0.6] }
  );
  sections.forEach((section) => navObserver.observe(section));
}

async function boot() {
  renderSkeletons();
  const contentPromise = loadStorefrontContent().catch(() => null);
  state.products = await loadProducts();
  applyStorefrontContent(await contentPromise);
  setWhatsappLinks();
  renderCategories();
  renderOffers();
  renderCatalog();
  observeRevealItems();
  observeActiveNav();
  startStorefrontAutoRefresh();
}

function startStorefrontAutoRefresh() {
  window.clearInterval(storefrontRefreshTimer);
  storefrontRefreshTimer = window.setInterval(async () => {
    if (document.hidden) return;
    applyStorefrontContent(await loadStorefrontContent().catch(() => null));
  }, 60000);
}

document.addEventListener("visibilitychange", async () => {
  if (!document.hidden) applyStorefrontContent(await loadStorefrontContent().catch(() => null));
});

function openGalleryImage(indexOrSrc, alt) {
  if (!activeGallery.length && galleryEl) {
    activeGallery = [...galleryEl.querySelectorAll("[data-gallery-image]")].map((button) => ({
      image: button.dataset.galleryImage,
      title: button.querySelector("img")?.alt || "MENEZZI",
      caption: "",
    }));
  }
  if (typeof indexOrSrc === "number") {
    activeGalleryIndex = indexOrSrc;
  } else {
    activeGalleryIndex = activeGallery.findIndex((item) => item.image === indexOrSrc);
    if (activeGalleryIndex < 0) activeGalleryIndex = 0;
  }
  const item = activeGallery[activeGalleryIndex] || { image: indexOrSrc, title: alt, caption: "" };
  galleryModal.innerHTML = `
    <figure class="gallery-dialog">
      <button class="modal-close" type="button" aria-label="Fechar imagem" data-close-gallery>X</button>
      <button class="gallery-nav prev" type="button" aria-label="Foto anterior" data-gallery-prev>‹</button>
      <img src="${item.image}" alt="${item.title || alt || "Foto da loja MENEZZI"}" data-gallery-zoom />
      <button class="gallery-nav next" type="button" aria-label="Proxima foto" data-gallery-next>›</button>
      <figcaption>
        <strong>${item.title || "MENEZZI"}</strong>
        <span>${item.caption || "Toque na imagem para ampliar."}</span>
      </figcaption>
    </figure>
  `;
  galleryModal.hidden = false;
  document.body.classList.add("modal-open");
}

function moveGallery(delta) {
  if (!activeGallery.length) return;
  activeGalleryIndex = (activeGalleryIndex + delta + activeGallery.length) % activeGallery.length;
  openGalleryImage(activeGalleryIndex);
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
  function closeMobileMenu() {
    nav.classList.remove("is-open");
    menuToggle.classList.remove("is-active");
    menuToggle.setAttribute("aria-expanded", "false");
  }

  menuToggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    menuToggle.classList.toggle("is-active", isOpen);
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });

  nav.addEventListener("click", (event) => {
    if (event.target.matches("a")) {
      closeMobileMenu();
    }
  });

  window.addEventListener(
    "scroll",
    () => {
      if (nav.classList.contains("is-open")) closeMobileMenu();
    },
    { passive: true }
  );

  window.addEventListener("resize", () => {
    if (window.innerWidth > 1399) closeMobileMenu();
  });
}

if (categorySummary) {
  categorySummary.addEventListener("click", (event) => {
    const link = event.target.closest("[data-category-jump]");
    if (!link) return;
    state.category = link.dataset.categoryJump;
    categoryFilter.setActiveCategory(state.category);
    renderCatalog();
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
    openGalleryImage(Number(button.dataset.galleryIndex || 0), image?.alt || "Foto da loja MENEZZI");
  });

  galleryModal.addEventListener("click", (event) => {
    if (event.target === galleryModal || event.target.closest("[data-close-gallery]")) closeGalleryImage();
    if (event.target.closest("[data-gallery-prev]")) moveGallery(-1);
    if (event.target.closest("[data-gallery-next]")) moveGallery(1);
    if (event.target.closest("[data-gallery-zoom]")) event.target.classList.toggle("is-zoomed");
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && galleryModal && !galleryModal.hidden) closeGalleryImage();
  if (event.key === "ArrowLeft" && galleryModal && !galleryModal.hidden) moveGallery(-1);
  if (event.key === "ArrowRight" && galleryModal && !galleryModal.hidden) moveGallery(1);
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
