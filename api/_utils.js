const crypto = require("crypto");
const { supabaseConfig } = require("./supabase-config");

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
  return Boolean(supabaseConfig.url && supabaseConfig.serviceRoleKey);
}

function requireSupabase(res) {
  if (isSupabaseConfigured()) return true;
  sendJson(res, 503, { error: "Supabase nao configurado." });
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

function createSessionCookie(username) {
  const token = signToken({
    username,
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  });
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; ${cookieOptions()}`;
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; ${cookieOptions(0)}`;
}

function getSession(req) {
  const cookies = parseCookies(req);
  return verifyToken(cookies[SESSION_COOKIE]);
}

function requireAdmin(req, res) {
  const session = getSession(req);
  if (session) return session;
  sendJson(res, 401, { error: "Acesso nao autorizado." });
  return null;
}

async function supabaseRest(path, options = {}) {
  const url = `${supabaseConfig.url}/rest/v1/${path}`;
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
    throw new Error(message);
  }
  return payload;
}

function productFromDb(product) {
  return {
    id: product.id,
    name: product.name,
    price: Number(product.price || 0),
    description: product.description || "",
    category: product.category || "Sem categoria",
    image: product.image_url || "assets/logo-menezzi.jpg",
    imageUrl: product.image_url || "assets/logo-menezzi.jpg",
    weeklyOffer: Boolean(product.is_offer),
    available: Boolean(product.is_available),
    sortOrder: Number(product.sort_order || 0),
    createdAt: product.created_at,
    updatedAt: product.updated_at,
  };
}

function productToDb(product) {
  return {
    name: String(product.name || "").trim(),
    price: Number(product.price || 0),
    description: String(product.description || "").trim(),
    category: String(product.category || "Sem categoria").trim(),
    image_url: String(product.image || product.imageUrl || product.image_url || "").trim(),
    is_offer: Boolean(product.weeklyOffer ?? product.is_offer),
    is_available: product.available ?? product.is_available ?? true,
    sort_order: Number(product.sortOrder ?? product.sort_order ?? 0),
  };
}

module.exports = {
  clearSessionCookie,
  createSessionCookie,
  getSession,
  isSupabaseConfigured,
  productFromDb,
  productToDb,
  readJson,
  requireAdmin,
  requireSupabase,
  sendJson,
  supabaseConfig,
  supabaseRest,
};
