import {
  createProduct,
  deleteProduct,
  getCategories,
  reorderProducts,
  updateProduct,
  uploadProductImage,
} from "../products-store.js";
import { formatCurrency } from "../config.js";

function adminImageSrc(image) {
  if (!image) return "../assets/logo-menezzi.jpg";
  return /^https?:\/\//i.test(image) || image.startsWith("../") ? image : `../${image}`;
}

function sortProducts(products) {
  return [...products].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

export function AdminProducts(root, initialProducts) {
  const form = root.querySelector("[data-product-form]");
  const formTitle = root.querySelector("[data-form-title]");
  const formMessage = root.querySelector("[data-form-message]");
  const list = root.querySelector("[data-admin-list]");
  const search = root.querySelector("[data-admin-search]");
  const categorySelect = root.querySelector("[data-admin-category]");
  const categoryOptions = root.querySelector("[data-category-options]");
  const imageFile = root.querySelector("[data-image-file]");
  const imagePreview = root.querySelector("[data-image-preview]");
  let products = sortProducts(initialProducts);
  let saving = false;

  function setMessage(message, isError = false) {
    formMessage.textContent = message;
    formMessage.classList.toggle("is-error", isError);
  }

  function currentMaxSortOrder() {
    return products.reduce((max, product) => Math.max(max, product.sortOrder || 0), 0);
  }

  async function formDataToProduct() {
    const data = new FormData(form);
    let image = data.get("image").trim();

    if (imageFile.files[0]) {
      setMessage("Enviando imagem...");
      image = await uploadProductImage(imageFile.files[0]);
    }

    const id = data.get("id");
    const existing = products.find((product) => product.id === id);

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
    form.elements.available.checked = true;
    imagePreview.src = "../assets/logo-menezzi.jpg";
    formTitle.textContent = "Novo produto";
    setMessage("");
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
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function removeProduct(productId) {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    const confirmed = window.confirm(`Excluir "${product.name}" da vitrine?`);
    if (!confirmed) return;

    await deleteProduct(productId);
    products = products.filter((item) => item.id !== productId);
    render();
  }

  async function moveProduct(productId, direction) {
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

    return products.filter((product) => {
      const matchesTerm = !term || product.name.toLowerCase().includes(term);
      const matchesCategory = category === "Todos" || product.category === category;
      return matchesTerm && matchesCategory;
    });
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
                <button class="button danger-button" type="button" data-delete-product="${product.id}">Excluir</button>
              </div>
            </article>
          `;
        })
        .join("") || '<p class="empty-state">Nenhum produto encontrado.</p>';
  }

  function render() {
    products = sortProducts(products);
    renderFilters();
    renderList();
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (saving) return;
    saving = true;
    setMessage("Salvando produto...");

    try {
      const product = await formDataToProduct();
      const saved = product.id ? await updateProduct(product) : await createProduct(product);
      const exists = products.some((item) => item.id === saved.id);
      products = exists ? products.map((item) => (item.id === saved.id ? saved : item)) : [...products, saved];
      render();
      clearForm();
      setMessage("Produto salvo no Supabase.");
    } catch (error) {
      setMessage(error.message, true);
    } finally {
      saving = false;
    }
  });

  root.querySelector("[data-clear-form]").addEventListener("click", clearForm);
  search.addEventListener("input", renderList);
  categorySelect.addEventListener("change", renderList);
  form.elements.image.addEventListener("input", () => {
    imagePreview.src = adminImageSrc(form.elements.image.value);
  });
  imageFile.addEventListener("change", () => {
    const file = imageFile.files[0];
    if (!file) return;
    imagePreview.src = URL.createObjectURL(file);
  });

  list.addEventListener("click", async (event) => {
    const edit = event.target.closest("[data-edit-product]");
    const remove = event.target.closest("[data-delete-product]");
    const move = event.target.closest("[data-move-product]");

    try {
      if (edit) editProduct(edit.dataset.editProduct);
      if (remove) await removeProduct(remove.dataset.deleteProduct);
      if (move) await moveProduct(move.dataset.moveProduct, Number(move.dataset.direction));
    } catch (error) {
      setMessage(error.message, true);
    }
  });

  render();
}
