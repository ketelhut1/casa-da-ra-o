(function () {
  const API_BASE = "../api/index.php";
  const form = document.getElementById("loginForm");
  const feedback = document.getElementById("feedback");
  const notice = document.getElementById("loginNotice");
  const params = new URLSearchParams(window.location.search);
  const nextUrl = params.get("next") || "./compra.html";
  const reason = params.get("reason") || "";
  const city = params.get("city") || "";
  const registerLink = document.querySelector('.auth-nav a[href="./cadastro.html"]');

  if (registerLink) {
    const qs = new URLSearchParams({ next: nextUrl });
    if (reason) qs.set("reason", reason);
    if (city) qs.set("city", city);
    registerLink.href = `./cadastro.html?${qs.toString()}`;
  }
  if (notice) {
    if (reason === "city_required" && city) {
      notice.textContent = `A cidade ${city} exige cadastro. Faça login para concluir o pedido e voltar ao checkout.`;
    } else {
      notice.textContent = nextUrl === "./compra.html"
        ? "Acesse sua conta para retornar à loja com o carrinho preservado."
        : "Acesse sua conta para continuar o fluxo de compra.";
    }
  }

  function apiUrl(endpoint) {
    return `${API_BASE}?endpoint=${encodeURIComponent(endpoint)}`;
  }

  function setFeedback(message, isError) {
    feedback.textContent = message || "";
    feedback.classList.toggle("error", Boolean(isError));
  }

  fetch(apiUrl("me"), { credentials: "same-origin" })
    .then((r) => r.json())
    .then((data) => {
      if (data?.user) window.location.href = nextUrl;
    })
    .catch(() => {});

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const payload = {
        email: document.getElementById("email").value.trim(),
        password: document.getElementById("password").value,
      };
      const response = await fetch(apiUrl("login"), {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || "Falha no login.");
      setFeedback("Login realizado com sucesso.");
      window.location.href = nextUrl;
    } catch (error) {
      setFeedback(error.message, true);
    }
  });
})();
