(function () {
  const API_BASE = "../api/index.php";
  const loginFormEl = document.getElementById("loginForm");
  const loginFeedbackEl = document.getElementById("loginFeedback");

  function buildApiUrl(endpoint) {
    return `${API_BASE}?endpoint=${encodeURIComponent(endpoint)}`;
  }

  async function api(endpoint, options) {
    const response = await fetch(buildApiUrl(endpoint), {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || typeof data !== "object" || data.ok === false) {
      const message = data && typeof data === "object" ? data.message : "";
      throw new Error(message || "Erro na API.");
    }
    return data;
  }

  function setFeedback(message, isError) {
    loginFeedbackEl.textContent = message || "";
    loginFeedbackEl.classList.toggle("error", Boolean(isError));
  }

  async function checkSession() {
    try {
      const data = await api("me");
      if (data?.user?.is_admin) {
        window.location.href = "./admin.html";
      }
    } catch {
      // Usuário não autenticado; permanece no login.
    }
  }

  loginFormEl.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const payload = {
        email: document.getElementById("email").value.trim(),
        password: document.getElementById("password").value,
      };
      const data = await api("login", { method: "POST", body: JSON.stringify(payload) });
      if (!data?.user?.is_admin) {
        throw new Error("Este usuário não tem acesso administrativo.");
      }
      setFeedback("Login realizado com sucesso.");
      window.location.href = "./admin.html";
    } catch (error) {
      setFeedback(error.message, true);
    }
  });

  checkSession();
})();
