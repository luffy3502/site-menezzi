const crypto = require("crypto");
const { getSupabaseConfigReport, supabaseConfig } = require("./supabase-config");

const SESSION_COOKIE = "menezzi_admin_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

function sendJson(res, statusCode, payload, headers = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...headers,
  });
  res.end(JSON.stringify(payload));
}

function isSupabaseConfigured() {
  const report = getSupabaseConfigReport();
  return Boolean(supabaseConfig.url && supabaseConfig.serviceRoleKey && !report.issues.length);
}

function isPublicSupabaseConfigured() {
  const report = getSupabaseConfigReport();
  const publicIssues = report.issues.filter((issue) => !issue.includes("SUPABASE_SERVICE_ROLE_KEY"));
  return Boolean(supabaseConfig.url && (supabaseConfig.anonKey || supabaseConfig.serviceRoleKey) && !publicIssues.length);
}

function requireSupabase(res) {
  if (isSupabaseConfigured()) return true;
  const config = getSupabaseConfigReport();
  console.error("[Supabase config]", config);
  sendJson(res, 503, { error: "Supabase nao configurado corretamente.", config });
  return false;
}

function requirePublicSupabase(res) {
  if (isPublicSupabaseConfigured()) return true;
  const config = getSupabaseConfigReport();
  console.error("[Supabase public config]", config);
  sendJson(res, 503, { error: "Supabase publico nao configurado corretamente.", config });
  return false;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 12 * 1024 * 1024) {
        req.destroy();
        reject(new Error("Payload muito grande."));
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function cookieOptions(maxAge = SESSION_MAX_AGE_SECONDS) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const index = item.indexOf("=");
        return [item.slice(0, index), decodeURIComponent(item.slice(index + 1))];
      })
  );
}

function adminSecret() {
  return process.env.ADMIN_PASSWORD || process.env.SUPABASE_SERVICE_ROLE_KEY || "dev-secret";
}

