const { getSession, sendJson } = require("./_utils");

module.exports = function handler(req, res) {
  const session = getSession(req);
  if (!session) return sendJson(res, 401, { authenticated: false });
  return sendJson(res, 200, { authenticated: true, username: session.username });
};
