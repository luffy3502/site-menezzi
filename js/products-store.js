import { getOfferType, storeConfig } from "./config.js";
import { getAdminToken } from "./admin-session.js";

function adminAuthHeaders() {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function createApiError(payload, fallbackMessage, status) {
  const error = new Error(payload.error || fallbackMessage);
  error.status = status;
  error.details = payload;
  return error;
}

function normalizeProduct(product) {
  const offerType = product.offerType || product.offer_type || (product.weeklyOffer ?? product.is_offer ? "oferta_semana" : "sem_oferta");
  const primaryImage = product.image || product.imageUrl || product.image_url || "assets/logo-menezzi.jpg";
  const images = Array.isArray(product.images) && product.images.length
    ? product.images.map((image, index) => ({
        id: image.id || `${product.id || "product"}-image-${index}`,
        image: image.image || image.imageUrl || image.image_url || primaryImage,
        imageUrl: image.imageUrl || image.image || image.image_url || primaryImage,
        sortOrder: Number(image.sortOrder ?? image.sort_order ?? index + 1),
        primary: image.primary ?? image.isPrimary ?? image.is_primary ?? index === 0,
      }))
    : [
        {
          id: `${product.id || "product"}-primary`,
          image: primaryImage,
          imageUrl: primaryImage,
          sortOrder: 1,
          primary: true,
        },
      ];
  const variants = Array.isArray(product.variants)
    ? product.variants.map((variant, index) => ({
        id: variant.id || `${product.id || "product"}-variant-${index}`,
        colorName: variant.colorName || variant.color_name || variant.name || "",
        image: variant.image || variant.imageUrl || variant.image_url || primaryImage,
        imageUrl: variant.imageUrl || variant.image || variant.image_url || primaryImage,
        sortOrder: Number(variant.sortOrder ?? variant.sort_order ?? index + 1),
      }))
    : [];
  return {
    id: product.id || crypto.randomUUID(),
    name: product.name || "Novo produto",
    category: product.category || "Sem categoria",
    description: product.description || "",
    details: product.details || product.description || "",
    price: Number(product.price || 0),
    image: primaryImage,
    imageUrl: primaryImage,
    images,
    variants,
    offerType,
    weeklyOffer: getOfferType({ offerType }) !== "sem_oferta",
    available: product.available ?? product.is_available ?? true,
    sortOrder: Number(product.sortOrder ?? product.sort_order ?? 0),
    createdAt: product.createdAt || product.created_at || null,
    updatedAt: product.updatedAt || product.updated_at || null,
  };
}

export async function loadProducts({ admin = false } = {}) {
  const response = await fetch(admin ? storeConfig.adminProductsApiUrl : storeConfig.productsApiUrl, {
    cache: "no-store",
    credentials: "same-origin",
    headers: admin ? adminAuthHeaders() : {},
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw createApiError(payload, "Nao foi possivel carregar os produtos do Supabase.", response.status);
  }
  return (await response.json()).map(normalizeProduct);
}

async function requestProduct(method, product) {
  const response = await fetch(storeConfig.productsApiUrl, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...adminAuthHeaders() },
    body: JSON.stringify(product),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createApiError(payload, "Nao foi possivel salvar o produto.", response.status);
  }
  return normalizeProduct(payload);
}

export async function createProduct(product) {
  return requestProduct("POST", product);
}

export async function updateProduct(product) {
  return requestProduct("PUT", product);
}

export async function deleteProduct(productId) {
  const response = await fetch(`${storeConfig.productsApiUrl}?id=${encodeURIComponent(productId)}`, {
    method: "DELETE",
    credentials: "same-origin",
    headers: adminAuthHeaders(),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createApiError(payload, "Nao foi possivel excluir o produto.", response.status);
  }
  return payload;
}

export async function reorderProducts(ids) {
  const response = await fetch(`${storeConfig.productsApiUrl}?action=reorder`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...adminAuthHeaders() },
    body: JSON.stringify({ ids }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createApiError(payload, "Nao foi possivel reordenar os produtos.", response.status);
  }
  return payload.map(normalizeProduct);
}

export async function uploadProductImage(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const response = await fetch(storeConfig.uploadApiUrl, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...adminAuthHeaders() },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      dataUrl,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createApiError(payload, "Nao foi possivel enviar a imagem.", response.status);
  }
  return payload.url;
}

async function requestAdminContent(url = storeConfig.adminContentApiUrl, options = {}) {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...adminAuthHeaders(),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createApiError(payload, "Nao foi possivel salvar o conteudo do painel.", response.status);
  }
  return payload;
}

export async function loadAdminContent() {
  return requestAdminContent();
}

export async function createCategory(name, sortOrder = 0) {
  const payload = typeof name === "object" ? name : { name, sortOrder };
  return requestAdminContent(`${storeConfig.adminContentApiUrl}?resource=categories`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteCategory(categoryId) {
  return requestAdminContent(`${storeConfig.adminContentApiUrl}?resource=categories&id=${encodeURIComponent(categoryId)}`, {
    method: "DELETE",
  });
}

export async function saveGalleryItem(item) {
  return requestAdminContent(`${storeConfig.adminContentApiUrl}?resource=gallery`, {
    method: "POST",
    body: JSON.stringify(item),
  });
}

export async function deleteGalleryItem(itemId) {
  return requestAdminContent(`${storeConfig.adminContentApiUrl}?resource=gallery&id=${encodeURIComponent(itemId)}`, {
    method: "DELETE",
  });
}

export async function reorderGalleryItems(ids) {
  return requestAdminContent(`${storeConfig.adminContentApiUrl}?resource=gallery&action=reorder`, {
    method: "PATCH",
    body: JSON.stringify({ ids }),
  });
}

export async function saveTestimonial(item) {
  return requestAdminContent(`${storeConfig.adminContentApiUrl}?resource=testimonials`, {
    method: "POST",
    body: JSON.stringify(item),
  });
}

export async function deleteTestimonial(itemId) {
  return requestAdminContent(`${storeConfig.adminContentApiUrl}?resource=testimonials&id=${encodeURIComponent(itemId)}`, {
    method: "DELETE",
  });
}

export async function reorderTestimonials(ids) {
  return requestAdminContent(`${storeConfig.adminContentApiUrl}?resource=testimonials&action=reorder`, {
    method: "PATCH",
    body: JSON.stringify({ ids }),
  });
}

export async function saveInstagramItem(item) {
  return requestAdminContent(`${storeConfig.adminContentApiUrl}?resource=instagram`, {
    method: "POST",
    body: JSON.stringify(item),
  });
}

export async function deleteInstagramItem(itemId) {
  return requestAdminContent(`${storeConfig.adminContentApiUrl}?resource=instagram&id=${encodeURIComponent(itemId)}`, {
    method: "DELETE",
  });
}

export async function reorderInstagramItems(ids) {
  return requestAdminContent(`${storeConfig.adminContentApiUrl}?resource=instagram&action=reorder`, {
    method: "PATCH",
    body: JSON.stringify({ ids }),
  });
}

export async function saveStoreSettings(settings) {
  return requestAdminContent(`${storeConfig.adminContentApiUrl}?resource=settings`, {
    method: "POST",
    body: JSON.stringify(settings),
  });
}

export function getCategories(products) {
  return [...new Set(products.map((product) => product.category).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );
}

export function createProductId(name) {
  const base = String(name || "produto")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `${base || "produto"}-${Date.now().toString(36)}`;
}
