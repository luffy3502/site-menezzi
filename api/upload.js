const {
  readJson,
  requireAdmin,
  requireSupabase,
  sendJson,
  supabaseConfig,
} = require("./_utils");

function safeFileName(fileName) {
  const clean = String(fileName || "produto.jpg")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-|-$/g, "");
  return clean || "produto.jpg";
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Metodo nao permitido." });
  }

  if (!requireAdmin(req, res) || !requireSupabase(res)) return;

  try {
    const { fileName, contentType, dataUrl, base64 } = await readJson(req);
    const rawBase64 = base64 || String(dataUrl || "").split(",").pop();
    if (!rawBase64) return sendJson(res, 400, { error: "Arquivo obrigatorio." });

    const buffer = Buffer.from(rawBase64, "base64");
    const objectPath = `${Date.now()}-${safeFileName(fileName)}`;
    const uploadUrl = `${supabaseConfig.url}/storage/v1/object/${supabaseConfig.productImagesBucket}/${objectPath}`;

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

    const publicUrl = `${supabaseConfig.url}/storage/v1/object/public/${supabaseConfig.productImagesBucket}/${objectPath}`;
    return sendJson(res, 201, { url: publicUrl, path: objectPath });
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
};
