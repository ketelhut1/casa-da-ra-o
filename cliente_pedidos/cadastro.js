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
  const cepEl = document.getElementById("cep");
  const addressEl = document.getElementById("address");
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

  function onlyDigits(value) {
    return (value || "").replace(/\D/g, "");
  }

  function formatCep(value) {
    const digits = onlyDigits(value).slice(0, 8);
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }

  function cleanCityName(value) {
    const raw = (value || "").trim();
    if (!raw) return "";
    // Garante que fique apenas o nome da cidade (sem UF ou sufixos)
    // Ex.: "Pereira Barreto - SP" -> "Pereira Barreto"
    return raw
      .replace(/\s*\/\s*[A-Z]{2}$/u, "")
      .replace(/\s*-\s*[A-Z]{2}$/u, "")
      .trim();
  }

  function setCityFromCep(cityName) {
    if (!cityEl) return false;
    const cleaned = cleanCityName(cityName);
    if (!cleaned) return false;
    const normalizedTarget = normalizeName(cleaned);
    let matched = false;
    [...cityEl.options].forEach((option) => {
      const isMatch = normalizeName(option.value) === normalizedTarget;
      option.selected = isMatch;
      if (isMatch) matched = true;
    });
    if (!matched) {
      const option = document.createElement("option");
      option.value = cleaned;
      option.textContent = cleaned;
      cityEl.appendChild(option);
      cityEl.value = cleaned;
      matched = true;
    }
    cityEl.disabled = matched;
    syncNeighborhoodUi();
    return matched;
  }

  async function lookupCep() {
    if (!cepEl) return;
    const cep = onlyDigits(cepEl.value);
    if (cep.length !== 8) return;
    try {
      setFeedback("Buscando endereço pelo CEP...", false);
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      if (!response.ok || data?.erro) {
        throw new Error("CEP não encontrado.");
      }
      if (addressEl && data.logradouro) {
        addressEl.value = data.logradouro;
      }
      const cityFilled = setCityFromCep(data.localidade || "");
      if (!cityFilled) {
        throw new Error("Não foi possível preencher a cidade automaticamente.");
      }
      setFeedback("", false);
    } catch (error) {
      cityEl.disabled = false;
      syncNeighborhoodUi();
      setFeedback(error.message || "Não foi possível buscar o CEP.", true);
    }
  }

  fillNeighborhoodOptions();
  cityEl?.addEventListener("change", syncNeighborhoodUi);
  cepEl?.addEventListener("input", () => {
    cepEl.value = formatCep(cepEl.value);
    if (onlyDigits(cepEl.value).length < 8 && cityEl) {
      cityEl.disabled = false;
    }
  });
  cepEl?.addEventListener("blur", lookupCep);

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
        address: addressEl?.value.trim() || "",
        city: cityVal,
        neighborhood: isIlhaSolteira(cityVal) ? neighborhoodVal : "",
        phone: document.getElementById("phone").value.trim(),
        password: document.getElementById("password").value,
      };
      const cepVal = onlyDigits(cepEl?.value || "");
      if (
        !payload.name ||
        !payload.cpf ||
        !payload.email ||
        cepVal.length !== 8 ||
        !payload.address ||
        !payload.city ||
        !payload.phone ||
        !payload.password
      ) {
        throw new Error("Preencha todos os campos e informe um CEP válido.");
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
