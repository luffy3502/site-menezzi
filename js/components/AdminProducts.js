import {
  createCategory,
  createProduct,
  deleteCategory,
  deleteGalleryItem,
  deleteInstagramItem,
  deleteProduct,
  deleteTestimonial,
  getCategories,
  reorderGalleryItems,
  reorderInstagramItems,
  reorderProducts,
  reorderTestimonials,
  saveGalleryItem,
  saveInstagramItem,
  saveStoreSettings,
  saveTestimonial,
  updateProduct,
  uploadProductImage,
  uploadProductImageWithProgress,
} from "../products-store.js";
import { categoryOptions, formatCurrency, getOfferLabel, getOfferType, offerTypes } from "../config.js";

const FALLBACK_IMAGE = "../assets/logo-menezzi.jpg";
const DEFAULT_CATEGORIES = categoryOptions;
const MAX_EXTRA_IMAGES = 10;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const AVAILABILITY_OPTIONS = [
  { value: "true", label: "Disponivel", tone: "success" },
  { value: "false", label: "Indisponivel", tone: "danger" },
];

function adminImageSrc(image) {
  if (!image) return FALLBACK_IMAGE;
  return /^(https?:|blob:|data:)/i.test(image) || image.startsWith("../") ? image : `../${image}`;
}

function imageKey(image) {
  return String(image || "").trim().toLowerCase();
}

async function compressImage(file) {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Use imagens JPG, PNG ou WebP.");
  }
  if (!file.type.startsWith("image/")) return file;

  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Nao foi possivel ler a imagem."));
    img.src = URL.createObjectURL(file);
  });

  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(image, 0, 0, width, height);

  const outputType = file.type === "image/png" ? "image/png" : "image/webp";
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, outputType, 0.82));
  URL.revokeObjectURL(image.src);
  if (!blob || blob.size >= file.size) return file;

  const extension = outputType === "image/webp" ? "webp" : "png";
  const name = file.name.replace(/\.[^.]+$/, `.${extension}`);
  return new File([blob], name, { type: outputType, lastModified: Date.now() });
}

