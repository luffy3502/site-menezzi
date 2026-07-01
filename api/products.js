const {
  isSupabaseConfigured,
  productFromDb,
  productToDb,
  readJson,
  requireAdmin,
  requireSupabase,
  sendJson,
  supabaseRest,
} = require("./_utils");
const { demoProducts } = require("./_demo-products");

function supabaseErrorPayload(error) {
  return {
    error: error.message,
    status: error.status,
    statusText: error.statusText,
    supabase: error.supabase,
    request: error.request,
  };
}

function isMissingOfferTypeColumn(error) {
  const message = `${error.message || ""} ${error.supabase?.message || ""} ${error.supabase?.details || ""}`;
  return /offer_type/i.test(message) && /column|schema|could not find/i.test(message);
}

function isMissingProductImagesTable(error) {
  const message = `${error.message || ""} ${error.supabase?.message || ""} ${error.supabase?.details || ""}`;
  return /product_images/i.test(message) && /relation|schema cache|does not exist|could not find/i.test(message);
}

function isMissingProductVariantsTable(error) {
  const message = `${error.message || ""} ${error.supabase?.message || ""} ${error.supabase?.details || ""}`;
  return /product_variants|product_colors/i.test(message) && /relation|schema cache|does not exist|could not find/i.test(message);
}

function isMissingAdditionalImagesColumn(error) {
  const message = `${error.message || ""} ${error.supabase?.message || ""} ${error.supabase?.details || ""}`;
  return /additional_images/i.test(message) && /column|schema|could not find/i.test(message);
}

function normalizeProductImage(row) {
  return {
    id: row.id,
    productId: row.product_id,
    image: row.image_url || row.url || "",
    imageUrl: row.image_url || row.url || "",
    sortOrder: Number(row.sort_order || 0),
    primary: row.is_primary ?? false,
    createdAt: row.created_at || null,
  };
}

function normalizeProductVariant(row) {
  return {
    id: row.id,
    productId: row.product_id,
    colorName: row.color_name || "",
    image: row.image_url || "",
    imageUrl: row.image_url || "",
    sortOrder: Number(row.sort_order || 0),
    createdAt: row.created_at || null,
  };
}

function normalizeIncomingImages(product, savedProductId) {
  const sourceImages = Array.isArray(product.images) ? product.images : [];
  const additionalImages = Array.isArray(product.additionalImages)
    ? product.additionalImages
    : Array.isArray(product.additional_images)
      ? product.additional_images
      : [];
  const mainImage = String(product.image || product.imageUrl || product.image_url || "").trim();
  const seen = new Set();
  const normalized = [];

  function addImage(item, index, forcePrimary = false) {
    const image = String(item?.image || item?.imageUrl || item?.image_url || item || "").trim();
    if (!image || seen.has(image)) return;
    seen.add(image);
    normalized.push({
      product_id: savedProductId,
      image_url: image,
      sort_order: Number(item?.sortOrder ?? item?.sort_order ?? index + 1),
      is_primary: forcePrimary || Boolean(item?.primary ?? item?.isPrimary ?? item?.is_primary),
    });
  }

  if (mainImage) addImage({ image: mainImage, sortOrder: 1, primary: true }, 0, true);
  sourceImages.forEach((item, index) => addImage(item, index + 1));
  additionalImages.forEach((item, index) => addImage(item, index + sourceImages.length + 1));
  if (normalized.length && !normalized.some((item) => item.is_primary)) normalized[0].is_primary = true;
  return normalized.map((item, index) => ({ ...item, sort_order: index + 1, is_primary: index === 0 ? true : item.is_primary && !normalized.slice(0, index).some((prior) => prior.is_primary) }));
}

function normalizeIncomingVariants(product, savedProductId) {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const seen = new Set();
  return variants
    .map((item, index) => {
      const colorName = String(item?.colorName || item?.color_name || item?.name || "").trim();
      const image = String(item?.image || item?.imageUrl || item?.image_url || "").trim();
      const key = `${colorName.toLowerCase()}|${image}`;
      if (!colorName || !image || seen.has(key)) return null;
      seen.add(key);
      return {
        product_id: savedProductId,
        color_name: colorName,
        image_url: image,
        sort_order: Number(item?.sortOrder ?? item?.sort_order ?? index + 1),
      };
    })
    .filter(Boolean)
    .map((item, index) => ({ ...item, sort_order: index + 1 }));
}

