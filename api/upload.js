const {
  readJson,
  requireAdmin,
  requireSupabase,
  sendJson,
  supabaseConfig,
} = require("./_utils");

const crypto = require("crypto");

const STORAGE_PREFIX = "products";
const CONTENT_TYPE_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function extensionFromContentType(contentType) {
  return CONTENT_TYPE_EXTENSIONS[String(contentType || "").toLowerCase()] || "webp";
}

function buildObjectPath(contentType) {
  const extension = extensionFromContentType(contentType);
  return `${STORAGE_PREFIX}/${crypto.randomUUID()}.${extension}`;
}

function encodeObjectPath(objectPath) {
  return objectPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Metodo nao permitido." });
  }

  if (!requireAdmin(req, res) || !requireSupabase(res)) return;

  try {
    const { contentType, dataUrl, base64 } = await readJson(req);
    const rawBase64 = base64 || String(dataUrl || "").split(",").pop();
    if (!rawBase64) return sendJson(res, 400, { error: "Arquivo obrigatorio." });
    if (!Object.prototype.hasOwnProperty.call(CONTENT_TYPE_EXTENSIONS, String(contentType || "").toLowerCase())) {
      return sendJson(res, 400, { error: "Formato invalido. Use JPG, PNG ou WebP." });
    }

    const buffer = Buffer.from(rawBase64, "base64");
    const objectPath = buildObjectPath(contentType);
    const encodedObjectPath = encodeObjectPath(objectPath);
    const uploadUrl = `${supabaseConfig.url}/storage/v1/object/${supabaseConfig.productImagesBucket}/${encodedObjectPath}`;

    const upload = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        apikey: supabaseConfig.serviceRoleKey,
        Authorization: `Bearer ${supabaseConfig.serviceRoleKey}`,
        "Content-Type": contentType || "application/octet-stream",
        "x-upsert": "false",
      },
      body: buffer,
    });

    if (!upload.ok) {
      const payload = await upload.text();
      throw new Error(payload || "Nao foi possivel enviar a imagem.");
    }

    const publicUrl = `${supabaseConfig.url}/storage/v1/object/public/${supabaseConfig.productImagesBucket}/${encodedObjectPath}`;
    return sendJson(res, 201, { url: publicUrl, path: objectPath });
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
};