function byManualOrder(products) {
  return [...products].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

function sortVisibleProducts(products, sortMode) {
  const sorted = [...products];
  if (sortMode === "name-asc") sorted.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  if (sortMode === "name-desc") sorted.sort((a, b) => b.name.localeCompare(a.name, "pt-BR"));
  if (sortMode === "price-asc") sorted.sort((a, b) => a.price - b.price);
  if (sortMode === "price-desc") sorted.sort((a, b) => b.price - a.price);
  return sortMode === "manual" ? byManualOrder(sorted) : sorted;
}

function normalizeCategory(category) {
  return String(category || "").trim();
}

export function AdminProducts(root, initialProducts, initialContent = {}) {
  const form = root.querySelector("[data-product-form]");
  const formTitle = root.querySelector("[data-form-title]");
  const formMessage = root.querySelector("[data-form-message]");
  const uploadMessage = root.querySelector("[data-upload-message]");
  const list = root.querySelector("[data-admin-list]");
  const offersList = root.querySelector("[data-offers-admin-list]");
  const dashboard = root.querySelector("[data-dashboard]");
  const search = root.querySelector("[data-admin-search]");
  const categorySelect = root.querySelector("[data-admin-category]");
  const availabilitySelect = root.querySelector("[data-admin-availability]");
  const offerSelect = root.querySelector("[data-admin-offer]");
  const sortSelect = root.querySelector("[data-admin-sort]");
  const productCategorySelect = root.querySelector("[data-product-category]");
  const availabilityChoicesEl = root.querySelector("[data-availability-choices]");
  const offerChoicesEl = root.querySelector("[data-offer-choices]");
  const availableInput = root.querySelector("[data-product-available]");
  const offerInput = root.querySelector("[data-product-offer]");
  const clearFiltersButton = root.querySelector("[data-clear-filters]");
  const imageFile = root.querySelector("[data-image-file]");
  const extraImageFiles = root.querySelector("[data-product-extra-files]");
  const imagePreview = root.querySelector("[data-image-preview]");
  const productImagesAdmin = root.querySelector("[data-product-images-admin]");
  const uploadProgress = root.querySelector("[data-upload-progress]");
  const uploadProgressBar = root.querySelector("[data-upload-progress-bar]");
  const productColorName = root.querySelector("[data-product-color-name]");
  const productColorFile = root.querySelector("[data-product-color-file]");
  const productColorsAdmin = root.querySelector("[data-product-colors-admin]");
  const submitButton = form.querySelector('button[type="submit"]');
  const categoryModal = root.ownerDocument.querySelector("[data-category-modal]");
  const categoryForm = root.ownerDocument.querySelector("[data-category-form]");
  const categoryFile = root.ownerDocument.querySelector("[data-category-file]");
  const categoryPreview = root.ownerDocument.querySelector("[data-category-preview]");
  const categoryAdminList = root.querySelector("[data-category-admin-list]");
  const galleryForm = root.querySelector("[data-gallery-form]");
  const galleryFile = root.querySelector("[data-gallery-file]");
  const galleryPreview = root.querySelector("[data-gallery-preview]");
  const galleryAdminList = root.querySelector("[data-gallery-admin-list]");
  const testimonialForm = root.querySelector("[data-testimonial-form]");
  const testimonialFile = root.querySelector("[data-testimonial-file]");
  const testimonialPreview = root.querySelector("[data-testimonial-preview]");
  const testimonialAdminList = root.querySelector("[data-testimonial-admin-list]");
  const instagramForm = root.querySelector("[data-instagram-form]");
  const instagramFile = root.querySelector("[data-instagram-file]");
  const instagramPreview = root.querySelector("[data-instagram-preview]");
  const instagramAdminList = root.querySelector("[data-instagram-admin-list]");
  const bannerForm = root.querySelector("[data-banner-form]");
  const bannerFile = root.querySelector("[data-banner-file]");
  const bannerPreview = root.querySelector("[data-banner-preview]");
  const settingsForm = root.querySelector("[data-settings-form]");
  const footerForm = root.querySelector("[data-footer-form]");

  let products = byManualOrder(initialProducts);
  let categoryRecords = initialContent.categories || [];
  let categories = categoryRecords.map((category) => category.name || category);
  let gallery = initialContent.gallery || [];
  let testimonials = initialContent.testimonials || [];
  let instagram = initialContent.instagram || [];
  let settings = initialContent.settings || {};
  let productExtraImages = [];
  let productVariants = [];
  let saving = false;
  let uploading = false;

  function setMessage(message, isError = false) {
    formMessage.textContent = message;
    formMessage.classList.toggle("is-error", isError);
    if (message) window.clearTimeout(setMessage.timer);
    if (message && !isError) setMessage.timer = window.setTimeout(() => setMessage(""), 4200);
  }

  function setUploadMessage(message, isError = false) {
    uploadMessage.textContent = message;
    uploadMessage.classList.toggle("is-error", isError);
  }

  function setUploadProgress(percent = 0, visible = true) {
    if (!uploadProgress || !uploadProgressBar) return;
    uploadProgress.hidden = !visible;
    uploadProgressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  }

  function resetFileInputs() {
    if (imageFile) imageFile.value = "";
    if (extraImageFiles) extraImageFiles.value = "";
    if (productColorFile) productColorFile.value = "";
  }

  function setBusy(isBusy, message = "") {
    saving = isBusy;
    submitButton.disabled = isBusy || uploading;
    submitButton.classList.toggle("is-loading", isBusy);
    if (message) setMessage(message);
  }

  function currentMaxSortOrder() {
    return products.reduce((max, product) => Math.max(max, product.sortOrder || 0), 0);
  }

  function categoryChoices() {
    return [...new Set([...DEFAULT_CATEGORIES, ...categories, ...getCategories(products)].map(normalizeCategory).filter(Boolean))];
  }

  function categoryRecord(name) {
    return categoryRecords.find((category) => category.name === name) || { name, image: "", active: true, sortOrder: 0 };
  }

  function applyCheckbox(formEl, name, value) {
    if (formEl?.elements[name]) formEl.elements[name].checked = Boolean(value);
  }

  function selectedCategory() {
    return normalizeCategory(productCategorySelect.value) || DEFAULT_CATEGORIES[0];
  }

  function normalizeProductImages(product) {
    const mainImage = product?.image || product?.imageUrl || "";
    const images = Array.isArray(product?.images) ? product.images : [];
    const additionalImages = Array.isArray(product?.additionalImages)
      ? product.additionalImages
      : Array.isArray(product?.additional_images)
        ? product.additional_images
        : [];
    const seen = new Set([imageKey(mainImage)].filter(Boolean));
    return images.reduce((list, item, index) => {
      const normalized = {
        id: item.id || `${product?.id || "new"}-extra-${index}`,
        image: item.image || item.imageUrl || "",
        imageUrl: item.imageUrl || item.image || "",
        sortOrder: Number(item.sortOrder || index + 1),
        primary: Boolean(item.primary),
      };
      if (!normalized.image || normalized.primary || seen.has(imageKey(normalized.image))) return list;
      seen.add(imageKey(normalized.image));
      return [...list, normalized];
    }, []).concat(
      additionalImages.reduce((list, image, index) => {
        if (!image || seen.has(imageKey(image))) return list;
        seen.add(imageKey(image));
        return [...list, { id: `${product?.id || "new"}-additional-${index}`, image, imageUrl: image, sortOrder: images.length + index + 1, primary: false }];
      }, [])
    );
  }

  function normalizeProductVariants(product) {
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    return variants
      .map((item, index) => ({
        id: item.id || `${product?.id || "new"}-variant-${index}`,
        colorName: item.colorName || item.color_name || item.name || "",
        image: item.image || item.imageUrl || "",
        imageUrl: item.imageUrl || item.image || "",
        sortOrder: Number(item.sortOrder || index + 1),
      }))
      .filter((item) => item.colorName && item.image);
  }

  function allProductImages() {
    const mainImage = form.elements.image.value;
    const images = [];
    if (mainImage) {
      images.push({
        id: "current-primary",
        image: mainImage,
        imageUrl: mainImage,
        sortOrder: 1,
        primary: true,
      });
    }
    productExtraImages.forEach((item, index) => {
      if (!item.image || imageKey(item.image) === imageKey(mainImage) || item.image.startsWith("blob:")) return;
      images.push({
        ...item,
        sortOrder: index + 2,
        primary: false,
      });
    });
    return images;
  }

  function renderProductColorsAdmin() {
    if (!productColorsAdmin) return;
    productColorsAdmin.innerHTML = productVariants.length
      ? productVariants
          .map(
            (item, index) => `
              <article class="product-extra-image product-color-admin" draggable="true" data-product-color="${item.image}">
                <img src="${adminImageSrc(item.image)}" alt="${item.colorName}" />
                <div>
                  <strong>${item.colorName}</strong>
                  <div class="admin-actions">
                    <button class="button button-light" type="button" data-product-color-image="${item.image}">Usar imagem</button>
                    <button class="button button-light" type="button" data-product-color-move="${item.image}" data-direction="-1" ${index === 0 ? "disabled" : ""}>Subir</button>
                    <button class="button button-light" type="button" data-product-color-move="${item.image}" data-direction="1" ${index === productVariants.length - 1 ? "disabled" : ""}>Descer</button>
                    <button class="button danger-button" type="button" data-product-color-remove="${item.image}">Remover</button>
                  </div>
                </div>
              </article>
            `
          )
          .join("")
      : '<p class="admin-note">Variações de cor são opcionais.</p>';
  }

  function renderProductImagesAdmin() {
    if (!productImagesAdmin) return;
    productImagesAdmin.innerHTML = productExtraImages.length
      ? productExtraImages
          .map(
            (item, index) => `
              <article class="product-extra-image" draggable="true" data-product-extra-image="${item.image}">
                <img src="${adminImageSrc(item.image)}" alt="Foto adicional do produto" />
                ${item.uploading ? '<span class="status-soft">Enviando</span>' : ""}
                <div class="admin-actions">
                  <button class="button button-light" type="button" data-product-extra-primary="${item.image}" ${item.uploading ? "disabled" : ""}>Usar como principal</button>
                  <button class="button button-light" type="button" data-product-extra-move="${item.image}" data-direction="-1" ${index === 0 || item.uploading ? "disabled" : ""}>Subir</button>
                  <button class="button button-light" type="button" data-product-extra-move="${item.image}" data-direction="1" ${index === productExtraImages.length - 1 || item.uploading ? "disabled" : ""}>Descer</button>
                  <button class="button danger-button" type="button" data-product-extra-remove="${item.image}">Remover</button>
                </div>
              </article>
            `
          )
          .join("")
      : '<p class="admin-note">Fotos adicionais sao opcionais.</p>';
  }

  function formDataToProduct() {
    const data = new FormData(form);
    const id = data.get("id");
    const existing = products.find((product) => product.id === id);
    const image = data.get("image") || existing?.image || "";
    const offerType = offerInput.value || "sem_oferta";

    return {
      id,
      name: data.get("name").trim(),
      price: Number(data.get("price")),
      category: selectedCategory(),
      image,
      imageUrl: image,
      images: allProductImages(),
      additionalImages: productExtraImages.filter((item) => item.image && !item.image.startsWith("blob:")).map((item) => item.image),
      variants: productVariants.map((variant, index) => ({ ...variant, sortOrder: index + 1 })),
      description: data.get("description").trim(),
      offerType,
      weeklyOffer: offerType !== "sem_oferta",
      available: availableInput.value === "true",
      sortOrder: existing?.sortOrder || currentMaxSortOrder() + 1,
    };
  }

  function renderChoiceButtons() {
    availabilityChoicesEl.innerHTML = AVAILABILITY_OPTIONS.map(
      (option) => `
        <button class="choice-chip ${option.tone} ${availableInput.value === option.value ? "is-selected" : ""}" type="button" data-set-available="${option.value}">
          ${option.label}
        </button>
      `
    ).join("");

    offerChoicesEl.innerHTML = offerTypes
      .map(
        (offer) => `
          <button class="choice-chip offer-choice ${offerInput.value === offer.value ? "is-selected" : ""}" type="button" data-set-offer="${offer.value}">
            ${offer.label}
          </button>
        `
      )
      .join("");
  }

  function renderCategorySelects() {
    const choices = categoryChoices();
    const currentProductCategory = productCategorySelect.value || choices[0];
    const currentFilter = categorySelect.value || "Todos";

    productCategorySelect.innerHTML = choices.map((category) => `<option value="${category}">${category}</option>`).join("");
    productCategorySelect.value = choices.includes(currentProductCategory) ? currentProductCategory : choices[0];

    categorySelect.innerHTML = ["Todos", ...choices].map((category) => `<option value="${category}">${category}</option>`).join("");
    categorySelect.value = choices.includes(currentFilter) ? currentFilter : "Todos";
  }

  function clearForm() {
    form.reset();
    form.elements.id.value = "";
    form.elements.image.value = "";
    availableInput.value = "true";
    offerInput.value = "sem_oferta";
    productExtraImages = [];
    productVariants = [];
    if (productColorName) productColorName.value = "";
    resetFileInputs();
    productCategorySelect.value = categoryChoices()[0] || DEFAULT_CATEGORIES[0];
    imagePreview.src = FALLBACK_IMAGE;
    formTitle.textContent = "Novo produto";
    renderCategorySelects();
    renderChoiceButtons();
    setMessage("");
    setUploadMessage("");
    renderProductImagesAdmin();
    renderProductColorsAdmin();
  }

  function editProduct(productId) {
    const product = products.find((item) => item.id === productId);
    if (!product) return;

    const choices = categoryChoices();
    form.elements.id.value = product.id;
    form.elements.name.value = product.name;
    form.elements.price.value = product.price;
    form.elements.image.value = product.image || "";
    form.elements.description.value = product.description || "";
    productCategorySelect.value = choices.includes(product.category) ? product.category : choices[0];
    availableInput.value = String(Boolean(product.available));
    offerInput.value = getOfferType(product);
    productExtraImages = normalizeProductImages(product);
    productVariants = normalizeProductVariants(product);
    imagePreview.src = adminImageSrc(product.image);
    formTitle.textContent = "Editar produto";
    renderChoiceButtons();
    showSection("produtos");
    setMessage("Produto carregado para edicao.");
    setUploadMessage("");
    renderProductImagesAdmin();
    renderProductColorsAdmin();
    resetFileInputs();
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function removeProduct(productId) {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    const confirmed = window.confirm(`Excluir "${product.name}" da vitrine? Essa acao nao pode ser desfeita.`);
    if (!confirmed) return;

    setMessage("Excluindo produto...");
    await deleteProduct(productId);
    products = products.filter((item) => item.id !== productId);
    render();
    setMessage("Produto excluido com sucesso.");
  }

  async function duplicateProduct(productId) {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    setMessage("Duplicando produto...");
    const copy = await createProduct({
      ...product,
      id: "",
      name: `${product.name} - copia`,
      sortOrder: currentMaxSortOrder() + 1,
    });
    products = [...products, copy];
    render();
    setMessage("Produto duplicado com sucesso.");
  }

  async function toggleProduct(productId, field) {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    const patch =
      field === "available"
        ? { ...product, available: !product.available }
        : {
            ...product,
            offerType: product.weeklyOffer ? "sem_oferta" : "oferta_semana",
            weeklyOffer: !product.weeklyOffer,
          };
    const saved = await updateProduct(patch);
    products = products.map((item) => (item.id === saved.id ? saved : item));
    render();
    setMessage("Produto atualizado com sucesso.");
  }

  async function moveProduct(productId, direction) {
    if (sortSelect.value !== "manual") {
      setMessage("Use a ordenacao manual para reordenar produtos.", true);
      return;
    }
    const index = products.findIndex((product) => product.id === productId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= products.length) return;
    const nextProducts = [...products];
    [nextProducts[index], nextProducts[targetIndex]] = [nextProducts[targetIndex], nextProducts[index]];
    products = await reorderProducts(nextProducts.map((product) => product.id));
    render();
  }

  function filteredProducts() {
    const term = search.value.trim().toLowerCase();
    const category = categorySelect.value;
    const availability = availabilitySelect.value;
    const offer = offerSelect.value;

    const filtered = products.filter((product) => {
      const matchesTerm = !term || product.name.toLowerCase().includes(term);
      const matchesCategory = category === "Todos" || product.category === category;
      const matchesAvailability =
        availability === "Todos" ||
        (availability === "Disponivel" && product.available) ||
        (availability === "Indisponivel" && !product.available);
      const matchesOffer = offer === "Todos" || getOfferType(product) === offer;
      return matchesTerm && matchesCategory && matchesAvailability && matchesOffer;
    });

    return sortVisibleProducts(filtered, sortSelect.value);
  }

  function productRow(product) {
    const index = products.findIndex((item) => item.id === product.id);
    const offerType = getOfferType(product);
    return `
      <article class="admin-product">
        <img src="${adminImageSrc(product.image)}" alt="${product.name}" />
        <div>
          <div class="admin-product-title">
            <h3>${product.name}</h3>
            <strong>${formatCurrency(product.price)}</strong>
          </div>
          <div class="status-row">
            <span class="status-category">${product.category}</span>
            <span class="${product.available ? "status-ok" : "status-muted"}">${product.available ? "Disponivel" : "Indisponivel"}</span>
            ${offerType !== "sem_oferta" ? `<span class="status-offer">${getOfferLabel(offerType)}</span>` : '<span class="status-soft">Sem oferta</span>'}
          </div>
        </div>
        <div class="admin-actions">
          <button class="button button-light" type="button" data-edit-product="${product.id}">✎ Editar</button>
          <button class="button button-light" type="button" data-duplicate-product="${product.id}">⧉ Duplicar</button>
          <button class="button button-light" type="button" data-toggle-offer="${product.id}">★ ${product.weeklyOffer ? "Remover oferta" : "Marcar oferta"}</button>
          <button class="button button-light" type="button" data-move-product="${product.id}" data-direction="-1" ${index === 0 ? "disabled" : ""}>↑ Subir</button>
          <button class="button button-light" type="button" data-move-product="${product.id}" data-direction="1" ${index === products.length - 1 ? "disabled" : ""}>↓ Descer</button>
          <button class="button button-light" type="button" data-toggle-available="${product.id}">${product.available ? "○ Desativar" : "● Ativar"}</button>
          <button class="button danger-button" type="button" data-delete-product="${product.id}">× Excluir</button>
        </div>
      </article>
    `;
  }

  function renderFilters() {
    renderCategorySelects();
    const currentOffer = offerSelect.value || "Todos";
    offerSelect.innerHTML = [
      '<option value="Todos">Todos</option>',
      ...offerTypes.map((offer) => `<option value="${offer.value}">${offer.label}</option>`),
    ].join("");
    offerSelect.value = currentOffer === "Todos" || offerTypes.some((offer) => offer.value === currentOffer) ? currentOffer : "Todos";
    renderChoiceButtons();
  }

  function renderList() {
    list.innerHTML = filteredProducts().map(productRow).join("") || '<p class="empty-state">Nenhum produto encontrado.</p>';
    offersList.innerHTML =
      products.filter((product) => product.weeklyOffer).map(productRow).join("") ||
      '<p class="empty-state">Nenhum produto marcado como oferta.</p>';
  }

  function renderDashboard() {
    const available = products.filter((product) => product.available).length;
    const offers = products.filter((product) => product.weeklyOffer).length;
    dashboard.innerHTML = `
      <article class="metric-card"><span>Produtos</span><strong>${products.length}</strong></article>
      <article class="metric-card"><span>Disponiveis</span><strong>${available}</strong></article>
      <article class="metric-card"><span>Ofertas</span><strong>${offers}</strong></article>
      <article class="metric-card"><span>Categorias</span><strong>${categoryChoices().length}</strong></article>
    `;
  }

  function renderCategoriesAdmin() {
    categoryAdminList.innerHTML = categoryChoices()
      .map(
        (category) => `
          <article class="category-admin-item">
            <img src="${adminImageSrc(categoryRecord(category).image)}" alt="${category}" />
            <div>
              <strong>${category}</strong>
              <span class="${categoryRecord(category).active ? "status-ok" : "status-muted"}">${categoryRecord(category).active ? "Ativa" : "Inativa"}</span>
            </div>
            <div class="admin-actions">
              <button class="button button-light" type="button" data-edit-category="${category}">Editar</button>
              <button class="button button-light" type="button" data-toggle-category="${category}">${categoryRecord(category).active ? "Desativar" : "Ativar"}</button>
              <button class="button button-light" type="button" data-delete-category="${category}">Excluir</button>
            </div>
          </article>
        `
      )
      .join("");
  }

  function renderGalleryAdmin() {
    galleryAdminList.innerHTML =
      gallery
        .map(
          (item, index) => `
            <article class="gallery-admin-card" draggable="true" data-gallery-card="${item.id}">
              <img src="${adminImageSrc(item.image)}" alt="${item.title || "Foto da loja"}" />
              <strong>${item.title || "Foto da loja"}</strong>
              <p>${item.caption || "Sem legenda"}</p>
              <div class="status-row">
                <span class="${item.active ? "status-ok" : "status-muted"}">${item.active ? "Ativa" : "Inativa"}</span>
                ${item.cover ? '<span class="status-offer">Capa</span>' : ""}
              </div>
              <div class="admin-actions">
                <button class="button button-light" type="button" data-edit-gallery="${item.id}">Editar</button>
                <button class="button button-light" type="button" data-move-gallery="${item.id}" data-direction="-1" ${index === 0 ? "disabled" : ""}>↑</button>
                <button class="button button-light" type="button" data-move-gallery="${item.id}" data-direction="1" ${index === gallery.length - 1 ? "disabled" : ""}>↓</button>
                <button class="button button-light" type="button" data-toggle-gallery="${item.id}">${item.active ? "Desativar" : "Ativar"}</button>
                <button class="button danger-button" type="button" data-delete-gallery="${item.id}">Excluir</button>
              </div>
            </article>
          `
        )
        .join("") || '<p class="empty-state">Adicione fotos da loja para aparecerem automaticamente na home.</p>';
  }

  function renderTestimonialsAdmin() {
    testimonialAdminList.innerHTML =
      testimonials
        .map(
          (item, index) => `
            <article class="gallery-admin-card" draggable="true" data-testimonial-card="${item.id}">
              <img src="${adminImageSrc(item.image)}" alt="${item.name || "Cliente"}" />
              <strong>${item.name || "Cliente"}</strong>
              <p>${item.comment || ""}</p>
              <div class="status-row">
                <span class="status-offer">${"★".repeat(Number(item.rating || 5))}</span>
                <span class="${item.active ? "status-ok" : "status-muted"}">${item.active ? "Ativo" : "Inativo"}</span>
              </div>
              <div class="admin-actions">
                <button class="button button-light" type="button" data-edit-testimonial="${item.id}">Editar</button>
                <button class="button button-light" type="button" data-move-testimonial="${item.id}" data-direction="-1" ${index === 0 ? "disabled" : ""}>Subir</button>
                <button class="button button-light" type="button" data-move-testimonial="${item.id}" data-direction="1" ${index === testimonials.length - 1 ? "disabled" : ""}>Descer</button>
                <button class="button button-light" type="button" data-toggle-testimonial="${item.id}">${item.active ? "Desativar" : "Ativar"}</button>
                <button class="button danger-button" type="button" data-delete-testimonial="${item.id}">Excluir</button>
              </div>
            </article>
          `
        )
        .join("") || '<p class="empty-state">Cadastre depoimentos para aparecerem na home.</p>';
  }

  function renderInstagramAdmin() {
    instagramAdminList.innerHTML =
      instagram
        .map(
          (item, index) => `
            <article class="gallery-admin-card" draggable="true" data-instagram-card="${item.id}">
              <img src="${adminImageSrc(item.image)}" alt="${item.title || "Instagram"}" />
              <strong>${item.title || "Foto do Instagram"}</strong>
              <p>${item.link || "Sem link especifico"}</p>
              <div class="status-row">
                <span class="${item.active ? "status-ok" : "status-muted"}">${item.active ? "Ativa" : "Inativa"}</span>
              </div>
              <div class="admin-actions">
                <button class="button button-light" type="button" data-edit-instagram="${item.id}">Editar</button>
                <button class="button button-light" type="button" data-move-instagram="${item.id}" data-direction="-1" ${index === 0 ? "disabled" : ""}>Subir</button>
                <button class="button button-light" type="button" data-move-instagram="${item.id}" data-direction="1" ${index === instagram.length - 1 ? "disabled" : ""}>Descer</button>
                <button class="button button-light" type="button" data-toggle-instagram="${item.id}">${item.active ? "Desativar" : "Ativar"}</button>
                <button class="button danger-button" type="button" data-delete-instagram="${item.id}">Excluir</button>
              </div>
            </article>
          `
        )
        .join("") || '<p class="empty-state">Adicione fotos para montar a grade do Instagram.</p>';
  }

  function fillSettingsForms() {
    if (!settingsForm || !bannerForm) return;
    Object.entries(settings).forEach(([key, value]) => {
      if (settingsForm.elements[key]) settingsForm.elements[key].value = value || "";
      if (bannerForm.elements[key]) bannerForm.elements[key].value = value || "";
      if (footerForm?.elements[key]) footerForm.elements[key].value = value || "";
    });
    if (bannerForm.elements.bannerImage) bannerForm.elements.bannerImage.value = settings.bannerImage || "";
    if (bannerPreview) bannerPreview.src = adminImageSrc(settings.bannerImage);
  }

  function render() {
    products = byManualOrder(products);
    renderFilters();
    renderList();
    renderDashboard();
    renderCategoriesAdmin();
    renderGalleryAdmin();
    renderTestimonialsAdmin();
    renderInstagramAdmin();
    fillSettingsForms();
  }

  function showSection(sectionName) {
    root.querySelectorAll("[data-admin-section]").forEach((section) => {
      section.classList.toggle("is-active", section.dataset.adminSection === sectionName);
    });
    root.querySelectorAll("[data-admin-section-button]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.adminSectionButton === sectionName);
    });
  }

  function editCategory(name) {
    const category = categoryRecord(name);
    categoryForm.elements.oldName.value = name;
    categoryForm.elements.name.value = name;
    categoryForm.elements.image.value = category.image || "";
    applyCheckbox(categoryForm, "active", category.active);
    categoryPreview.src = adminImageSrc(category.image);
    categoryModal.hidden = false;
    categoryForm.elements.name.focus();
  }

  function clearGalleryForm() {
    galleryForm.reset();
    galleryForm.elements.id.value = "";
    galleryForm.elements.image.value = "";
    applyCheckbox(galleryForm, "active", true);
    applyCheckbox(galleryForm, "cover", false);
    galleryPreview.src = FALLBACK_IMAGE;
  }

  function editGallery(id) {
    const item = gallery.find((entry) => entry.id === id);
    if (!item) return;
    galleryForm.elements.id.value = item.id;
    galleryForm.elements.title.value = item.title || "";
    galleryForm.elements.caption.value = item.caption || "";
    galleryForm.elements.image.value = item.image || "";
    applyCheckbox(galleryForm, "active", item.active);
    applyCheckbox(galleryForm, "cover", item.cover);
    galleryPreview.src = adminImageSrc(item.image);
    showSection("galeria");
    galleryForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function clearTestimonialForm() {
    testimonialForm.reset();
    testimonialForm.elements.id.value = "";
    testimonialForm.elements.image.value = "";
    applyCheckbox(testimonialForm, "active", true);
    testimonialPreview.src = FALLBACK_IMAGE;
  }

  function editTestimonial(id) {
    const item = testimonials.find((entry) => entry.id === id);
    if (!item) return;
    testimonialForm.elements.id.value = item.id;
    testimonialForm.elements.name.value = item.name || "";
    testimonialForm.elements.city.value = item.city || "";
    testimonialForm.elements.rating.value = item.rating || 5;
    testimonialForm.elements.comment.value = item.comment || "";
    testimonialForm.elements.image.value = item.image || "";
    applyCheckbox(testimonialForm, "active", item.active);
    testimonialPreview.src = adminImageSrc(item.image);
    showSection("depoimentos");
    testimonialForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function clearInstagramForm() {
    instagramForm.reset();
    instagramForm.elements.id.value = "";
    instagramForm.elements.image.value = "";
    applyCheckbox(instagramForm, "active", true);
    instagramPreview.src = FALLBACK_IMAGE;
  }

  function editInstagram(id) {
    const item = instagram.find((entry) => entry.id === id);
    if (!item) return;
    instagramForm.elements.id.value = item.id;
    instagramForm.elements.title.value = item.title || "";
    instagramForm.elements.link.value = item.link || "";
    instagramForm.elements.image.value = item.image || "";
    applyCheckbox(instagramForm, "active", item.active);
    instagramPreview.src = adminImageSrc(item.image);
    showSection("instagram");
    instagramForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (saving || uploading) return;
    setBusy(true, "Salvando produto...");
    try {
      const product = formDataToProduct();
      if (!product.image) throw new Error("Escolha uma foto para o produto.");
      const saved = product.id ? await updateProduct(product) : await createProduct(product);
      const exists = products.some((item) => item.id === saved.id);
      products = exists ? products.map((item) => (item.id === saved.id ? saved : item)) : [...products, saved];
      render();
      clearForm();
      setMessage("Produto salvo com sucesso.");
    } catch (error) {
      console.error("Erro completo ao salvar produto no Supabase:", error);
      setMessage(error.message, true);
    } finally {
      setBusy(false);
    }
  });

  root.addEventListener("click", async (event) => {
    const section = event.target.closest("[data-admin-section-button]");
    const edit = event.target.closest("[data-edit-product]");
    const remove = event.target.closest("[data-delete-product]");
    const move = event.target.closest("[data-move-product]");
    const duplicate = event.target.closest("[data-duplicate-product]");
    const toggleAvailable = event.target.closest("[data-toggle-available]");
    const toggleOffer = event.target.closest("[data-toggle-offer]");
    const openCategory = event.target.closest("[data-open-category-modal]");
    const editCategoryButton = event.target.closest("[data-edit-category]");
    const toggleCategoryButton = event.target.closest("[data-toggle-category]");
    const deleteCategoryButton = event.target.closest("[data-delete-category]");
    const editGalleryButton = event.target.closest("[data-edit-gallery]");
    const toggleGalleryButton = event.target.closest("[data-toggle-gallery]");
    const deleteGalleryButton = event.target.closest("[data-delete-gallery]");
    const moveGalleryButton = event.target.closest("[data-move-gallery]");
    const editTestimonialButton = event.target.closest("[data-edit-testimonial]");
    const toggleTestimonialButton = event.target.closest("[data-toggle-testimonial]");
    const deleteTestimonialButton = event.target.closest("[data-delete-testimonial]");
    const moveTestimonialButton = event.target.closest("[data-move-testimonial]");
    const editInstagramButton = event.target.closest("[data-edit-instagram]");
    const toggleInstagramButton = event.target.closest("[data-toggle-instagram]");
    const deleteInstagramButton = event.target.closest("[data-delete-instagram]");
    const moveInstagramButton = event.target.closest("[data-move-instagram]");
    const clearGalleryButton = event.target.closest("[data-clear-gallery-form]");
    const clearTestimonialButton = event.target.closest("[data-clear-testimonial-form]");
    const clearInstagramButton = event.target.closest("[data-clear-instagram-form]");
    const productExtraPrimary = event.target.closest("[data-product-extra-primary]");
    const productExtraRemove = event.target.closest("[data-product-extra-remove]");
    const productExtraMove = event.target.closest("[data-product-extra-move]");
    const addProductColor = event.target.closest("[data-add-product-color]");
    const productColorImage = event.target.closest("[data-product-color-image]");
    const productColorRemove = event.target.closest("[data-product-color-remove]");
    const productColorMove = event.target.closest("[data-product-color-move]");
    const focusProduct = event.target.closest("[data-focus-product-form]");
    const available = event.target.closest("[data-set-available]");
    const offer = event.target.closest("[data-set-offer]");

    try {
      if (section) showSection(section.dataset.adminSectionButton);
      if (focusProduct) {
        clearForm();
        showSection("produtos");
        form.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      if (openCategory) {
        categoryForm.reset();
        categoryForm.elements.oldName.value = "";
        categoryForm.elements.image.value = "";
        categoryPreview.src = FALLBACK_IMAGE;
        applyCheckbox(categoryForm, "active", true);
        categoryModal.hidden = false;
        categoryForm.elements.name.focus();
      }
      if (clearGalleryButton) clearGalleryForm();
      if (clearTestimonialButton) clearTestimonialForm();
      if (clearInstagramButton) clearInstagramForm();
      if (productExtraPrimary) {
        const image = productExtraPrimary.dataset.productExtraPrimary;
        if (!image || image.startsWith("blob:")) return;
        const oldMain = form.elements.image.value;
        productExtraImages = productExtraImages.filter((item) => imageKey(item.image) !== imageKey(image));
        if (oldMain && !productExtraImages.some((item) => imageKey(item.image) === imageKey(oldMain))) {
          productExtraImages = [{ id: `extra-${Date.now()}`, image: oldMain, imageUrl: oldMain }, ...productExtraImages];
        }
        form.elements.image.value = image;
        imagePreview.src = adminImageSrc(image);
        renderProductImagesAdmin();
      }
      if (productExtraRemove) {
        productExtraImages = productExtraImages.filter((item) => imageKey(item.image) !== imageKey(productExtraRemove.dataset.productExtraRemove));
        renderProductImagesAdmin();
      }
      if (productExtraMove) {
        const index = productExtraImages.findIndex((item) => item.image === productExtraMove.dataset.productExtraMove);
        const targetIndex = index + Number(productExtraMove.dataset.direction);
        if (index >= 0 && targetIndex >= 0 && targetIndex < productExtraImages.length) {
          const next = [...productExtraImages];
          [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
          productExtraImages = next;
          renderProductImagesAdmin();
        }
      }
      if (addProductColor) {
        const colorName = productColorName.value.trim();
        const file = productColorFile.files[0];
        if (!colorName || !file) {
          setMessage("Informe o nome da cor e escolha uma imagem.", true);
          return;
        }
        setUploadMessage("Enviando imagem da cor...");
        const url = await uploadProductImage(file);
        productVariants = [...productVariants, { id: `variant-${Date.now()}`, colorName, image: url, imageUrl: url }];
        productColorName.value = "";
        productColorFile.value = "";
        renderProductColorsAdmin();
        setUploadMessage("Variação de cor adicionada.");
      }
      if (productColorImage) {
        const image = productColorImage.dataset.productColorImage;
        if (productExtraImages.length < MAX_EXTRA_IMAGES && form.elements.image.value && !productExtraImages.some((item) => imageKey(item.image) === imageKey(form.elements.image.value))) {
          productExtraImages = [{ id: `extra-${Date.now()}`, image: form.elements.image.value, imageUrl: form.elements.image.value }, ...productExtraImages];
        }
        form.elements.image.value = image;
        imagePreview.src = adminImageSrc(image);
        renderProductImagesAdmin();
      }
      if (productColorRemove) {
        productVariants = productVariants.filter((item) => item.image !== productColorRemove.dataset.productColorRemove);
        renderProductColorsAdmin();
      }
      if (productColorMove) {
        const index = productVariants.findIndex((item) => item.image === productColorMove.dataset.productColorMove);
        const targetIndex = index + Number(productColorMove.dataset.direction);
        if (index >= 0 && targetIndex >= 0 && targetIndex < productVariants.length) {
          const next = [...productVariants];
          [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
          productVariants = next;
          renderProductColorsAdmin();
        }
      }
      if (available) {
        availableInput.value = available.dataset.setAvailable;
        renderChoiceButtons();
      }
      if (offer) {
        offerInput.value = offer.dataset.setOffer;
        renderChoiceButtons();
      }
      if (edit) editProduct(edit.dataset.editProduct);
      if (remove) await removeProduct(remove.dataset.deleteProduct);
      if (move) await moveProduct(move.dataset.moveProduct, Number(move.dataset.direction));
      if (duplicate) await duplicateProduct(duplicate.dataset.duplicateProduct);
      if (toggleAvailable) await toggleProduct(toggleAvailable.dataset.toggleAvailable, "available");
      if (toggleOffer) await toggleProduct(toggleOffer.dataset.toggleOffer, "offer");
      if (editCategoryButton) editCategory(editCategoryButton.dataset.editCategory);
      if (toggleCategoryButton) {
        const current = categoryRecord(toggleCategoryButton.dataset.toggleCategory);
        const saved = await createCategory({ ...current, oldName: current.name, active: !current.active });
        categoryRecords = categoryRecords.some((item) => item.name === current.name)
          ? categoryRecords.map((item) => (item.name === current.name ? saved : item))
          : [...categoryRecords, saved];
        categories = categoryRecords.map((category) => category.name);
        render();
        setMessage("Categoria atualizada.");
      }
      if (deleteCategoryButton) {
        const name = deleteCategoryButton.dataset.deleteCategory;
        if (DEFAULT_CATEGORIES.includes(name)) {
          setMessage("Categorias padrao nao podem ser excluidas.", true);
          return;
        }
        if (!window.confirm(`Excluir a categoria "${name}"?`)) return;
        await deleteCategory(name);
        categories = categories.filter((category) => category !== name);
        categoryRecords = categoryRecords.filter((category) => category.name !== name);
        render();
        setMessage("Categoria excluida.");
      }
      if (editGalleryButton) editGallery(editGalleryButton.dataset.editGallery);
      if (toggleGalleryButton) {
        const item = gallery.find((entry) => entry.id === toggleGalleryButton.dataset.toggleGallery);
        const saved = await saveGalleryItem({ ...item, active: !item.active });
        gallery = gallery.map((entry) => (entry.id === saved.id ? saved : entry));
        render();
        setMessage("Foto atualizada.");
      }
      if (deleteGalleryButton) {
        if (!window.confirm("Excluir esta foto da galeria?")) return;
        await deleteGalleryItem(deleteGalleryButton.dataset.deleteGallery);
        gallery = gallery.filter((item) => item.id !== deleteGalleryButton.dataset.deleteGallery);
        render();
        setMessage("Foto excluida da galeria.");
      }
      if (moveGalleryButton) {
        const index = gallery.findIndex((item) => item.id === moveGalleryButton.dataset.moveGallery);
        const targetIndex = index + Number(moveGalleryButton.dataset.direction);
        if (targetIndex < 0 || targetIndex >= gallery.length) return;
        const next = [...gallery];
        [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
        gallery = await reorderGalleryItems(next.map((item) => item.id));
        render();
      }
      if (editTestimonialButton) editTestimonial(editTestimonialButton.dataset.editTestimonial);
      if (toggleTestimonialButton) {
        const item = testimonials.find((entry) => entry.id === toggleTestimonialButton.dataset.toggleTestimonial);
        const saved = await saveTestimonial({ ...item, active: !item.active });
        testimonials = testimonials.map((entry) => (entry.id === saved.id ? saved : entry));
        render();
        setMessage("Depoimento atualizado.");
      }
      if (deleteTestimonialButton) {
        if (!window.confirm("Excluir este depoimento?")) return;
        await deleteTestimonial(deleteTestimonialButton.dataset.deleteTestimonial);
        testimonials = testimonials.filter((item) => item.id !== deleteTestimonialButton.dataset.deleteTestimonial);
        render();
        setMessage("Depoimento excluido.");
      }
      if (moveTestimonialButton) {
        const index = testimonials.findIndex((item) => item.id === moveTestimonialButton.dataset.moveTestimonial);
        const targetIndex = index + Number(moveTestimonialButton.dataset.direction);
        if (targetIndex < 0 || targetIndex >= testimonials.length) return;
        const next = [...testimonials];
        [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
        testimonials = await reorderTestimonials(next.map((item) => item.id));
        render();
      }
      if (editInstagramButton) editInstagram(editInstagramButton.dataset.editInstagram);
      if (toggleInstagramButton) {
        const item = instagram.find((entry) => entry.id === toggleInstagramButton.dataset.toggleInstagram);
        const saved = await saveInstagramItem({ ...item, active: !item.active });
        instagram = instagram.map((entry) => (entry.id === saved.id ? saved : entry));
        render();
        setMessage("Foto do Instagram atualizada.");
      }
      if (deleteInstagramButton) {
        if (!window.confirm("Excluir esta foto do Instagram?")) return;
        await deleteInstagramItem(deleteInstagramButton.dataset.deleteInstagram);
        instagram = instagram.filter((item) => item.id !== deleteInstagramButton.dataset.deleteInstagram);
        render();
        setMessage("Foto excluida.");
      }
      if (moveInstagramButton) {
        const index = instagram.findIndex((item) => item.id === moveInstagramButton.dataset.moveInstagram);
        const targetIndex = index + Number(moveInstagramButton.dataset.direction);
        if (targetIndex < 0 || targetIndex >= instagram.length) return;
        const next = [...instagram];
        [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
        instagram = await reorderInstagramItems(next.map((item) => item.id));
        render();
      }
    } catch (error) {
      console.error("Erro completo na acao do painel:", error);
      setMessage(error.message, true);
    }
  });

  root.ownerDocument.querySelector("[data-close-category-modal]").addEventListener("click", () => {
    categoryModal.hidden = true;
  });

  categoryModal.addEventListener("click", (event) => {
    if (event.target === categoryModal) categoryModal.hidden = true;
  });

  categoryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const category = await createCategory({
        oldName: categoryForm.elements.oldName.value,
        name: categoryForm.elements.name.value,
        image: categoryForm.elements.image.value,
        active: categoryForm.elements.active.checked,
        sortOrder: categoryRecord(categoryForm.elements.oldName.value).sortOrder || categoryChoices().length + 1,
      });
      categoryRecords = categoryRecords.some((item) => item.name === categoryForm.elements.oldName.value)
        ? categoryRecords.map((item) => (item.name === categoryForm.elements.oldName.value ? category : item))
        : [...categoryRecords, category];
      categories = [...new Set([...categories, category.name])];
      categoryForm.reset();
      categoryPreview.src = FALLBACK_IMAGE;
      categoryModal.hidden = true;
      render();
      setMessage("Categoria criada com sucesso.");
    } catch (error) {
      setMessage(error.message, true);
    }
  });

  categoryFile.addEventListener("change", async () => {
    const file = categoryFile.files[0];
    if (!file) return;
    categoryPreview.src = URL.createObjectURL(file);
    const url = await uploadProductImage(file);
    categoryForm.elements.image.value = url;
    categoryPreview.src = url;
  });

  root.querySelector("[data-clear-form]").addEventListener("click", clearForm);
  clearFiltersButton.addEventListener("click", () => {
    search.value = "";
    categorySelect.value = "Todos";
    availabilitySelect.value = "Todos";
    offerSelect.value = "Todos";
    sortSelect.value = "manual";
    renderList();
  });

  [search, categorySelect, availabilitySelect, offerSelect, sortSelect].forEach((control) => {
    control.addEventListener("input", renderList);
    control.addEventListener("change", renderList);
  });

  imageFile.addEventListener("change", async () => {
    const file = imageFile.files[0];
    if (!file) return;
    imagePreview.src = URL.createObjectURL(file);
    uploading = true;
    submitButton.disabled = true;
    setUploadProgress(5);
    setUploadMessage("Enviando imagem...");
    try {
      const optimizedFile = await compressImage(file);
      const url = await uploadProductImageWithProgress(optimizedFile, (percent) => setUploadProgress(percent));
      form.elements.image.value = url;
      imagePreview.src = url;
      setUploadMessage("Upload concluido.");
    } catch (error) {
      console.error("Erro completo ao enviar imagem para o Supabase:", error);
      setUploadMessage(error.message || "Erro ao enviar imagem.", true);
      form.elements.image.value = "";
    } finally {
      uploading = false;
      submitButton.disabled = saving;
      window.setTimeout(() => setUploadProgress(0, false), 900);
    }
  });

  extraImageFiles.addEventListener("change", async () => {
    const files = [...extraImageFiles.files];
    if (!files.length) return;
    const availableSlots = MAX_EXTRA_IMAGES - productExtraImages.length;
    if (availableSlots <= 0) {
      setUploadMessage(`Limite de ${MAX_EXTRA_IMAGES} fotos adicionais atingido.`, true);
      extraImageFiles.value = "";
      return;
    }
    uploading = true;
    submitButton.disabled = true;
    setUploadProgress(0);
    setUploadMessage("Enviando fotos adicionais...");
    try {
      const selectedFiles = files.slice(0, availableSlots);
      let completed = 0;
      for (const file of selectedFiles) {
        const fingerprint = `${file.name}:${file.size}:${file.lastModified}`;
        if (productExtraImages.some((item) => item.fingerprint === fingerprint)) {
          completed += 1;
          continue;
        }
        const previewUrl = URL.createObjectURL(file);
        productExtraImages = [
          ...productExtraImages,
          { id: `pending-${Date.now()}-${file.name}`, image: previewUrl, imageUrl: previewUrl, fingerprint, uploading: true },
        ];
        renderProductImagesAdmin();
        const optimizedFile = await compressImage(file);
        const url = await uploadProductImageWithProgress(optimizedFile, (percent) => {
          setUploadProgress(Math.round(((completed + percent / 100) / selectedFiles.length) * 100));
        });
        if (productExtraImages.some((item) => imageKey(item.image) === imageKey(url))) {
          productExtraImages = productExtraImages.filter((item) => item.image !== previewUrl);
          URL.revokeObjectURL(previewUrl);
          completed += 1;
          continue;
        }
        productExtraImages = productExtraImages.map((item) =>
          item.image === previewUrl ? { id: `extra-${Date.now()}-${file.name}`, image: url, imageUrl: url, fingerprint } : item
        );
        URL.revokeObjectURL(previewUrl);
        completed += 1;
      }
      extraImageFiles.value = "";
      renderProductImagesAdmin();
      setUploadProgress(100);
      setUploadMessage(
        files.length > selectedFiles.length
          ? `Fotos enviadas. O limite e de ${MAX_EXTRA_IMAGES} fotos adicionais por produto.`
          : "Fotos adicionais enviadas."
      );
    } catch (error) {
      console.error("Erro completo ao enviar fotos adicionais:", error);
      setUploadMessage(error.message || "Erro ao enviar fotos adicionais.", true);
      productExtraImages = productExtraImages.filter((item) => !item.image.startsWith("blob:"));
      renderProductImagesAdmin();
    } finally {
      uploading = false;
      submitButton.disabled = saving;
      window.setTimeout(() => setUploadProgress(0, false), 900);
    }
  });

  galleryFile.addEventListener("change", async () => {
    const file = galleryFile.files[0];
    if (!file) return;
    galleryPreview.src = URL.createObjectURL(file);
    const url = await uploadProductImage(file);
    galleryForm.elements.image.value = url;
    galleryPreview.src = url;
  });

  galleryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const existing = gallery.find((item) => item.id === galleryForm.elements.id.value);
      const saved = await saveGalleryItem({
        id: galleryForm.elements.id.value,
        title: galleryForm.elements.title.value,
        caption: galleryForm.elements.caption.value,
        image: galleryForm.elements.image.value,
        active: galleryForm.elements.active.checked,
        cover: galleryForm.elements.cover.checked,
        sortOrder: existing?.sortOrder || gallery.length + 1,
      });
      gallery = gallery.some((item) => item.id === saved.id)
        ? gallery.map((item) => (item.id === saved.id ? saved : { ...item, cover: saved.cover ? false : item.cover }))
        : [...gallery.map((item) => ({ ...item, cover: saved.cover ? false : item.cover })), saved];
      clearGalleryForm();
      render();
      setMessage("Foto salva na galeria.");
    } catch (error) {
      setMessage(error.message, true);
    }
  });

  testimonialFile.addEventListener("change", async () => {
    const file = testimonialFile.files[0];
    if (!file) return;
    testimonialPreview.src = URL.createObjectURL(file);
    const url = await uploadProductImage(file);
    testimonialForm.elements.image.value = url;
    testimonialPreview.src = url;
  });

  testimonialForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const existing = testimonials.find((item) => item.id === testimonialForm.elements.id.value);
      const saved = await saveTestimonial({
        id: testimonialForm.elements.id.value,
        name: testimonialForm.elements.name.value,
        city: testimonialForm.elements.city.value,
        image: testimonialForm.elements.image.value,
        rating: testimonialForm.elements.rating.value,
        comment: testimonialForm.elements.comment.value,
        active: testimonialForm.elements.active.checked,
        sortOrder: existing?.sortOrder || testimonials.length + 1,
      });
      testimonials = testimonials.some((item) => item.id === saved.id)
        ? testimonials.map((item) => (item.id === saved.id ? saved : item))
        : [...testimonials, saved];
      clearTestimonialForm();
      render();
      setMessage("Depoimento salvo com sucesso.");
    } catch (error) {
      setMessage(error.message, true);
    }
  });

  instagramFile.addEventListener("change", async () => {
    const file = instagramFile.files[0];
    if (!file) return;
    instagramPreview.src = URL.createObjectURL(file);
    const url = await uploadProductImage(file);
    instagramForm.elements.image.value = url;
    instagramPreview.src = url;
  });

  instagramForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const existing = instagram.find((item) => item.id === instagramForm.elements.id.value);
      const saved = await saveInstagramItem({
        id: instagramForm.elements.id.value,
        title: instagramForm.elements.title.value,
        link: instagramForm.elements.link.value,
        image: instagramForm.elements.image.value,
        active: instagramForm.elements.active.checked,
        sortOrder: existing?.sortOrder || instagram.length + 1,
      });
      instagram = instagram.some((item) => item.id === saved.id)
        ? instagram.map((item) => (item.id === saved.id ? saved : item))
        : [...instagram, saved];
      clearInstagramForm();
      render();
      setMessage("Foto do Instagram salva.");
    } catch (error) {
      setMessage(error.message, true);
    }
  });

  bannerFile.addEventListener("change", async () => {
    const file = bannerFile.files[0];
    if (!file) return;
    bannerPreview.src = URL.createObjectURL(file);
    const url = await uploadProductImage(file);
    bannerForm.elements.bannerImage.value = url;
    bannerPreview.src = url;
  });

  bannerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    settings = await saveStoreSettings({ ...settings, ...Object.fromEntries(new FormData(bannerForm)) });
    render();
    setMessage("Banner salvo com sucesso.");
  });

  settingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    settings = await saveStoreSettings({ ...settings, ...Object.fromEntries(new FormData(settingsForm)) });
    render();
    setMessage("Configuracoes salvas com sucesso.");
  });

  footerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    settings = await saveStoreSettings({ ...settings, ...Object.fromEntries(new FormData(footerForm)) });
    render();
    setMessage("Rodape salvo com sucesso.");
  });

  function enableDragReorder(container, selector, reorder) {
    let draggedId = "";
    container.addEventListener("dragstart", (event) => {
      const card = event.target.closest(selector);
      if (!card) return;
      draggedId = card.dataset.galleryCard || card.dataset.testimonialCard || card.dataset.instagramCard;
      event.dataTransfer.effectAllowed = "move";
    });
    container.addEventListener("dragover", (event) => {
      if (event.target.closest(selector)) event.preventDefault();
    });
    container.addEventListener("drop", async (event) => {
      const card = event.target.closest(selector);
      const targetId = card?.dataset.galleryCard || card?.dataset.testimonialCard || card?.dataset.instagramCard;
      if (!draggedId || !targetId || draggedId === targetId) return;
      event.preventDefault();
      await reorder(draggedId, targetId);
      draggedId = "";
    });
  }

  enableDragReorder(galleryAdminList, "[data-gallery-card]", async (fromId, toId) => {
    const next = [...gallery];
    const from = next.findIndex((item) => item.id === fromId);
    const to = next.findIndex((item) => item.id === toId);
    if (from < 0 || to < 0) return;
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    gallery = await reorderGalleryItems(next.map((entry) => entry.id));
    render();
  });

  enableDragReorder(testimonialAdminList, "[data-testimonial-card]", async (fromId, toId) => {
    const next = [...testimonials];
    const from = next.findIndex((item) => item.id === fromId);
    const to = next.findIndex((item) => item.id === toId);
    if (from < 0 || to < 0) return;
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    testimonials = await reorderTestimonials(next.map((entry) => entry.id));
    render();
  });

  enableDragReorder(instagramAdminList, "[data-instagram-card]", async (fromId, toId) => {
    const next = [...instagram];
    const from = next.findIndex((item) => item.id === fromId);
    const to = next.findIndex((item) => item.id === toId);
    if (from < 0 || to < 0) return;
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    instagram = await reorderInstagramItems(next.map((entry) => entry.id));
    render();
  });

  let draggedProductImage = "";
  productImagesAdmin.addEventListener("dragstart", (event) => {
    const card = event.target.closest("[data-product-extra-image]");
    if (!card) return;
    draggedProductImage = card.dataset.productExtraImage;
    event.dataTransfer.effectAllowed = "move";
  });
  productImagesAdmin.addEventListener("dragover", (event) => {
    if (event.target.closest("[data-product-extra-image]")) event.preventDefault();
  });
  productImagesAdmin.addEventListener("drop", (event) => {
    const card = event.target.closest("[data-product-extra-image]");
    const targetImage = card?.dataset.productExtraImage;
    if (!draggedProductImage || !targetImage || draggedProductImage === targetImage) return;
    event.preventDefault();
    const next = [...productExtraImages];
    const from = next.findIndex((item) => item.image === draggedProductImage);
    const to = next.findIndex((item) => item.image === targetImage);
    if (from < 0 || to < 0) return;
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    productExtraImages = next;
    draggedProductImage = "";
    renderProductImagesAdmin();
  });

  let draggedProductColor = "";
  productColorsAdmin.addEventListener("dragstart", (event) => {
    const card = event.target.closest("[data-product-color]");
    if (!card) return;
    draggedProductColor = card.dataset.productColor;
    event.dataTransfer.effectAllowed = "move";
  });
  productColorsAdmin.addEventListener("dragover", (event) => {
    if (event.target.closest("[data-product-color]")) event.preventDefault();
  });
  productColorsAdmin.addEventListener("drop", (event) => {
    const card = event.target.closest("[data-product-color]");
    const targetImage = card?.dataset.productColor;
    if (!draggedProductColor || !targetImage || draggedProductColor === targetImage) return;
    event.preventDefault();
    const next = [...productVariants];
    const from = next.findIndex((item) => item.image === draggedProductColor);
    const to = next.findIndex((item) => item.image === targetImage);
    if (from < 0 || to < 0) return;
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    productVariants = next;
    draggedProductColor = "";
    renderProductColorsAdmin();
  });

  render();
}
