(function () {
  const API_BASE = "../api/index.php";
  const ILHA_SOLTEIRA_NORM = "ilha solteira";
  const ILHA_BAIRROS = [
    "Morada do Sol",
    "Zona Sul",
    "Zona Norte",
    "Ipê",
    "Praia",
    "Cinturão Verde",
    "Jardim Aeroporto",
    "Novo Horizonte",
    "Ilha do Sol",
    "Nova Ilha",
    "Ilha Bela",
    "Santa Catarina",
    "Morumbi",
    "Coabi",
    "Portal do Bosque",
  ];

  const form = document.getElementById("registerForm");
  const feedback = document.getElementById("feedback");
  const notice = document.getElementById("registerNotice");
  const cityEl = document.getElementById("city");
  const neighborhoodWrap = document.getElementById("neighborhoodWrap");
  const neighborhoodEl = document.getElementById("neighborhood");
  const params = new URLSearchParams(window.location.search);
  const nextUrl = params.get("next") || "./compra.html";
  const reason = params.get("reason") || "";
  const city = params.get("city") || "";
  const loginLink = document.querySelector('.auth-nav a[href="./login.html"]');

  function normalizeName(value) {
    return (value || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").trim();
  }

  function isIlhaSolteira(cityName) {
    return normalizeName(cityName) === ILHA_SOLTEIRA_NORM;
  }

  function fillNeighborhoodOptions() {
    if (!neighborhoodEl) return;
    neighborhoodEl.innerHTML = '<option value="">Selecione o bairro</option>';
    ILHA_BAIRROS.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      neighborhoodEl.appendChild(option);
    });
  }

  function syncNeighborhoodUi() {
    if (!neighborhoodWrap || !neighborhoodEl) return;
    const show = isIlhaSolteira(cityEl?.value || "");
    neighborhoodWrap.classList.toggle("hidden", !show);
    neighborhoodEl.disabled = !show;
    neighborhoodEl.required = show;
    if (!show) neighborhoodEl.value = "";
  }

  if (loginLink) {
    const qs = new URLSearchParams({ next: nextUrl });
    if (reason) qs.set("reason", reason);
    if (city) qs.set("city", city);
    loginLink.href = `./login.html?${qs.toString()}`;
  }
  if (notice) {
    if (reason === "city_required" && city) {
      notice.textContent = `A cidade ${city} exige cadastro. Complete seus dados para liberar o pedido.`;
    } else {
      notice.textContent = nextUrl === "./compra.html"
        ? "Complete seu cadastro para concluir a compra com os itens no carrinho."
        : "Complete seu cadastro para continuar o fluxo de compra.";
    }
  }

  function apiUrl(endpoint) {
    return `${API_BASE}?endpoint=${encodeURIComponent(endpoint)}`;
  }

  function setFeedback(message, isError) {
    feedback.textContent = message || "";
    feedback.classList.toggle("error", Boolean(isError));
  }

  fillNeighborhoodOptions();
  cityEl?.addEventListener("change", syncNeighborhoodUi);

  async function loadCities() {
    if (!cityEl) return;
    try {
      const response = await fetch(apiUrl("public-store-settings"), { credentials: "same-origin" });
      const data = await response.json();
      const cities = Array.isArray(data?.settings?.cities) ? data.settings.cities : [];
      if (cities.length) {
        cityEl.innerHTML = '<option value="">Selecione a cidade</option>';
        cities.forEach((entry) => {
          const name = (entry?.name || "").trim();
          if (!name) return;
          const option = document.createElement("option");
          option.value = name;
          option.textContent = name;
          cityEl.appendChild(option);
        });
      }
    } catch {
      // Mantem lista padrao fixa se a API falhar.
    } finally {
      if (city) cityEl.value = city;
      syncNeighborhoodUi();
    }
  }

  loadCities();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const cityVal = cityEl?.value.trim() || "";
      const neighborhoodVal = neighborhoodEl?.value.trim() || "";
      const payload = {
        name: document.getElementById("name").value.trim(),
        cpf: document.getElementById("cpf").value.trim(),
        email: document.getElementById("email").value.trim(),
        address: document.getElementById("address").value.trim(),
        city: cityVal,
        neighborhood: isIlhaSolteira(cityVal) ? neighborhoodVal : "",
        phone: document.getElementById("phone").value.trim(),
        password: document.getElementById("password").value,
      };
      if (
        !payload.name ||
        !payload.cpf ||
        !payload.email ||
        !payload.address ||
        !payload.city ||
        !payload.phone ||
        !payload.password
      ) {
        throw new Error("Todos os campos são obrigatórios.");
      }
      if (isIlhaSolteira(cityVal) && !payload.neighborhood) {
        throw new Error("Selecione o bairro em Ilha Solteira.");
      }
      const response = await fetch(apiUrl("register"), {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || "Falha no cadastro.");
      setFeedback("Cadastro realizado com sucesso.");
      window.location.href = nextUrl;
    } catch (error) {
      setFeedback(error.message, true);
    }
  });
})();
