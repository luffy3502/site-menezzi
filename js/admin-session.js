export const ADMIN_SESSION_KEY = "menezzi_admin_session";

export function getAdminToken() {
  return localStorage.getItem(ADMIN_SESSION_KEY);
}

export function setAdminToken(token) {
  if (token) localStorage.setItem(ADMIN_SESSION_KEY, token);
}

export function clearAdminToken() {
  localStorage.removeItem(ADMIN_SESSION_KEY);
}

export async function adminApi(path, options = {}) {
  const token = getAdminToken();
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || "Erro na requisicao.");
    error.status = response.status;
    throw error;
  }
  return payload;
}
