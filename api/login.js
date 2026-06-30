const { createSessionCookie, createSessionToken, readJson, sendJson } = require("./_utils");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Metodo nao permitido." });
  }

  try {
    const { username, password } = await readJson(req);
    const validUser = process.env.ADMIN_USER;
    const validPassword = process.env.ADMIN_PASSWORD;

    if (!validUser || !validPassword) {
      return sendJson(res, 503, { error: "ADMIN_USER e ADMIN_PASSWORD nao configurados." });
    }

    if (username !== validUser || password !== validPassword) {
      return sendJson(res, 401, { error: "Usuario ou senha invalidos." });
    }

    const token = createSessionToken(username);
    return sendJson(res, 200, { ok: true, token }, { "Set-Cookie": createSessionCookie(username, token) });
  } catch (error) {
    return sendJson(res, 400, { error: error.message });
  }
};
