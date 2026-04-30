(function () {
  const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const summaryEl = document.getElementById("orderSummary");
  const progressEl = document.getElementById("orderProgress");
  const whatsBtnEl = document.getElementById("whatsBtn");
  const historyBtnEl = document.getElementById("historyBtn");
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get("order");
  const API_BASE = "../api/index.php";

  function formatMoney(value) {
    return currency.format(Number(value) || 0);
  }

  function escapeHtml(text) {
    const d = document.createElement("div");
    d.textContent = text || "";
    return d.innerHTML;
  }

  function humanStatus(status) {
    const map = {
      novo: "Novo",
      em_preparo: "Em preparo",
      enviado: "Enviado",
      concluido: "Concluído",
      cancelado: "Cancelado",
    };
    return map[status] || status || "-";
  }

  function statusStepIndex(status) {
    const steps = ["novo", "em_preparo", "enviado", "concluido"];
    const idx = steps.indexOf(status);
    return idx >= 0 ? idx : 0;
  }

  async function loadStorePhone() {
    try {
      const response = await fetch(`${API_BASE}?endpoint=public-store-settings`, { credentials: "same-origin" });
      const data = await response.json();
      const rawPhone = String(data?.settings?.phone || "").replace(/\D/g, "");
      if (!rawPhone) return;
      const text = encodeURIComponent(`Olá! Quero acompanhar o pedido #${orderId}.`);
      whatsBtnEl.href = `https://wa.me/55${rawPhone}?text=${text}`;
    } catch {
      whatsBtnEl.href = "https://wa.me/";
    }
  }

  const raw = localStorage.getItem("casa_last_order");
  const order = raw ? JSON.parse(raw) : null;

  if (!order || String(order.id) !== String(orderId || "")) {
    summaryEl.innerHTML = '<p class="feedback error">Não foi possível carregar os detalhes deste pedido.</p>';
    return;
  }

  if (historyBtnEl) {
    historyBtnEl.href = `./compra.html?highlight_order=${encodeURIComponent(order.id)}#orders`;
  }

  const itemsHtml = (order.items || []).map((item) => `
    <li>${escapeHtml(item.product_name)} x${item.quantity} - ${formatMoney(item.line_total)}</li>
  `).join("");

  const stepNames = ["Novo", "Em preparo", "Enviado", "Concluído"];
  const currentStep = statusStepIndex(order.status);
  progressEl.innerHTML = `
    <div class="progress-track">
      ${stepNames.map((name, index) => `
        <div class="progress-step ${index <= currentStep ? "active" : ""}">
          ${name}
        </div>
      `).join("")}
    </div>
  `;

  summaryEl.innerHTML = `
    <article class="order-card">
      <div class="order-head">
        <strong>Pedido #${escapeHtml(String(order.id))}</strong>
        <span class="status-chip status-novo">${humanStatus(order.status)}</span>
      </div>
      <div class="muted">${new Date(order.created_at).toLocaleString("pt-BR")}</div>
      <div><strong>Subtotal:</strong> ${formatMoney(order.subtotal_amount ?? order.total_amount)}</div>
      <div><strong>Taxa de entrega:</strong> ${formatMoney(order.shipping_fee || 0)}</div>
      <div><strong>Total:</strong> ${formatMoney(order.total_amount)}</div>
      <div><strong>Pagamento:</strong> ${escapeHtml(order.payment_method)}</div>
      <div><strong>Cliente:</strong> ${escapeHtml(order.customer_name)} - ${escapeHtml(order.customer_phone)}</div>
      <div><strong>Entrega:</strong> ${escapeHtml(order.customer_city)} - ${escapeHtml(order.customer_address)}</div>
      <div><strong>Observações:</strong> ${escapeHtml(order.notes || "-")}</div>
      <ul>${itemsHtml}</ul>
    </article>
  `;

  loadStorePhone();
})();