async function attachProductImages(rows) {
  if (!rows.length) return rows.map(productFromDb);
  const ids = rows.map((row) => row.id).filter(Boolean);
  let imageRows = [];
  let variantRows = [];
  try {
    [imageRows, variantRows] = await Promise.all([
      supabaseRest(`product_images?select=*&product_id=in.(${ids.join(",")})&order=sort_order.asc,created_at.asc`),
      supabaseRest(`product_variants?select=*&product_id=in.(${ids.join(",")})&order=sort_order.asc,created_at.asc`).catch((error) => {
        if (isMissingProductVariantsTable(error)) return [];
        throw error;
      }),
    ]);
  } catch (error) {
    if (!isMissingProductImagesTable(error)) throw error;
    imageRows = [];
    variantRows = [];
  }

  const byProduct = imageRows.reduce((map, row) => {
    const list = map.get(row.product_id) || [];
    list.push(normalizeProductImage(row));
    map.set(row.product_id, list);
    return map;
  }, new Map());
  const variantsByProduct = variantRows.reduce((map, row) => {
    const list = map.get(row.product_id) || [];
    list.push(normalizeProductVariant(row));
    map.set(row.product_id, list);
    return map;
  }, new Map());

  return rows.map((row) => {
    const images = byProduct.get(row.id) || [];
    const variants = variantsByProduct.get(row.id) || [];
    return productFromDb({ ...row, images: images.length ? images : undefined, variants });
  });
}

async function saveProductImages(productId, product) {
  const images = normalizeIncomingImages(product, productId);
  try {
    await supabaseRest(`product_images?product_id=eq.${encodeURIComponent(productId)}`, { method: "DELETE" });
    if (!images.length) return [];
    const rows = await supabaseRest("product_images", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(images),
    });
    return rows.map(normalizeProductImage);
  } catch (error) {
    if (isMissingProductImagesTable(error)) return [];
    throw error;
  }
}

async function syncAdditionalImagesColumn(productId, images) {
  const additionalImages = images.filter((image) => !image.primary).map((image) => image.image);
  try {
    await supabaseRest(`products?id=eq.${encodeURIComponent(productId)}`, {
      method: "PATCH",
      body: JSON.stringify({ additional_images: additionalImages }),
    });
  } catch (error) {
    if (isMissingAdditionalImagesColumn(error)) return;
    throw error;
  }
}

async function saveProductVariants(productId, product) {
  const variants = normalizeIncomingVariants(product, productId);
  try {
    await supabaseRest(`product_variants?product_id=eq.${encodeURIComponent(productId)}`, { method: "DELETE" });
    if (!variants.length) return [];
    const rows = await supabaseRest("product_variants", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(variants),
    });
    return rows.map(normalizeProductVariant);
  } catch (error) {
    if (isMissingProductVariantsTable(error)) return [];
    throw error;
  }
}

async function seedDemoProductsIfEmpty() {
  if (!isSupabaseConfigured()) return [];

  const existingRows = await supabaseRest("products?select=id&limit=1");
  if (existingRows.length) return [];

  const inserted = [];
  for (const product of demoProducts) {
    const rows = await supabaseRest("products", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(product),
    });
    inserted.push(productFromDb(rows[0]));
  }

  return inserted;
}

async function listProducts(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const isAdmin = url.searchParams.get("admin") === "1";

  if (isAdmin) {
    if (!requireAdmin(req, res) || !requireSupabase(res)) return;
    const rows = await supabaseRest("products?select=*&order=sort_order.asc,created_at.desc");
    return sendJson(res, 200, await attachProductImages(rows));
  }

  if (!requireSupabase(res)) return;

  await seedDemoProductsIfEmpty().catch(() => []);

  const rows = await supabaseRest("products?select=*&is_available=eq.true&order=sort_order.asc,created_at.desc");
  return sendJson(res, 200, await attachProductImages(rows));
}

