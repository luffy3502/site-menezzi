import { adminApi, clearAdminToken, setAdminToken } from "./admin-session.js";

const loginForm = document.querySelector("[data-login-form]");
const loginMessage = document.querySelector("[data-login-message]");

async function redirectIfLoggedIn() {
  try {
    await adminApi("/api/me");
    window.location.href = "/admin/";
  } catch (error) {
    clearAdminToken();
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessage.textContent = "Entrando...";
  loginMessage.classList.remove("is-error");
  const data = new FormData(loginForm);

  try {
    const session = await adminApi("/api/login", {
      method: "POST",
      body: JSON.stringify({
        username: data.get("username"),
        password: data.get("password"),
      }),
    });
    setAdminToken(session.token);
    window.location.href = "/admin/";
  } catch (error) {
    clearAdminToken();
    loginMessage.textContent = error.message;
    loginMessage.classList.add("is-error");
  }
});

redirectIfLoggedIn();
