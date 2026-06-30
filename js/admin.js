import { loadProducts } from "./products-store.js";
import { AdminProducts } from "./components/AdminProducts.js";

const loginPanel = document.querySelector("[data-login-panel]");
const loginForm = document.querySelector("[data-login-form]");
const loginMessage = document.querySelector("[data-login-message]");
const adminRoot = document.querySelector("[data-admin-products]");
const logoutButton = document.querySelector("[data-logout]");
const ADMIN_SESSION_KEY = "menezzi_admin_session";

function getAdminToken() {
  return localStorage.getItem(ADMIN_SESSION_KEY);
}

function setAdminToken(token) {
  if (token) localStorage.setItem(ADMIN_SESSION_KEY, token);
}

function clearAdminToken() {
  localStorage.removeItem(ADMIN_SESSION_KEY);
}

async function api(path, options = {}) {
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

function showLogin(message = "") {
  loginPanel.hidden = false;
  adminRoot.hidden = true;
  logoutButton.hidden = true;
  loginMessage.textContent = message;
}

async function showAdmin() {
  loginPanel.hidden = true;
  adminRoot.hidden = false;
  logoutButton.hidden = false;

  try {
    const products = await loadProducts({ admin: true });
    AdminProducts(adminRoot, products);
  } catch (error) {
    if (error.status === 401) {
      clearAdminToken();
      showLogin("Sessao expirada. Entre novamente.");
      return;
    }

    AdminProducts(adminRoot, []);
    const message = adminRoot.querySelector("[data-form-message]");
    if (message) {
      message.textContent = error.message || "Nao foi possivel carregar os produtos.";
      message.classList.add("is-error");
    }
  }
}

async function bootAdmin() {
  try {
    await api("/api/me");
    await showAdmin();
  } catch (error) {
    clearAdminToken();
    showLogin("Sessao expirada. Entre novamente.");
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessage.textContent = "Entrando...";
  const data = new FormData(loginForm);

  try {
    const session = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        username: data.get("username"),
        password: data.get("password"),
      }),
    });
    setAdminToken(session.token);
    loginForm.reset();
    await showAdmin();
  } catch (error) {
    clearAdminToken();
    showLogin(error.message);
  }
});

logoutButton.addEventListener("click", async () => {
  await api("/api/logout", { method: "POST" }).catch(() => {});
  clearAdminToken();
  showLogin("Sessao encerrada.");
});

bootAdmin();