function signToken(payload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", adminSecret()).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

function createSessionToken(username) {
  return signToken({
    username,
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  });
}

function verifyToken(token) {
  try {
    if (!token || !token.includes(".")) return null;
    const [encodedPayload, signature] = token.split(".");
    const expected = crypto.createHmac("sha256", adminSecret()).update(encodedPayload).digest("base64url");
    if (signature.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch (error) {
    return null;
  }
}

function createSessionCookie(username, sessionToken = createSessionToken(username)) {
  const token = sessionToken;
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; ${cookieOptions()}`;
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; ${cookieOptions(0)}`;
}

function getSession(req) {
  const cookies = parseCookies(req);
  const authHeader = String(req.headers.authorization || "");
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  return verifyToken(bearerToken) || verifyToken(cookies[SESSION_COOKIE]);
}

function requireAdmin(req, res) {
  const session = getSession(req);
  if (session) return session;
  sendJson(res, 401, { error: "Acesso nao autorizado." });
  return null;
}

function supabaseOperation(options = {}) {
  const method = options.method || "GET";
  const prefer = String(options.headers?.Prefer || options.headers?.prefer || "");
  if (prefer.includes("resolution=")) return "upsert";
  if (method === "POST") return "insert";
  if (method === "PUT" || method === "PATCH") return "update";
  if (method === "DELETE") return "delete";
  return "select";
}

async function supabaseRest(path, options = {}) {
  const url = `${supabaseConfig.url}/rest/v1/${path}`;
  const operation = supabaseOperation(options);
  const keyType = "service role";
  console.info("[Supabase request]", { keyType, operation, path });

  const response = await fetch(url, {
    ...options,
    headers: {
      apikey: supabaseConfig.serviceRoleKey,
      Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = payload?.message || payload?.error || "Erro no Supabase.";
    const error = new Error(message);
    error.status = response.status;
    error.statusText = response.statusText;
    error.supabase = payload;
    error.request = { keyType, operation, method: options.method || "GET", path };
    console.error("[Supabase error]", {
      keyType,
      operation,
      status: response.status,
      statusText: response.statusText,
      method: options.method || "GET",
      path,
      payload,
      config: getSupabaseConfigReport(),
    });
    throw error;
  }
  return payload;
}

async function supabasePublicRest(path, options = {}) {
  const key = supabaseConfig.anonKey || supabaseConfig.serviceRoleKey;
  const url = `${supabaseConfig.url}/rest/v1/${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = payload?.message || payload?.error || "Erro no Supabase.";
    const error = new Error(message);
    error.status = response.status;
    error.statusText = response.statusText;
    error.supabase = payload;
    error.request = { method: options.method || "GET", path };
    console.error("[Supabase public error]", {
      status: response.status,
      statusText: response.statusText,
      method: options.method || "GET",
      path,
      payload,
      config: getSupabaseConfigReport(),
    });
    throw error;
  }
  return payload;
}

function imageValue(item) {
  return String(item?.image || item?.imageUrl || item?.image_url || item?.url || item || "").trim();
}

function productImagesFromRecord(product, primaryImage) {
  const seen = new Set();
  const images = [];

  function addImage(item, index, primary = false) {
    const image = imageValue(item);
    const key = image.toLowerCase();
    if (!image || seen.has(key)) return;
    seen.add(key);
    images.push({
      id: item?.id || `${product.id || "product"}-image-${index}`,
      image,
      imageUrl: image,
      sortOrder: Number(item?.sortOrder ?? item?.sort_order ?? images.length + 1),
      primary,
    });
  }

  addImage(primaryImage, 0, true);
  if (Array.isArray(product.images)) {
    const primaryRecord = product.images.find((item) => item?.primary || item?.isPrimary || item?.is_primary);
    if (primaryRecord) addImage(primaryRecord, 0, true);
    product.images.forEach((item, index) => addImage(item, index + 1, false));
  }
  const additionalImages = Array.isArray(product.additional_images) ? product.additional_images : [];
  additionalImages.forEach((item, index) => addImage(item, index + 100, false));

  return images.length
    ? images.map((item, index) => ({ ...item, sortOrder: index + 1, primary: index === 0 }))
    : [
        {
          id: `${product.id || "product"}-primary`,
          image: primaryImage,
          imageUrl: primaryImage,
          sortOrder: 1,
          primary: true,
        },
      ];
}

function productFromDb(product) {
  const offerType = product.offer_type || (product.is_offer ? "oferta_semana" : "sem_oferta");
  const primaryImage = product.image_url || "assets/logo-menezzi.jpg";
  const additionalImages = Array.isArray(product.additional_images) ? product.additional_images.filter(Boolean) : [];
  const images = productImagesFromRecord(product, primaryImage);
  const variants = Array.isArray(product.variants)
    ? product.variants.map((variant, index) => ({
        id: variant.id || `${product.id || "product"}-variant-${index}`,
        colorName: variant.colorName || variant.color_name || "",
        image: variant.image || variant.imageUrl || variant.image_url || "",
        imageUrl: variant.imageUrl || variant.image || variant.image_url || "",
        sortOrder: Number(variant.sortOrder ?? variant.sort_order ?? index + 1),
      }))
    : [];
  return {
    id: product.id,
    name: product.name,
    price: Number(product.price || 0),
    description: product.description || "",
    category: product.category || "Sem categoria",
    image: primaryImage,
    imageUrl: primaryImage,
    images,
    additionalImages,
    variants,
    offerType,
    weeklyOffer: offerType !== "sem_oferta",
    available: Boolean(product.is_available),
    sortOrder: Number(product.sort_order || 0),
    createdAt: product.created_at,
    updatedAt: product.updated_at,
  };
}

function productToDb(product, options = {}) {
  const offerType = String(product.offerType || product.offer_type || (product.weeklyOffer || product.is_offer ? "oferta_semana" : "sem_oferta"));
  const payload = {
    name: String(product.name || "").trim(),
    price: Number(product.price || 0),
    description: String(product.description || "").trim(),
    category: String(product.category || "Sem categoria").trim(),
    image_url: String(product.image || product.imageUrl || product.image_url || "").trim(),
    is_offer: offerType !== "sem_oferta",
    is_available: product.available ?? product.is_available ?? true,
    sort_order: Number(product.sortOrder ?? product.sort_order ?? 0),
  };
  if (options.includeOfferType !== false) payload.offer_type = offerType;
  return payload;
}

module.exports = {
  clearSessionCookie,
  createSessionCookie,
  createSessionToken,
  getSession,
  isSupabaseConfigured,
  isPublicSupabaseConfigured,
  productFromDb,
  productToDb,
  readJson,
  requireAdmin,
  requirePublicSupabase,
  requireSupabase,
  sendJson,
  supabaseConfig,
  getSupabaseConfigReport,
  supabasePublicRest,
  supabaseRest,
};
