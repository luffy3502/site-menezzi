import {
  createProduct,
  deleteProduct,
  getCategories,
  reorderProducts,
  updateProduct,
  uploadProductImage,
} from "../products-store.js";
import { formatCurrency } from "../config.js";

const FALLBACK_IMAGE = "../assets/logo-menezzi.jpg";

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

export function AdminProducts(root, initialProducts) {
  const form = root.querySelector("[data-product-form]");
  const formTitle = root.querySelector("[data-form-title]");
  const formMessage = root.querySelector("[data-form-message]");
  const uploadMessage = root.querySelector("[data-upload-message]");
  const list = root.querySelector("[data-admin-list]");
  const search = root.querySelector("[data-admin-search]");
  const categorySelect = root.querySelector("[data-admin-category]");
  const availabilitySelect = root.querySelector("[data-admin-availability]");
  const offerSelect = root.querySelector("[data-admin-offer]");
  const sortSelect = root.querySelector("[data-admin-sort]");
  const categoryOptions = root.querySelector("[data-category-options]");
  const imageFile = root.querySelector("[data-image-file]");
  const imagePreview = root.querySelector("[data-image-preview]");
  const submitButton = form.querySelector('button[type="submit"]');
  let products = byManualOrder(initialProducts);
  let saving = false;
  let uploading = false;

  function setMessage(message, isError = false) {
    formMessage.textContent = message;
    formMessage.classList.toggle("is-error", isError);
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

  function formDataToProduct() {
    const data = new FormData(form);
    const id = data.get("id");
    const existing = products.find((product) => product.id === id);
    const image = data.get("image") || existing?.image || "";

    return {
      id,
      name: data.get("name").trim(),
      price: Number(data.get("price")),
      category: data.get("category").trim(),
      image,
      imageUrl: image,
      description: data.get("description").trim(),
      weeklyOffer: data.get("weeklyOffer") === "on",
      available: data.get("available") === "on",
      sortOrder: existing?.sortOrder || currentMaxSortOrder() + 1,
    };
  }

  function clearForm() {
    form.reset();
    form.elements.id.value = "";
    form.elements.image.value = "";
    form.elements.available.checked = true;
    imagePreview.src = FALLBACK_IMAGE;
    formTitle.textContent = "Novo produto";
    setMessage("");
    setUploadMessage("");
  }

  function editProduct(productId) {
    const product = products.find((item) => item.id === productId);
    if (!product) return;

    form.elements.id.value = product.id;
    form.elements.name.value = product.name;
    form.elements.price.value = product.price;
    form.elements.category.value = product.category;
    form.elements.image.value = product.image;
    form.elements.description.value = product.description;
    form.elements.weeklyOffer.checked = product.weeklyOffer;
    form.elements.available.checked = product.available;
    imagePreview.src = adminImageSrc(product.image);
    formTitle.textContent = "Editar produto";
    setMessage("");
    setUploadMessage("");
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function removeProduct(productId) {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    const confirmed = window.confirm(`Excluir "${product.name}" da vitrine?`);
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
        : { ...product, weeklyOffer: !product.weeklyOffer };
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
      const matchesOffer =
        offer === "Todos" || (offer === "Oferta" && product.weeklyOffer) || (offer === "Normal" && !product.weeklyOffer);

      return matchesTerm && matchesCategory && matchesAvailability && matchesOffer;
    });

    return sortVisibleProducts(filtered, sortSelect.value);
  }

  function renderFilters() {
    const categories = getCategories(products);
    const currentCategory = categorySelect.value || "Todos";
    categorySelect.innerHTML = ["Todos", ...categories]
      .map((category) => `<option value="${category}">${category}</option>`)
      .join("");
    categorySelect.value = categories.includes(currentCategory) ? currentCategory : "Todos";
    categoryOptions.innerHTML = categories.map((category) => `<option value="${category}"></option>`).join("");
  }

  function renderList() {
    const visibleProducts = filteredProducts();

    list.innerHTML =
      visibleProducts
        .map((product) => {
          const index = products.findIndex((item) => item.id === product.id);
          return `
            <article class="admin-product">
              <img src="${adminImageSrc(product.image)}" alt="${product.name}" />
              <div>
                <div class="admin-product-title">
                  <h3>${product.name}</h3>
                  <strong>${formatCurrency(product.price)}</strong>
                </div>
                <p>${product.category}</p>
                <div class="status-row">
                  <span class="${product.available ? "status-ok" : "status-muted"}">
                    ${product.available ? "Disponivel" : "Indisponivel"}
                  </span>
                  ${product.weeklyOffer ? '<span class="status-offer">Oferta</span>' : ""}
                </div>
              </div>
              <div class="admin-actions">
                <button class="button button-light" type="button" data-move-product="${product.id}" data-direction="-1" ${index === 0 ? "disabled" : ""}>Subir</button>
                <button class="button button-light" type="button" data-move-product="${product.id}" data-direction="1" ${index === products.length - 1 ? "disabled" : ""}>Descer</button>
                <button class="button button-light" type="button" data-edit-product="${product.id}">Editar</button>
                <button class="button button-light" type="button" data-duplicate-product="${product.id}">Duplicar</button>
                <button class="button button-light" type="button" data-toggle-available="${product.id}">
                  ${product.available ? "Desativar" : "Ativar"}
                </button>
                <button class="button button-light" type="button" data-toggle-offer="${product.id}">
                  ${product.weeklyOffer ? "Remover oferta" : "Marcar oferta"}
                </button>
                <button class="button danger-button" type="button" data-delete-product="${product.id}">Excluir</button>
              </div>
            </article>
          `;
        })
        .join("") || '<p class="empty-state">Nenhum produto encontrado.</p>';
  }

  function render() {
    products = byManualOrder(products);
    renderFilters();
    renderList();
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
      setMessage(error.message, true);
    } finally {
      setBusy(false);
    }
  });

  root.querySelector("[data-clear-form]").addEventListener("click", clearForm);
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
      const editingId = form.elements.id.value;
      const existing = products.find((product) => product.id === editingId);

      if (existing) {
        const saved = await updateProduct({ ...existing, image: url, imageUrl: url });
        products = products.map((product) => (product.id === saved.id ? saved : product));
        render();
      }

      setUploadMessage("Upload concluido.");
    } catch (error) {
      setUploadMessage("Erro ao enviar imagem.", true);
      form.elements.image.value = "";
    } finally {
      uploading = false;
      submitButton.disabled = saving;
    }
  });

  list.addEventListener("click", async (event) => {
    const edit = event.target.closest("[data-edit-product]");
    const remove = event.target.closest("[data-delete-product]");
    const move = event.target.closest("[data-move-product]");
    const duplicate = event.target.closest("[data-duplicate-product]");
    const toggleAvailable = event.target.closest("[data-toggle-available]");
    const toggleOffer = event.target.closest("[data-toggle-offer]");

    try {
      if (edit) editProduct(edit.dataset.editProduct);
      if (remove) await removeProduct(remove.dataset.deleteProduct);
      if (move) await moveProduct(move.dataset.moveProduct, Number(move.dataset.direction));
      if (duplicate) await duplicateProduct(duplicate.dataset.duplicateProduct);
      if (toggleAvailable) await toggleProduct(toggleAvailable.dataset.toggleAvailable, "available");
      if (toggleOffer) await toggleProduct(toggleOffer.dataset.toggleOffer, "offer");
    } catch (error) {
      setMessage(error.message, true);
    }
  });

  render();
}
