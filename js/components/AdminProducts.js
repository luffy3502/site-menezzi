import {
  createCategory,
  createProduct,
  deleteCategory,
  deleteGalleryItem,
  deleteProduct,
  getCategories,
  reorderGalleryItems,
  reorderProducts,
  saveGalleryItem,
  saveStoreSettings,
  updateProduct,
  uploadProductImage,
} from "../products-store.js";
import { categoryOptions, formatCurrency, getOfferLabel, getOfferType, offerTypes } from "../config.js";

const FALLBACK_IMAGE = "../assets/logo-menezzi.jpg";
const DEFAULT_CATEGORIES = categoryOptions;
const AVAILABILITY_OPTIONS = [
  { value: "true", label: "Disponivel", tone: "success" },
  { value: "false", label: "Indisponivel", tone: "danger" },
];

function adminImageSrc(image) {
  if (!image) return FALLBACK_IMAGE;
  return /^https?:\/\//i.test(image) || image.startsWith("../") ? image : `../${image}`;
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
  const imagePreview = root.querySelector("[data-image-preview]");
  const submitButton = form.querySelector('button[type="submit"]');
  const categoryModal = root.ownerDocument.querySelector("[data-category-modal]");
  const categoryForm = root.ownerDocument.querySelector("[data-category-form]");
  const categoryAdminList = root.querySelector("[data-category-admin-list]");
  const galleryForm = root.querySelector("[data-gallery-form]");
  const galleryFile = root.querySelector("[data-gallery-file]");
  const galleryPreview = root.querySelector("[data-gallery-preview]");
  const galleryAdminList = root.querySelector("[data-gallery-admin-list]");
  const bannerForm = root.querySelector("[data-banner-form]");
  const bannerFile = root.querySelector("[data-banner-file]");
  const bannerPreview = root.querySelector("[data-banner-preview]");
  const settingsForm = root.querySelector("[data-settings-form]");

  let products = byManualOrder(initialProducts);
  let categories = (initialContent.categories || []).map((category) => category.name || category);
  let gallery = initialContent.gallery || [];
  let settings = initialContent.settings || {};
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

  function selectedCategory() {
    return normalizeCategory(productCategorySelect.value) || DEFAULT_CATEGORIES[0];
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
    productCategorySelect.value = categoryChoices()[0] || DEFAULT_CATEGORIES[0];
    imagePreview.src = FALLBACK_IMAGE;
    formTitle.textContent = "Novo produto";
    renderCategorySelects();
    renderChoiceButtons();
    setMessage("");
    setUploadMessage("");
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
    imagePreview.src = adminImageSrc(product.image);
    formTitle.textContent = "Editar produto";
    renderChoiceButtons();
    showSection("produtos");
    setMessage("Produto carregado para edicao.");
    setUploadMessage("");
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
            <span>${category}</span>
            <button class="button button-light" type="button" data-delete-category="${category}">Excluir</button>
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
            <article class="gallery-admin-card">
              <img src="${adminImageSrc(item.image)}" alt="${item.title || "Foto da loja"}" />
              <strong>${item.title || "Foto da loja"}</strong>
              <div class="admin-actions">
                <button class="button button-light" type="button" data-move-gallery="${item.id}" data-direction="-1" ${index === 0 ? "disabled" : ""}>↑</button>
                <button class="button button-light" type="button" data-move-gallery="${item.id}" data-direction="1" ${index === gallery.length - 1 ? "disabled" : ""}>↓</button>
                <button class="button danger-button" type="button" data-delete-gallery="${item.id}">Excluir</button>
              </div>
            </article>
          `
        )
        .join("") || '<p class="empty-state">Adicione fotos da loja para aparecerem automaticamente na home.</p>';
  }

  function fillSettingsForms() {
    if (!settingsForm || !bannerForm) return;
    Object.entries(settings).forEach(([key, value]) => {
      if (settingsForm.elements[key]) settingsForm.elements[key].value = value || "";
      if (bannerForm.elements[key]) bannerForm.elements[key].value = value || "";
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
    const deleteCategoryButton = event.target.closest("[data-delete-category]");
    const deleteGalleryButton = event.target.closest("[data-delete-gallery]");
    const moveGalleryButton = event.target.closest("[data-move-gallery]");
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
        categoryModal.hidden = false;
        categoryForm.elements.name.focus();
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
      if (deleteCategoryButton) {
        const name = deleteCategoryButton.dataset.deleteCategory;
        if (DEFAULT_CATEGORIES.includes(name)) {
          setMessage("Categorias padrao nao podem ser excluidas.", true);
          return;
        }
        if (!window.confirm(`Excluir a categoria "${name}"?`)) return;
        await deleteCategory(name);
        categories = categories.filter((category) => category !== name);
        render();
        setMessage("Categoria excluida.");
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
      const category = await createCategory(categoryForm.elements.name.value, categoryChoices().length + 1);
      categories = [...new Set([...categories, category.name])];
      categoryForm.reset();
      categoryModal.hidden = true;
      render();
      setMessage("Categoria criada com sucesso.");
    } catch (error) {
      setMessage(error.message, true);
    }
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
    setUploadMessage("Enviando imagem...");
    try {
      const url = await uploadProductImage(file);
      form.elements.image.value = url;
      imagePreview.src = url;
      setUploadMessage("Upload concluido.");
    } catch (error) {
      console.error("Erro completo ao enviar imagem para o Supabase:", error);
      setUploadMessage("Erro ao enviar imagem.", true);
      form.elements.image.value = "";
    } finally {
      uploading = false;
      submitButton.disabled = saving;
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
      const saved = await saveGalleryItem({
        title: galleryForm.elements.title.value,
        image: galleryForm.elements.image.value,
        sortOrder: gallery.length + 1,
      });
      gallery = [...gallery, saved];
      galleryForm.reset();
      galleryPreview.src = FALLBACK_IMAGE;
      render();
      setMessage("Foto adicionada a galeria.");
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

  render();
}
