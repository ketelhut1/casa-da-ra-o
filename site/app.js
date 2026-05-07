(function () {
  const API_BASE = "../api/index.php";
  const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

  const adminUserEl = document.getElementById("adminUser");
  const logoutBtnEl = document.getElementById("logoutBtn");
  const navButtons = Array.from(document.querySelectorAll(".nav-btn"));
  const tabPanels = Array.from(document.querySelectorAll(".tab-panel"));
  const refreshDashboardBtnEl = document.getElementById("refreshDashboardBtn");
  const dashboardMetricsEl = document.getElementById("dashboardMetrics");
  const statusFilterEl = document.getElementById("statusFilter");
  const refreshOrdersBtnEl = document.getElementById("refreshOrdersBtn");
  const ordersListEl = document.getElementById("ordersList");
  const productFormEl = document.getElementById("productForm");
  const refreshProductsBtnEl = document.getElementById("refreshProductsBtn");
  const resetFormBtnEl = document.getElementById("resetFormBtn");
  const productSearchEl = document.getElementById("productSearch");
  const productsListEl = document.getElementById("productsList");
  const productFeedbackEl = document.getElementById("productFeedback");
  const refreshClientsBtnEl = document.getElementById("refreshClientsBtn");
  const clientSearchEl = document.getElementById("clientSearch");
  const clientsListEl = document.getElementById("clientsList");
  const refreshReportsBtnEl = document.getElementById("refreshReportsBtn");
  const salesByCityListEl = document.getElementById("salesByCityList");
  const topProductsListEl = document.getElementById("topProductsList");
  const notePhotoInputEl = document.getElementById("notePhotoInput");
  const scanNoteBtnEl = document.getElementById("scanNoteBtn");
  const saveStockEntryBtnEl = document.getElementById("saveStockEntryBtn");
  const noteTextEl = document.getElementById("noteText");
  const suggestedEntriesEl = document.getElementById("suggestedEntries");
  const stockEntryFeedbackEl = document.getElementById("stockEntryFeedback");
  const refreshSettingsBtnEl = document.getElementById("refreshSettingsBtn");
  const settingsFormEl = document.getElementById("settingsForm");
  const settingsFeedbackEl = document.getElementById("settingsFeedback");
  const storeNameEl = document.getElementById("storeName");
  const storePhoneEl = document.getElementById("storePhone");
  const storeEmailEl = document.getElementById("storeEmail");
  const defaultShippingEl = document.getElementById("defaultShipping");
  const citiesTextareaEl = document.getElementById("citiesTextarea");

  let currentUser = null;
  let products = [];
  let dashboard = null;
  let clients = [];
  let salesReport = null;

  function buildApiUrl(endpoint) {
    const [name, query = ""] = endpoint.split("?");
    return `${API_BASE}?endpoint=${encodeURIComponent(name)}${query ? `&${query}` : ""}`;
  }

  function api(endpoint, options) {
    return fetch(buildApiUrl(endpoint), {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      ...options,
    }).then(async (response) => {
      const data = await response.json().catch(() => null);
      if (!response.ok || !data || typeof data !== "object" || data.ok === false) {
        const message = data && typeof data === "object" ? data.message : "";
        throw new Error(message || "Erro na API.");
      }
      return data;
    });
  }

  function setProductFeedback(message, isError) {
    productFeedbackEl.textContent = message || "";
    productFeedbackEl.classList.toggle("error", Boolean(isError));
  }

  function setSettingsFeedback(message, isError) {
    settingsFeedbackEl.textContent = message || "";
    settingsFeedbackEl.classList.toggle("error", Boolean(isError));
  }

  function setStockEntryFeedback(message, isError) {
    stockEntryFeedbackEl.textContent = message || "";
    stockEntryFeedbackEl.classList.toggle("error", Boolean(isError));
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

  function humanPayment(method) {
    const map = {
      pix: "PIX",
      cartao: "Cartão",
      dinheiro: "Dinheiro",
    };
    return map[method] || method || "-";
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text || "";
    return div.innerHTML;
  }

  function formatMoney(value) {
    return currency.format(Number(value) || 0);
  }

  function normalize(text) {
    return (text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");
  }

  function switchTab(tabName) {
    navButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.tab === tabName);
    });
    tabPanels.forEach((panel) => {
      panel.classList.toggle("hidden", panel.id !== `tab-${tabName}`);
    });
  }

  function fillProductForm(product) {
    document.getElementById("productId").value = product.id || "";
    document.getElementById("codigo").value = product.codigo || "";
    document.getElementById("descricao").value = product.descricao || "";
    document.getElementById("custo").value = String(product.custo_unit ?? "").replace(".", ",");
    document.getElementById("saldo").value = product.saldo || "";
    document.getElementById("total").value = product.total || "";
    document.getElementById("imageUrl").value = product.image_url || "";
    document.getElementById("categoria").value = product.categoria || "outro";
    document.getElementById("ativo").checked = Boolean(product.ativo);
  }

  function resetProductForm() {
    productFormEl.reset();
    document.getElementById("productId").value = "";
    document.getElementById("ativo").checked = true;
  }

  function renderOrders(orders) {
    if (!orders.length) {
      ordersListEl.innerHTML = '<p class="empty-message">Nenhum pedido encontrado.</p>';
      return;
    }

    ordersListEl.innerHTML = "";
    orders.forEach((order) => {
      const card = document.createElement("article");
      card.className = "list-card";
      const itemsHtml = order.items
        .map((item) => `<li>${escapeHtml(item.product_name)} x${item.quantity} - ${formatMoney(item.line_total)}</li>`)
        .join("");
      const customerName = order.customer_name || order.user_name || "-";
      const customerPhone = order.customer_phone || order.user_phone || "-";
      const customerCity = order.customer_city || "-";
      const customerAddress = order.customer_address || "-";
      const paymentLabel = humanPayment(order.payment_method);

      card.innerHTML = `
        <div class="section-head">
          <div>
            <strong>Pedido #${order.id}</strong>
            <div class="muted">${escapeHtml(customerName)} • ${escapeHtml(customerPhone)}</div>
            <div class="muted">Conta: ${escapeHtml(order.user_name || "-")} • ${escapeHtml(order.user_email || "-")}</div>
          </div>
          <span class="status status-${order.status}">${humanStatus(order.status)}</span>
        </div>
        <div class="muted">${new Date(order.created_at.replace(" ", "T")).toLocaleString("pt-BR")}</div>
        <p><strong>Entrega:</strong> ${escapeHtml(customerCity)} — ${escapeHtml(customerAddress)}</p>
        <p><strong>Pagamento:</strong> ${escapeHtml(paymentLabel)}</p>
        <ul>${itemsHtml}</ul>
        <p><strong>Total:</strong> ${formatMoney(order.total_amount)}</p>
        <p><strong>Observações:</strong> ${escapeHtml(order.notes || "-")}</p>
        <div class="inline-actions">
          <select data-order-status>
            ${["novo", "em_preparo", "enviado", "concluido", "cancelado"]
              .map((status) => `<option value="${status}" ${status === order.status ? "selected" : ""}>${humanStatus(status)}</option>`)
              .join("")}
          </select>
          <button type="button" data-save-status>Salvar status</button>
        </div>
      `;

      card.querySelector("[data-save-status]").addEventListener("click", async () => {
        const nextStatus = card.querySelector("[data-order-status]").value;
        await api("admin-orders", {
          method: "POST",
          body: JSON.stringify({ id: order.id, status: nextStatus }),
        });
        await loadOrders();
      });

      ordersListEl.appendChild(card);
    });
  }

  function renderDashboard() {
    if (!dashboard) {
      dashboardMetricsEl.innerHTML = '<p class="empty-message">Sem dados do dashboard.</p>';
      return;
    }
    const cards = [
      ["Pedidos totais", dashboard.orders],
      ["Pedidos novos", dashboard.new_orders],
      ["Clientes", dashboard.clients],
      ["Produtos ativos", dashboard.active_products],
      ["Produtos cadastrados", dashboard.products],
      ["Receita total", formatMoney(dashboard.revenue)],
    ];
    dashboardMetricsEl.innerHTML = cards.map(([label, value]) => `
      <article class="list-card metric-card">
        <div class="muted">${escapeHtml(String(label))}</div>
        <strong>${escapeHtml(String(value))}</strong>
      </article>
    `).join("");
  }

  function renderProducts() {
    const query = normalize(productSearchEl.value.trim());
    const filtered = products.filter((product) => {
      return !query
        || normalize(product.codigo).includes(query)
        || normalize(product.descricao).includes(query);
    });

    if (!filtered.length) {
      productsListEl.innerHTML = '<p class="empty-message">Nenhum produto encontrado.</p>';
      return;
    }

    productsListEl.innerHTML = "";
    filtered.forEach((product) => {
      const card = document.createElement("article");
      card.className = "list-card";
      card.innerHTML = `
        <div class="section-head">
          <div>
            <strong>${escapeHtml(product.descricao)}</strong>
            <div class="muted">Código ${escapeHtml(product.codigo)} • ${formatMoney(product.custo_unit)}</div>
          </div>
          <span class="status ${product.ativo ? "status-concluido" : "status-cancelado"}">${product.ativo ? "Ativo" : "Inativo"}</span>
        </div>
        <div class="muted">Categoria: ${escapeHtml(product.categoria)} • Saldo: ${escapeHtml(product.saldo || "-")} • Total: ${escapeHtml(product.total || "-")}</div>
        <div class="inline-actions">
          <button type="button" data-edit>Editar</button>
          <button type="button" class="danger-btn" data-delete>Excluir</button>
        </div>
      `;

      card.querySelector("[data-edit]").addEventListener("click", () => {
        fillProductForm(product);
        setProductFeedback("Produto carregado para edição.");
      });

      card.querySelector("[data-delete]").addEventListener("click", async () => {
        if (!window.confirm("Deseja excluir este produto?")) {
          return;
        }
        await api(`products?id=${product.id}`, { method: "DELETE" });
        setProductFeedback("Produto removido com sucesso.");
        await loadProducts();
      });

      productsListEl.appendChild(card);
    });
  }

  function renderClients() {
    const query = normalize(clientSearchEl.value.trim());
    const filtered = clients.filter((client) => {
      if (!query) return true;
      return normalize(client.name).includes(query)
        || normalize(client.email).includes(query)
        || normalize(client.phone).includes(query)
        || normalize(client.cpf).includes(query);
    });

    if (!filtered.length) {
      clientsListEl.innerHTML = '<p class="empty-message">Nenhum cliente encontrado.</p>';
      return;
    }

    clientsListEl.innerHTML = "";
    filtered.forEach((client) => {
      const card = document.createElement("article");
      card.className = "list-card";
      card.innerHTML = `
        <div class="section-head">
          <strong>${escapeHtml(client.name)}</strong>
          <span class="status status-concluido">${client.orders_count} pedido(s)</span>
        </div>
        <div class="muted">${escapeHtml(client.email)} • ${escapeHtml(client.phone || "-")}</div>
        <div class="muted">CPF: ${escapeHtml(client.cpf || "-")}</div>
        <div class="muted">Endereço: ${escapeHtml(client.address || "-")}</div>
        <div><strong>Total comprado:</strong> ${formatMoney(client.total_spent)}</div>
      `;
      clientsListEl.appendChild(card);
    });
  }

  function renderSalesReport() {
    const cities = salesReport && Array.isArray(salesReport.cities) ? salesReport.cities : [];
    const topProducts = salesReport && Array.isArray(salesReport.top_products) ? salesReport.top_products : [];

    if (!cities.length) {
      salesByCityListEl.innerHTML = '<p class="empty-message">Sem vendas registradas por cidade.</p>';
    } else {
      salesByCityListEl.innerHTML = "";
      cities.forEach((cityData) => {
        const card = document.createElement("article");
        card.className = "list-card";
        card.innerHTML = `
          <div class="section-head">
            <strong>${escapeHtml(cityData.city || "Não informada")}</strong>
            <span class="status status-concluido">${cityData.orders_count} pedido(s)</span>
          </div>
          <div class="muted">Itens vendidos: ${cityData.items_sold}</div>
          <div><strong>Faturamento:</strong> ${formatMoney(cityData.revenue)}</div>
        `;
        salesByCityListEl.appendChild(card);
      });
    }

    if (!topProducts.length) {
      topProductsListEl.innerHTML = '<p class="empty-message">Sem dados de produtos vendidos.</p>';
      return;
    }

    topProductsListEl.innerHTML = "";
    topProducts.forEach((product, index) => {
      const card = document.createElement("article");
      card.className = "list-card";
      card.innerHTML = `
        <div class="section-head">
          <strong>${index + 1}. ${escapeHtml(product.product_name || "Produto sem nome")}</strong>
          <span class="status status-concluido">${product.total_quantity} un.</span>
        </div>
        <div><strong>Faturamento:</strong> ${formatMoney(product.revenue)}</div>
      `;
      topProductsListEl.appendChild(card);
    });
  }

  function citiesToText(cities) {
    return (cities || []).map((city) => {
      const suffix = city.require_registration ? "|obrigatorio" : "";
      return `${city.name}${suffix}`;
    }).join("\n");
  }

  function parseCitiesText(value) {
    return String(value || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [namePart, flagPart] = line.split("|");
        const cityName = (namePart || "").trim();
        const flag = (flagPart || "").trim().toLowerCase();
        return {
          name: cityName,
          require_registration: flag === "obrigatorio",
        };
      })
      .filter((city) => city.name);
  }

  function findQuantityInLine(line) {
    const matches = String(line).match(/\d+(?:[.,]\d+)?/g);
    if (!matches || !matches.length) {
      return 0;
    }
    const last = matches[matches.length - 1].replace(",", ".");
    const value = Number(last);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  function tokenizeProductText(value) {
    return normalize(value)
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3);
  }

  function scoreDescriptionMatch(lineTokens, productTokens) {
    if (!lineTokens.length || !productTokens.length) {
      return 0;
    }
    const lineSet = new Set(lineTokens);
    let common = 0;
    productTokens.forEach((token) => {
      if (lineSet.has(token)) {
        common += 1;
      }
    });
    return common;
  }

  function inferEntriesFromNoteText(rawText) {
    const text = String(rawText || "");
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const picked = new Map();
    const productsWithTokens = products.map((product) => ({
      product,
      code: normalize(product.codigo),
      tokens: tokenizeProductText(`${product.descricao} ${product.codigo}`),
    }));

    lines.forEach((line) => {
      const normalizedLine = normalize(line);
      const quantity = findQuantityInLine(line);
      if (!quantity) {
        return;
      }

      let matchedProduct = null;
      const byCode = productsWithTokens.find((entry) => entry.code && normalizedLine.includes(entry.code));
      if (byCode) {
        matchedProduct = byCode.product;
      } else {
        const lineTokens = tokenizeProductText(line);
        let best = null;
        productsWithTokens.forEach((entry) => {
          const score = scoreDescriptionMatch(lineTokens, entry.tokens);
          if (score >= 2 && (!best || score > best.score)) {
            best = { score, product: entry.product };
          }
        });
        if (best) {
          matchedProduct = best.product;
        }
      }

      if (!matchedProduct) {
        return;
      }

      const prev = picked.get(matchedProduct.codigo) || 0;
      picked.set(matchedProduct.codigo, prev + quantity);
    });

    const rows = Array.from(picked.entries()).map(([code, quantity]) => `${code};${quantity}`);
    suggestedEntriesEl.value = rows.join("\n");
    if (!rows.length) {
      setStockEntryFeedback("Nenhum item foi identificado automaticamente. Você pode preencher manualmente.", true);
    } else {
      setStockEntryFeedback(`Foram sugeridos ${rows.length} item(ns). Revise antes de confirmar.`, false);
    }
  }

  function parseSuggestedEntries() {
    const lines = String(suggestedEntriesEl.value || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    const items = [];
    lines.forEach((line) => {
      const [rawCode, rawQty] = line.split(";");
      const code = (rawCode || "").trim();
      const qtyValue = Number(String(rawQty || "0").replace(",", "."));
      if (!code || !Number.isFinite(qtyValue) || qtyValue <= 0) {
        return;
      }
      const product = products.find((entry) => normalize(entry.codigo) === normalize(code));
      if (!product) {
        return;
      }
      items.push({
        product_id: product.id,
        quantity: qtyValue,
      });
    });
    return items;
  }

  async function loadSession() {
    const data = await api("me");
    currentUser = data.user;
    if (!currentUser || !currentUser.is_admin) {
      window.location.href = "./login.html";
      return false;
    }
    adminUserEl.textContent = `${currentUser.name} (${currentUser.email})`;
    return true;
  }

  async function loadDashboard() {
    const data = await api("admin-dashboard");
    dashboard = data.dashboard;
    renderDashboard();
  }

  async function loadOrders() {
    const suffix = statusFilterEl.value ? `?status=${encodeURIComponent(statusFilterEl.value)}` : "";
    const data = await api(`admin-orders${suffix}`);
    renderOrders(data.orders);
  }

  async function loadProducts() {
    const data = await api("products");
    products = data.products;
    renderProducts();
  }

  async function loadClients() {
    const q = clientSearchEl.value.trim();
    const suffix = q ? `?q=${encodeURIComponent(q)}` : "";
    const data = await api(`admin-clients${suffix}`);
    clients = data.clients;
    renderClients();
  }

  async function loadSalesReport() {
    const data = await api("admin-sales-report");
    salesReport = data.report;
    renderSalesReport();
  }

  async function loadSettings() {
    const data = await api("store-settings");
    const settings = data.settings;
    storeNameEl.value = settings.store_name || "";
    storePhoneEl.value = settings.phone || "";
    storeEmailEl.value = settings.email || "";
    defaultShippingEl.value = String(settings.default_shipping ?? "").replace(".", ",");
    citiesTextareaEl.value = citiesToText(settings.cities);
  }

  logoutBtnEl.addEventListener("click", async () => {
    await api("logout", { method: "POST", body: "{}" });
    window.location.href = "./login.html";
  });

  navButtons.forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });

  refreshDashboardBtnEl.addEventListener("click", () => loadDashboard().catch((error) => setProductFeedback(error.message, true)));

  statusFilterEl.addEventListener("change", () => loadOrders().catch((error) => setProductFeedback(error.message, true)));
  refreshOrdersBtnEl.addEventListener("click", () => loadOrders().catch((error) => setProductFeedback(error.message, true)));
  refreshProductsBtnEl.addEventListener("click", () => loadProducts().catch((error) => setProductFeedback(error.message, true)));
  refreshClientsBtnEl.addEventListener("click", () => loadClients().catch((error) => setProductFeedback(error.message, true)));
  refreshReportsBtnEl.addEventListener("click", () => loadSalesReport().catch((error) => setProductFeedback(error.message, true)));
  refreshSettingsBtnEl.addEventListener("click", () => loadSettings().catch((error) => setSettingsFeedback(error.message, true)));
  resetFormBtnEl.addEventListener("click", resetProductForm);
  productSearchEl.addEventListener("input", renderProducts);
  clientSearchEl.addEventListener("input", () => {
    loadClients().catch((error) => setProductFeedback(error.message, true));
  });

  productFormEl.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const payload = {
        id: Number(document.getElementById("productId").value || 0),
        codigo: document.getElementById("codigo").value.trim(),
        descricao: document.getElementById("descricao").value.trim(),
        custo_unit: document.getElementById("custo").value.trim(),
        saldo: document.getElementById("saldo").value.trim(),
        total: document.getElementById("total").value.trim(),
        image_url: document.getElementById("imageUrl").value.trim(),
        categoria: document.getElementById("categoria").value,
        ativo: document.getElementById("ativo").checked,
      };
      await api("products", { method: "POST", body: JSON.stringify(payload) });
      setProductFeedback("Produto salvo com sucesso.");
      resetProductForm();
      await loadProducts();
    } catch (error) {
      setProductFeedback(error.message, true);
    }
  });

  settingsFormEl.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const payload = {
        store_name: storeNameEl.value.trim(),
        phone: storePhoneEl.value.trim(),
        email: storeEmailEl.value.trim(),
        default_shipping: defaultShippingEl.value.trim(),
        cities: parseCitiesText(citiesTextareaEl.value),
      };
      await api("store-settings", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setSettingsFeedback("Configurações salvas com sucesso.");
      await loadSettings();
    } catch (error) {
      setSettingsFeedback(error.message, true);
    }
  });

  scanNoteBtnEl.addEventListener("click", async () => {
    try {
      setStockEntryFeedback("", false);
      const file = notePhotoInputEl.files && notePhotoInputEl.files[0];
      if (!file) {
        setStockEntryFeedback("Selecione ou tire uma foto da nota antes de ler.", true);
        return;
      }
      if (!window.Tesseract || typeof window.Tesseract.recognize !== "function") {
        setStockEntryFeedback("OCR indisponível no momento.", true);
        return;
      }
      setStockEntryFeedback("Lendo nota... isso pode levar alguns segundos.", false);
      const result = await window.Tesseract.recognize(file, "por");
      const text = result && result.data && result.data.text ? result.data.text : "";
      noteTextEl.value = text;
      inferEntriesFromNoteText(text);
    } catch (error) {
      setStockEntryFeedback(error.message || "Falha ao ler a nota.", true);
    }
  });

  saveStockEntryBtnEl.addEventListener("click", async () => {
    try {
      const items = parseSuggestedEntries();
      if (!items.length) {
        setStockEntryFeedback("Nenhum item válido para entrada. Use o formato CODIGO;QUANTIDADE.", true);
        return;
      }
      await api("admin-stock-entry", {
        method: "POST",
        body: JSON.stringify({
          source: "nota_foto",
          note_text: noteTextEl.value || "",
          items,
        }),
      });
      setStockEntryFeedback("Entrada de estoque concluída com sucesso.", false);
      await Promise.all([loadProducts(), loadSalesReport()]);
    } catch (error) {
      setStockEntryFeedback(error.message, true);
    }
  });

  loadSession()
    .then((isOk) => {
      if (!isOk) return null;
      switchTab("dashboard");
      return Promise.all([loadDashboard(), loadOrders(), loadProducts(), loadClients(), loadSalesReport(), loadSettings()]);
    })
    .catch(() => {
      window.location.href = "./login.html";
    });
})();
