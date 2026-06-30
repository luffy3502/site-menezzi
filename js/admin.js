import { clearAdminToken, adminApi } from "./admin-session.js";
import { loadAdminContent, loadProducts } from "./products-store.js";
import { AdminProducts } from "./components/AdminProducts.js";

const adminRoot = document.querySelector("[data-admin-products]");
const logoutButton = document.querySelector("[data-logout]");

function redirectToLogin() {
  window.location.href = "/admin/login/";
}

async function showAdmin() {
  adminRoot.hidden = false;
  logoutButton.hidden = false;

  try {
    const [products, content] = await Promise.all([
      loadProducts({ admin: true }),
      loadAdminContent().catch(() => ({ categories: [], gallery: [], settings: {} })),
    ]);
    AdminProducts(adminRoot, products, content);
  } catch (error) {
    if (error.status === 401) {
      clearAdminToken();
      redirectToLogin();
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
    await adminApi("/api/me");
    await showAdmin();
  } catch (error) {
    clearAdminToken();
    redirectToLogin();
  }
}

logoutButton.addEventListener("click", async () => {
  await adminApi("/api/logout", { method: "POST" }).catch(() => {});
  clearAdminToken();
  redirectToLogin();
});

bootAdmin();
