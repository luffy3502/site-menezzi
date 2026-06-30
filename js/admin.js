import { loadProducts } from "./products-store.js";
import { AdminProducts } from "./components/AdminProducts.js";

const loginPanel = document.querySelector("[data-login-panel]");
const loginForm = document.querySelector("[data-login-form]");
const loginMessage = document.querySelector("[data-login-message]");
const adminRoot = document.querySelector("[data-admin-products]");
const logoutButton = document.querySelector("[data-logout]");

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Erro na requisicao.");
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
  const products = await loadProducts({ admin: true });
  AdminProducts(adminRoot, products);
}

async function bootAdmin() {
  try {
    await api("/api/me");
    await showAdmin();
  } catch (error) {
    showLogin();
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessage.textContent = "Entrando...";
  const data = new FormData(loginForm);

  try {
    await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        username: data.get("username"),
        password: data.get("password"),
      }),
    });
    loginForm.reset();
    await showAdmin();
  } catch (error) {
    showLogin(error.message);
  }
});

logoutButton.addEventListener("click", async () => {
  await api("/api/logout", { method: "POST" }).catch(() => {});
  showLogin("Sessao encerrada.");
});

bootAdmin();