async function createProduct(req, res) {
  if (!requireAdmin(req, res) || !requireSupabase(res)) return;
  const body = await readJson(req);
  const request = {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(productToDb(body)),
  };
  let rows;
  try {
    rows = await supabaseRest("products", request);
  } catch (error) {
    if (!isMissingOfferTypeColumn(error)) throw error;
    rows = await supabaseRest("products", {
      ...request,
      body: JSON.stringify(productToDb(body, { includeOfferType: false })),
    });
  }
  const images = await saveProductImages(rows[0].id, body);
  await syncAdditionalImagesColumn(rows[0].id, images);
  const variants = await saveProductVariants(rows[0].id, body);
  const primary = images.find((image) => image.primary) || images[0];
  return sendJson(res, 201, productFromDb({ ...rows[0], image_url: primary?.image || rows[0].image_url, images: images.length ? images : undefined, variants }));
}

async function updateProduct(req, res) {
  if (!requireAdmin(req, res) || !requireSupabase(res)) return;
  const body = await readJson(req);
  if (!body.id) return sendJson(res, 400, { error: "ID obrigatorio." });
  const path = `products?id=eq.${encodeURIComponent(body.id)}`;
  const request = {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(productToDb(body)),
  };
  let rows;
  try {
    rows = await supabaseRest(path, request);
  } catch (error) {
    if (!isMissingOfferTypeColumn(error)) throw error;
    rows = await supabaseRest(path, {
      ...request,
      body: JSON.stringify(productToDb(body, { includeOfferType: false })),
    });
  }
  const images = await saveProductImages(rows[0].id, body);
  await syncAdditionalImagesColumn(rows[0].id, images);
  const variants = await saveProductVariants(rows[0].id, body);
  const primary = images.find((image) => image.primary) || images[0];
  return sendJson(res, 200, productFromDb({ ...rows[0], image_url: primary?.image || rows[0].image_url, images: images.length ? images : undefined, variants }));
}

async function deleteProduct(req, res) {
  if (!requireAdmin(req, res) || !requireSupabase(res)) return;
  const url = new URL(req.url, `http://${req.headers.host}`);
  const id = url.searchParams.get("id");
  if (!id) return sendJson(res, 400, { error: "ID obrigatorio." });
  await supabaseRest(`product_images?product_id=eq.${encodeURIComponent(id)}`, { method: "DELETE" }).catch((error) => {
    if (!isMissingProductImagesTable(error)) throw error;
  });
  await supabaseRest(`product_variants?product_id=eq.${encodeURIComponent(id)}`, { method: "DELETE" }).catch((error) => {
    if (!isMissingProductVariantsTable(error)) throw error;
  });
  await supabaseRest(`products?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
  return sendJson(res, 200, { ok: true });
}

async function reorderProducts(req, res) {
  if (!requireAdmin(req, res) || !requireSupabase(res)) return;
  const { ids } = await readJson(req);
  if (!Array.isArray(ids)) return sendJson(res, 400, { error: "Lista de IDs obrigatoria." });

  await Promise.all(
    ids.map((id, index) =>
      supabaseRest(`products?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ sort_order: index + 1 }),
      })
    )
  );

  const rows = await supabaseRest("products?select=*&order=sort_order.asc,created_at.desc");
  return sendJson(res, 200, await attachProductImages(rows));
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") return await listProducts(req, res);
    if (req.method === "POST") return await createProduct(req, res);
    if (req.method === "PUT" || req.method === "PATCH") {
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (url.searchParams.get("action") === "reorder") return await reorderProducts(req, res);
      return await updateProduct(req, res);
    }
    if (req.method === "DELETE") return await deleteProduct(req, res);
    return sendJson(res, 405, { error: "Metodo nao permitido." });
  } catch (error) {
    console.error("[Products API error]", supabaseErrorPayload(error));
    return sendJson(res, 500, supabaseErrorPayload(error));
  }
};
