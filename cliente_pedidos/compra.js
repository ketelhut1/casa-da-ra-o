(function () {
  const API_BASE = "../api/index.php";
  const CART_STORAGE_KEY = "casa_racoes_cart_v3";
  const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

  const searchEl = document.getElementById("search");
  const categoryFilterEl = document.getElementById("categoryFilter");
  const productCountEl = document.getElementById("productCount");
  const productGridEl = document.getElementById("productGrid");
  const cartItemsEl = document.getElementById("cartItems");
  const cartTotalEl = document.getElementById("cartTotal");
  const clearCartBtnEl = document.getElementById("clearCartBtn");
  const checkoutBtnEl = document.getElementById("checkoutBtn");
  const customerNameEl = document.getElementById("customerName");
  const customerPhoneEl = document.getElementById("customerPhone");
  const customerCepEl = document.getElementById("customerCep");
  const customerAddressEl = document.getElementById("customerAddress");
  const customerCityEl = document.getElementById("customerCity");
  const customerNeighborhoodWrapEl = document.getElementById("customerNeighborhoodWrap");
  const customerNeighborhoodEl = document.getElementById("customerNeighborhood");
  const cityRuleNoticeEl = document.getElementById("cityRuleNotice");
  const paymentMethodEl = document.getElementById("paymentMethod");
  const orderNotesEl = document.getElementById("orderNotes");
  const ordersListEl = document.getElementById("ordersList");
  const refreshOrdersBtnEl = document.getElementById("refreshOrdersBtn");
  const userBoxEl = document.getElementById("userBox");
  const logoutBtnEl = document.getElementById("logoutBtn");
  const feedbackEl = document.getElementById("feedback");
  const authNoticeEl = document.getElementById("authNotice");
  const adminPanelEl = document.getElementById("adminPanel");
  const adminProductFormEl = document.getElementById("adminProductForm");
  const adminProductIdEl = document.getElementById("adminProductId");
  const adminCodigoEl = document.getElementById("adminCodigo");
  const adminDescricaoEl = document.getElementById("adminDescricao");
  const adminCustoEl = document.getElementById("adminCusto");
  const adminCategoriaEl = document.getElementById("adminCategoria");
  const adminImageUrlEl = document.getElementById("adminImageUrl");
  const adminImageFileEl = document.getElementById("adminImageFile");
  const adminAtivoEl = document.getElementById("adminAtivo");
  const adminNewBtnEl = document.getElementById("adminNewBtn");
  const adminDeleteBtnEl = document.getElementById("adminDeleteBtn");
  const adminFeedbackEl = document.getElementById("adminFeedback");
  const ILHA_SOLTEIRA_NORM = "ilha solteira";
  const ILHA_BAIRROS = [
    "Morada do Sol",
    "Zona Sul",
    "Zona Norte",
    "Ipê",
    "Praia",
    "Cinturão Verde",
    "Recanto das Águas",
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
  // Bairros com taxa fixa. Os demais seguem a regra geral (R$ 2,50 se subtotal < R$ 20, senão default_shipping).
  const FIXED_LOCALITY_SHIPPING = {
    praia: 5,
    "morada do sol": 5,
    "recanto das aguas": 5,
    "cinturao verde": 5,
    ipe: 8,
  };

  let currentUser = null;
  let products = [];
  let cart = loadCart();
  let storeSettings = { cities: [] };
  const urlParams = new URLSearchParams(window.location.search);
  const highlightOrderId = urlParams.get("highlight_order");

  function apiUrl(endpoint) {
    const [name, query = ""] = endpoint.split("?");
    return `${API_BASE}?endpoint=${encodeURIComponent(name)}${query ? `&${query}` : ""}`;
  }

  async function api(endpoint, options) {
    const response = await fetch(apiUrl(endpoint), {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.message || "Falha na API.");
    return data;
  }

  function setFeedback(message, isError) {
    feedbackEl.textContent = message || "";
    feedbackEl.classList.toggle("error", Boolean(isError));
  }

  function setAdminFeedback(message, isError) {
    if (!adminFeedbackEl) return;
    adminFeedbackEl.textContent = message || "";
    adminFeedbackEl.classList.toggle("error", Boolean(isError));
  }

  function isAdmin() {
    return Boolean(currentUser?.is_admin);
  }

  function normalize(text) {
    return (text || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  }

  function formatMoney(value) {
    return currency.format(Number(value) || 0);
  }

  function normalizeName(value) {
    return (value || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").trim();
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
    return raw
      .replace(/\s*\/\s*[A-Z]{2}$/u, "")
      .replace(/\s*-\s*[A-Z]{2}$/u, "")
      .trim();
  }

  function isIlhaSolteiraCity(cityName) {
    return normalizeName(cleanCityName(cityName)) === ILHA_SOLTEIRA_NORM;
  }

  function fillCheckoutNeighborhoodOptions() {
    if (!customerNeighborhoodEl) return;
    customerNeighborhoodEl.innerHTML = '<option value="">Selecione o bairro</option>';
    ILHA_BAIRROS.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      customerNeighborhoodEl.appendChild(option);
    });
  }

  function syncCheckoutNeighborhoodUi() {
    if (!customerNeighborhoodWrapEl || !customerNeighborhoodEl) return;
    const show = isIlhaSolteiraCity(customerCityEl?.value || "");
    customerNeighborhoodWrapEl.classList.toggle("hidden", !show);
    customerNeighborhoodEl.disabled = !show;
    customerNeighborhoodEl.required = show;
    if (!show) customerNeighborhoodEl.value = "";
  }

  function resolveShippingLocality(cityName, neighborhoodName) {
    const city = (cityName || "").trim();
    if (isIlhaSolteiraCity(city) && (neighborhoodName || "").trim()) {
      return neighborhoodName.trim();
    }
    return city;
  }

  function calculateShippingFee(cityName, subtotal, neighborhoodName) {
    const key = normalizeName(resolveShippingLocality(cityName, neighborhoodName));
    if (key && Object.prototype.hasOwnProperty.call(FIXED_LOCALITY_SHIPPING, key)) {
      return FIXED_LOCALITY_SHIPPING[key];
    }
    if (subtotal < 20) return 2.5;
    const fallback = Number(storeSettings?.default_shipping);
    return Number.isFinite(fallback) && fallback > 0 ? fallback : 0;
  }

  function humanStatus(status) {
    const map = {
      novo: "Novo",
      em_preparo: "Em preparo",
      enviado: "Enviado",
      concluido: "Concluído",
      cancelado: "Cancelado",
    };
    return map[status] || status;
  }

  function cityRequiresRegistration(cityName) {
    const city = (cityName || "").trim().toLowerCase();
    if (!city) return false;
    return (storeSettings.cities || []).some(
      (entry) => entry.name.trim().toLowerCase() === city && Boolean(entry.require_registration),
    );
  }

  function updateCityRuleNotice() {
    if (!cityRuleNoticeEl) return;
    const city = customerCityEl?.value || "";
    if (!city) {
      cityRuleNoticeEl.textContent = "";
      return;
    }
    if (cityRequiresRegistration(city)) {
      cityRuleNoticeEl.textContent = "Esta cidade exige cadastro para concluir o pedido.";
    } else {
      cityRuleNoticeEl.textContent = "Esta cidade permite finalizar como visitante.";
    }
  }

  function setCheckoutCityFromCep(cityName) {
    const cleaned = cleanCityName(cityName);
    if (!cleaned || !customerCityEl) return false;
    const normalizedTarget = normalizeName(cleaned);
    let matched = false;
    [...customerCityEl.options].forEach((option) => {
      const isMatch = normalizeName(option.value) === normalizedTarget;
      option.selected = isMatch;
      if (isMatch) matched = true;
    });
    if (!matched) {
      const option = document.createElement("option");
      option.value = cleaned;
      option.textContent = cleaned;
      customerCityEl.appendChild(option);
      customerCityEl.value = cleaned;
      matched = true;
    }
    customerCityEl.disabled = matched;
    syncCheckoutNeighborhoodUi();
    updateCityRuleNotice();
    renderCart();
    return matched;
  }

  async function lookupCheckoutCep() {
    if (!customerCepEl) return;
    const cep = onlyDigits(customerCepEl.value);
    if (cep.length !== 8) return;
    try {
      setFeedback("Buscando endereço pelo CEP...", false);
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      if (!response.ok || data?.erro) {
        throw new Error("CEP não encontrado.");
      }
      if (customerAddressEl && data.logradouro) {
        customerAddressEl.value = data.logradouro;
      }
      const cityFilled = setCheckoutCityFromCep(data.localidade || "");
      if (!cityFilled) {
        throw new Error("Não foi possível preencher a cidade automaticamente.");
      }
      setFeedback("", false);
    } catch (error) {
      customerCityEl.disabled = false;
      syncCheckoutNeighborhoodUi();
      updateCityRuleNotice();
      renderCart();
      setFeedback(error.message || "Não foi possível buscar o CEP.", true);
    }
  }

  function fillCheckoutFromUser() {
    if (!currentUser) return;
    customerNameEl.value = currentUser.name || customerNameEl.value;
    customerPhoneEl.value = currentUser.phone || customerPhoneEl.value;
    customerAddressEl.value = currentUser.address || customerAddressEl.value;
    customerCityEl.value = currentUser.city || customerCityEl.value;
    if (customerNeighborhoodEl && isIlhaSolteiraCity(customerCityEl.value)) {
      customerNeighborhoodEl.value = currentUser.neighborhood || "";
    }
    syncCheckoutNeighborhoodUi();
    updateCityRuleNotice();
  }

  function loadCart() {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveCart() {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }

  function renderProducts() {
    const q = normalize(searchEl.value.trim());
    const category = categoryFilterEl.value;
    const filtered = products.filter((item) => {
      const okCategory = category === "all" || item.categoria === category;
      const okText = !q || normalize(item.codigo).includes(q) || normalize(item.descricao).includes(q);
      return okCategory && okText;
    });

    productGridEl.innerHTML = "";
    filtered.forEach((item) => {
      const card = document.createElement("article");
      card.className = "product-card";
      card.innerHTML = `
        <img src="${item.image_url || "https://images.unsplash.com/photo-1589924691995-400dc9ecc119?auto=format&fit=crop&w=800&q=60"}" alt="${escapeHtml(item.descricao)}">
        <div class="product-info">
          <strong>${escapeHtml(item.descricao)}</strong>
          <span class="muted">Codigo ${escapeHtml(item.codigo)}</span>
          <span>${formatMoney(item.custo_unit)}</span>
          ${isAdmin() ? `<span class="admin-tag">${item.ativo ? "Ativo" : "Inativo"}</span>` : ""}
          <div class="product-actions">
            <button type="button" data-add>Adicionar</button>
            ${isAdmin() ? '<button type="button" class="danger" data-edit>Editar</button>' : ""}
          </div>
        </div>
      `;
      card.querySelector("[data-add]").addEventListener("click", () => addToCart(item));
      if (isAdmin()) {
        card.querySelector("[data-edit]").addEventListener("click", () => {
          fillAdminProductForm(item);
          setAdminFeedback("Produto carregado para edição.");
        });
      }
      productGridEl.appendChild(card);
    });
    productCountEl.textContent = `${filtered.length} produto(s)`;
  }

  function escapeHtml(text) {
    const d = document.createElement("div");
    d.textContent = text || "";
    return d.innerHTML;
  }

  function addToCart(item) {
    const existing = cart.find((entry) => entry.product_id === item.id);
    if (existing) existing.quantity += 1;
    else cart.push({ product_id: item.id, descricao: item.descricao, codigo: item.codigo, price: item.custo_unit, quantity: 1 });
    saveCart();
    renderCart();
  }

  function renderCart() {
    if (!cart.length) {
      cartItemsEl.innerHTML = '<p class="muted">Carrinho vazio.</p>';
      cartTotalEl.textContent = "Total: R$ 0,00";
      return;
    }
    cartItemsEl.innerHTML = "";
    let total = 0;
    cart.forEach((item, index) => {
      total += item.price * item.quantity;
      const line = document.createElement("div");
      line.className = "cart-line";
      line.innerHTML = `
        <strong>${escapeHtml(item.descricao)}</strong>
        <span class="muted">${formatMoney(item.price)} x ${item.quantity}</span>
      `;
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.textContent = "Remover";
      removeBtn.addEventListener("click", () => {
        cart.splice(index, 1);
        saveCart();
        renderCart();
      });
      line.appendChild(removeBtn);
      cartItemsEl.appendChild(line);
    });
    const shippingFee = calculateShippingFee(
      customerCityEl?.value || "",
      total,
      customerNeighborhoodEl?.value || "",
    );
    const totalWithShipping = total + shippingFee;
    cartTotalEl.innerHTML = `Subtotal: ${formatMoney(total)}<br>Taxa de entrega: ${formatMoney(shippingFee)}<br><strong>Total: ${formatMoney(totalWithShipping)}</strong>`;
  }

  function renderOrders(orders) {
    if (!currentUser) {
      ordersListEl.innerHTML = '<p class="muted">Faca login para ver o historico.</p>';
      return;
    }
    if (!orders.length) {
      ordersListEl.innerHTML = '<p class="muted">Sem pedidos ainda.</p>';
      return;
    }
    ordersListEl.innerHTML = "";
    orders.forEach((order) => {
      const card = document.createElement("article");
      card.className = "order-card";
      const statusClass = `status-${order.status || "novo"}`;
      const itemsHtml = (order.items || []).map((item) => `
        <li>${escapeHtml(item.product_name)} x${item.quantity} - ${formatMoney(item.line_total)}</li>
      `).join("");
      card.innerHTML = `
        <div class="order-head">
          <strong>Pedido #${order.id}</strong>
          <span class="status-chip ${statusClass}">${humanStatus(order.status)}</span>
        </div>
        <div class="muted">${new Date(order.created_at.replace(" ", "T")).toLocaleString("pt-BR")}</div>
        <div>Total: ${formatMoney(order.total_amount)}</div>
        <button type="button" class="details-btn">Ver detalhes</button>
        <div class="order-details hidden">
          <div><strong>Pagamento:</strong> ${escapeHtml(order.payment_method || "-")}</div>
          <div><strong>Cidade:</strong> ${escapeHtml(order.customer_city || "-")}</div>
          <div><strong>Endereço:</strong> ${escapeHtml(order.customer_address || "-")}</div>
          <div><strong>Observações:</strong> ${escapeHtml(order.notes || "-")}</div>
          <ul>${itemsHtml || "<li>Sem itens.</li>"}</ul>
        </div>
      `;
      const detailsBtn = card.querySelector(".details-btn");
      const detailsEl = card.querySelector(".order-details");
      detailsBtn?.addEventListener("click", () => {
        detailsEl?.classList.toggle("hidden");
      });

      if (highlightOrderId && String(order.id) === String(highlightOrderId)) {
        detailsEl?.classList.remove("hidden");
        card.classList.add("highlight-order");
        setTimeout(() => {
          card.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 120);
      }
      ordersListEl.appendChild(card);
    });
  }

  function fillAdminProductForm(product) {
    if (!adminProductFormEl) return;
    adminProductIdEl.value = String(product.id || "");
    adminCodigoEl.value = product.codigo || "";
    adminDescricaoEl.value = product.descricao || "";
    adminCustoEl.value = String(product.custo_unit ?? "").replace(".", ",");
    adminCategoriaEl.value = product.categoria || "outro";
    adminImageUrlEl.value = product.image_url || "";
    adminAtivoEl.checked = Boolean(product.ativo);
  }

  function resetAdminProductForm() {
    if (!adminProductFormEl) return;
    adminProductFormEl.reset();
    adminProductIdEl.value = "";
    adminAtivoEl.checked = true;
    if (adminImageFileEl) adminImageFileEl.value = "";
  }

  async function loadSession() {
    const data = await api("me");
    currentUser = data.user;
    userBoxEl.textContent = currentUser ? `${currentUser.name}` : "Visitante";
    logoutBtnEl.classList.toggle("hidden", !currentUser);
    adminPanelEl?.classList.toggle("hidden", !isAdmin());
    if (authNoticeEl) {
      authNoticeEl.classList.toggle("hidden", false);
      authNoticeEl.textContent = currentUser
        ? "Você está logado e pode acompanhar seus pedidos no histórico."
        : "Você está como visitante. Algumas cidades exigem cadastro para concluir o pedido.";
    }
    fillCheckoutFromUser();
    return true;
  }

  async function loadStoreSettings() {
    const data = await api("public-store-settings");
    storeSettings = data.settings || { cities: [] };
    const cities = Array.isArray(storeSettings.cities) ? [...storeSettings.cities] : [];
    customerCityEl.innerHTML = '<option value="">Selecione a cidade</option>';
    cities.forEach((city) => {
      const option = document.createElement("option");
      option.value = city.name;
      option.textContent = city.name;
      customerCityEl.appendChild(option);
    });
    fillCheckoutFromUser();
    syncCheckoutNeighborhoodUi();
    renderCart();
    updateCityRuleNotice();
  }

  async function loadProducts() {
    const data = await api("products");
    products = data.products;
    renderProducts();
  }

  async function loadOrders() {
    if (!currentUser) {
      renderOrders([]);
      return;
    }
    const data = await api("orders");
    renderOrders(data.orders);
  }

  checkoutBtnEl.addEventListener("click", async () => {
    if (!cart.length) {
      setFeedback("Carrinho vazio.", true);
      return;
    }
    const customerName = customerNameEl.value.trim();
    const customerPhone = customerPhoneEl.value.trim();
    const customerCep = onlyDigits(customerCepEl?.value || "");
    const customerAddress = customerAddressEl.value.trim();
    const customerCity = customerCityEl.value.trim();
    const customerNeighborhood = (customerNeighborhoodEl?.value || "").trim();
    if (!customerName || !customerPhone || customerCep.length !== 8 || !customerAddress || !customerCity) {
      setFeedback("Preencha nome, telefone, CEP válido, endereço e cidade.", true);
      return;
    }
    if (isIlhaSolteiraCity(customerCity) && !customerNeighborhood) {
      setFeedback("Selecione o bairro em Ilha Solteira.", true);
      return;
    }
    if (!currentUser && cityRequiresRegistration(customerCity)) {
      const next = encodeURIComponent("./compra.html");
      const city = encodeURIComponent(customerCity);
      window.location.href = `./login.html?next=${next}&reason=city_required&city=${city}`;
      return;
    }
    const paymentMethod = (paymentMethodEl?.value || "").trim();
    if (!paymentMethod) {
      setFeedback("Selecione a forma de pagamento.", true);
      return;
    }
    try {
      const result = await api("orders", {
        method: "POST",
        body: JSON.stringify({
          payment_method: paymentMethod,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_address: customerAddress,
          customer_city: customerCity,
          customer_neighborhood: isIlhaSolteiraCity(customerCity) ? customerNeighborhood : "",
          notes: orderNotesEl.value.trim(),
          items: cart.map((item) => ({ product_id: item.product_id, quantity: item.quantity })),
        }),
      });
      const orderId = result.order_id;
      const subtotalPre = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
      const shipPre = calculateShippingFee(customerCity, subtotalPre, customerNeighborhood);
      const cityLabel =
        isIlhaSolteiraCity(customerCity) && customerNeighborhood
          ? `Ilha Solteira — ${customerNeighborhood}`
          : customerCity;
      localStorage.setItem("casa_last_order", JSON.stringify({
        id: orderId,
        status: "novo",
        created_at: new Date().toISOString(),
        payment_method: paymentMethod,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_address: customerAddress,
        customer_city: cityLabel,
        notes: orderNotesEl.value.trim(),
        subtotal_amount: subtotalPre,
        shipping_fee: shipPre,
        total_amount: subtotalPre + shipPre,
        items: cart.map((i) => ({ product_name: i.descricao, quantity: i.quantity, line_total: i.price * i.quantity })),
      }));
      cart = [];
      if (paymentMethodEl) paymentMethodEl.value = "";
      orderNotesEl.value = "";
      saveCart();
      renderCart();
      await loadOrders();
      window.location.href = `./confirmacao.html?order=${encodeURIComponent(orderId)}`;
    } catch (error) {
      setFeedback(error.message, true);
    }
  });

  refreshOrdersBtnEl.addEventListener("click", () => loadOrders().catch((error) => setFeedback(error.message, true)));
  clearCartBtnEl.addEventListener("click", () => {
    cart = [];
    saveCart();
    renderCart();
  });
  searchEl.addEventListener("input", renderProducts);
  categoryFilterEl.addEventListener("change", renderProducts);
  customerCepEl?.addEventListener("input", () => {
    customerCepEl.value = formatCep(customerCepEl.value);
    if (onlyDigits(customerCepEl.value).length < 8) {
      customerCityEl.disabled = false;
    }
  });
  customerCepEl?.addEventListener("blur", lookupCheckoutCep);
  customerCityEl?.addEventListener("change", () => {
    syncCheckoutNeighborhoodUi();
    updateCityRuleNotice();
    renderCart();
  });
  customerNeighborhoodEl?.addEventListener("change", renderCart);
  logoutBtnEl.addEventListener("click", async () => {
    await api("logout", { method: "POST", body: "{}" });
    currentUser = null;
    userBoxEl.textContent = "Visitante";
    logoutBtnEl.classList.add("hidden");
    adminPanelEl?.classList.add("hidden");
    renderOrders([]);
    setFeedback("Sessao encerrada.");
    updateCityRuleNotice();
  });

  if (adminProductFormEl) {
    adminProductFormEl.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!isAdmin()) return;
      try {
        const payload = {
          id: Number(adminProductIdEl.value || 0),
          codigo: adminCodigoEl.value.trim(),
          descricao: adminDescricaoEl.value.trim(),
          custo_unit: adminCustoEl.value.trim(),
          categoria: adminCategoriaEl.value,
          image_url: adminImageUrlEl.value.trim(),
          ativo: adminAtivoEl.checked,
        };
        await api("products", { method: "POST", body: JSON.stringify(payload) });
        setAdminFeedback("Produto salvo com sucesso.");
        resetAdminProductForm();
        await loadProducts();
      } catch (error) {
        setAdminFeedback(error.message, true);
      }
    });
  }

  adminNewBtnEl?.addEventListener("click", () => {
    resetAdminProductForm();
    setAdminFeedback("Formulario limpo.");
  });

  adminDeleteBtnEl?.addEventListener("click", async () => {
    if (!isAdmin()) return;
    const productId = Number(adminProductIdEl.value || 0);
    if (!productId) {
      setAdminFeedback("Selecione um produto para remover.", true);
      return;
    }
    if (!window.confirm("Deseja remover este produto?")) return;
    try {
      await api(`products?id=${productId}`, { method: "DELETE" });
      setAdminFeedback("Produto removido com sucesso.");
      resetAdminProductForm();
      await loadProducts();
    } catch (error) {
      setAdminFeedback(error.message, true);
    }
  });

  adminImageFileEl?.addEventListener("change", () => {
    const file = adminImageFileEl.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAdminFeedback("Selecione um arquivo de imagem valido.", true);
      adminImageFileEl.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      adminImageUrlEl.value = String(reader.result || "");
      setAdminFeedback("Imagem carregada do computador.");
    };
    reader.onerror = () => {
      setAdminFeedback("Nao foi possivel ler a imagem selecionada.", true);
    };
    reader.readAsDataURL(file);
  });

  fillCheckoutNeighborhoodOptions();

  async function initPage() {
    try {
      await Promise.all([loadSession(), loadStoreSettings(), loadProducts(), loadOrders()]);
    } catch (error) {
      setFeedback(error.message, true);
    } finally {
      renderCart();
    }
  }

  initPage();
})();
