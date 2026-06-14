const STORAGE_KEY = "gestor-servicos-v1";
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });

const initialState = {
  priceTables: ["Tabela 01", "Tabela 02", "Tabela 03"],
  clients: [
    { id: crypto.randomUUID(), name: "Rodrigo", phone: "(00) 99999-0001", priceGroup: "Tabela 01" },
    { id: crypto.randomUUID(), name: "Davi", phone: "(00) 99999-0002", priceGroup: "Tabela 02" }
  ],
  catalog: [
    {
      id: crypto.randomUUID(),
      name: "Vistoria",
      prices: { "Tabela 01": 10, "Tabela 02": 20, "Tabela 03": 30 }
    }
  ],
  services: [],
  payments: [],
  paymentMethods: [
    { id: crypto.randomUUID(), type: "PIX", name: "PIX principal", details: "Cadastre sua chave PIX", link: "", active: true },
    { id: crypto.randomUUID(), type: "Dinheiro", name: "Pagamento em dinheiro", details: "Combine a entrega diretamente", link: "", active: true },
    { id: crypto.randomUUID(), type: "Cartão de crédito", name: "Cartão de crédito", details: "Link de pagamento será disponibilizado futuramente", link: "", active: false }
  ],
  billings: []
};

let state = loadState();
let deferredInstallPrompt;
let remoteReady = false;
let serviceReferenceValues = [];
let additionalServiceValues = [];
let entryContinuationResolver = null;

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return initialState;
  const parsed = JSON.parse(stored);
  return {
    ...initialState,
    ...parsed,
    priceTables: parsed.priceTables || initialState.priceTables,
    catalog: parsed.catalog || initialState.catalog,
    paymentMethods: parsed.paymentMethods || initialState.paymentMethods
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
  if (remoteReady && window.dataStore) {
    window.dataStore.scheduleSave(state, (error) => {
      console.error("Falha ao salvar no Supabase:", error.code, error.message);
      alert("Não foi possível sincronizar os dados com o banco.");
    });
  }
}

async function initializeRemoteState() {
  if (!window.dataStore || remoteReady) return;
  try {
    const remoteState = await window.dataStore.fetchAll();
    const hasRemoteData = remoteState.priceTables.length
      || remoteState.clients.length
      || remoteState.catalog.length;

    if (hasRemoteData) {
      state = remoteState;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } else {
      await window.dataStore.upsertState(state);
    }

    remoteReady = true;
    render();
  } catch (error) {
    console.error("Falha ao carregar dados do Supabase:", error.code, error.message);
    alert("O login funcionou, mas os dados online não puderam ser carregados.");
  }
}

function clientById(id) {
  return state.clients.find((client) => client.id === id);
}

function balanceFor(clientId, endDate = null) {
  const allowed = (item) => item.clientId === clientId && (!endDate || item.date <= endDate);
  const debits = state.services.filter((item) => allowed(item) && item.status !== "Cancelado")
    .reduce((sum, item) => sum + item.amount, 0);
  const credits = state.payments.filter(allowed).reduce((sum, item) => sum + item.amount, 0);
  return debits - credits;
}

function serviceStatusLabel(status) {
  return status === "Pronto" ? "Feito" : status;
}

function randomDeliveryCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function deliveryConfirmationMessage(item) {
  const client = clientById(item.clientId);
  return `Olá, ${client?.name || ""}. O serviço "${item.description}"${item.reference ? ` (${item.reference})` : ""} foi concluído. Para confirmar o recebimento, responda: RECEBIDO ${item.deliveryCode}`;
}

function serviceAgeHours(item) {
  const startedAt = item.createdAt || `${item.date}T00:00:00`;
  const timestamp = new Date(startedAt).getTime();
  return Number.isFinite(timestamp) ? Math.max(0, (Date.now() - timestamp) / 3600000) : 0;
}

function isOverdueService(item) {
  return item.status === "A fazer" && serviceAgeHours(item) >= 24;
}

function formatServiceAge(item) {
  const hours = Math.floor(serviceAgeHours(item));
  if (hours < 24) return `${hours}h aguardando`;
  const days = Math.floor(hours / 24);
  return `${days} dia${days === 1 ? "" : "s"} aguardando`;
}

function paymentWasAfterBilling(payment, billing) {
  if (payment.billingId !== billing.id) return false;
  const paymentCreated = new Date(payment.createdAt || `${payment.date}T23:59:59`).getTime();
  const billingCreated = new Date(billing.createdAt).getTime();
  return paymentCreated > billingCreated;
}

function billingPaidAmount(billing) {
  return state.payments
    .filter((payment) => paymentWasAfterBilling(payment, billing))
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
}

function billingOpenAmount(billing) {
  return Math.max(0, Number(billing.amount) - billingPaidAmount(billing));
}

function billingCurrentStatus(billing) {
  if (billing.status === "Cancelada") return "Cancelada";
  const paid = billingPaidAmount(billing);
  if (paid <= 0) return "Aberta";
  return billingOpenAmount(billing) <= 0 ? "Paga" : "Parcial";
}

function billingAgeDays(billing) {
  return Math.max(0, Math.floor((Date.now() - new Date(billing.createdAt).getTime()) / 86400000));
}

function recentDateKeys(days) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (days - index - 1));
    return date.toISOString().slice(0, 10);
  });
}

function updateBillingStatuses() {
  state.billings.forEach((billing) => {
    if (billing.status !== "Cancelada") billing.status = billingCurrentStatus(billing);
  });
}

function currentBillings() {
  const latestByClient = new Map();
  [...state.billings]
    .filter((billing) => billing.status !== "Cancelada")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .forEach((billing) => {
      if (!latestByClient.has(billing.clientId)) latestByClient.set(billing.clientId, billing);
    });
  return [...latestByClient.values()];
}

function dashboardNotifications() {
  const overdueServices = state.services
    .filter(isOverdueService)
    .sort((a, b) => serviceAgeHours(b) - serviceAgeHours(a));
  const overdueBillings = currentBillings()
    .filter((billing) => billingOpenAmount(billing) > 0 && billingAgeDays(billing) >= 7)
    .sort((a, b) => billingAgeDays(b) - billingAgeDays(a));
  return { overdueServices, overdueBillings };
}

function showView(viewId) {
  document.querySelectorAll(".view, .tab").forEach((element) => element.classList.remove("active"));
  document.getElementById(viewId).classList.add("active");
  document.querySelector(`[data-view="${viewId}"]`).classList.add("active");
}

function emptyMarkup() {
  return document.getElementById("emptyTemplate").innerHTML;
}

function searchableText(...values) {
  return values.join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function matchesSearch(search, ...values) {
  return !search || searchableText(...values).includes(searchableText(search));
}

function clientOptionLabel(client) {
  return client?.name || "";
}

function catalogOptionLabel(item) {
  return item?.code ? `${item.code} - ${item.name}` : item?.name || "";
}

function itemByExactLabel(items, value, labelBuilder) {
  const normalized = searchableText(value);
  return items.find((item) => searchableText(labelBuilder(item)) === normalized)
    || items.find((item) => searchableText(item.name) === normalized)
    || items.find((item) => item.code && searchableText(item.code) === normalized);
}

function uniqueClientMatch(value) {
  const exact = itemByExactLabel(state.clients, value, clientOptionLabel);
  if (exact) return exact;
  const matches = state.clients.filter((client) => matchesSearch(value, client.name));
  return matches.length === 1 ? matches[0] : null;
}

function formatDate(value) {
  return value ? value.split("-").reverse().join("/") : "-";
}

function renderSelects() {
  const options = state.clients.map((client) => `<option value="${client.id}">${escapeHtml(client.name)}</option>`).join("");
  document.querySelectorAll('select[name="clientId"]').forEach((select) => {
    const current = select.value;
    select.innerHTML = `<option value="">Selecione</option>${options}`;
    select.value = current;
  });
  ["paymentClientFilter", "billingClientFilter"].forEach((id) => {
    const filter = document.getElementById(id);
    const currentFilter = filter.value;
    filter.innerHTML = `<option value="">Todos os clientes</option>${options}`;
    filter.value = currentFilter;
  });

  const clientDatalistOptions = [...state.clients]
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .map((client) => `<option value="${escapeHtml(clientOptionLabel(client))}"></option>`)
    .join("");
  document.getElementById("serviceClientOptions").innerHTML = clientDatalistOptions;
  document.getElementById("serviceClientFilterOptions").innerHTML = clientDatalistOptions;
  document.getElementById("serviceCatalogOptions").innerHTML = [...state.catalog]
    .sort((a, b) => (Number(a.code) || 999999) - (Number(b.code) || 999999)
      || a.name.localeCompare(b.name, "pt-BR"))
    .map((item) => `<option value="${escapeHtml(catalogOptionLabel(item))}"></option>`)
    .join("");

  const priceGroupSelect = document.querySelector('#clientForm select[name="priceGroup"]');
  const selectedPriceGroup = priceGroupSelect.value;
  priceGroupSelect.innerHTML = `<option value="">Selecione</option>${state.priceTables
    .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
    .join("")}`;
  priceGroupSelect.value = selectedPriceGroup;

  const paymentMethodSelect = document.querySelector('#paymentForm select[name="method"]');
  const selectedPaymentMethod = paymentMethodSelect.value;
  paymentMethodSelect.innerHTML = `<option value="">Não informada</option>${state.paymentMethods
    .filter((method) => method.active)
    .map((method) => `<option value="${escapeHtml(method.name)}">${escapeHtml(method.name)}</option>`)
    .join("")}`;
  paymentMethodSelect.value = selectedPaymentMethod;
}

function renderCatalog() {
  const target = document.getElementById("catalogTable");
  const search = document.getElementById("catalogSearch").value.trim();
  const items = state.catalog.filter((item) => matchesSearch(search, item.code, item.name));
  const header = state.priceTables.map((name) => `<th>${escapeHtml(name)}</th>`).join("");
  const rows = items.length ? items
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .map((item) => `
      <tr>
        <td><strong>${item.code ? `${escapeHtml(item.code)} - ` : ""}${escapeHtml(item.name)}</strong></td>
        ${state.priceTables.map((name) => `<td>${money.format(item.prices[name] || 0)}</td>`).join("")}
        <td><div class="row-actions">
          <button class="table-action" data-edit-catalog="${item.id}">Editar</button>
          <button class="table-action danger" data-delete-catalog="${item.id}">Excluir</button>
        </div></td>
      </tr>`)
    .join("") : `<tr><td colspan="${state.priceTables.length + 2}">${emptyMarkup()}</td></tr>`;
  target.innerHTML = `<div class="catalog-table-wrap"><table class="catalog-table">
    <thead><tr><th>Serviço</th>${header}<th>Ações</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function renderPriceTables() {
  const target = document.getElementById("priceTableList");
  const search = document.getElementById("priceTableSearch").value.trim();
  const items = state.priceTables.filter((name) => matchesSearch(search, name));
  target.innerHTML = items.length ? items.map((name) => {
    const clients = state.clients.filter((client) => client.priceGroup === name).length;
    return `<article class="price-table-card">
      <h3>${escapeHtml(name)}</h3>
      <p class="meta">${clients} cliente(s) usando esta tabela</p>
      <div class="card-actions">
        <button class="table-action" data-edit-table="${escapeHtml(name)}">Editar</button>
        <button class="table-action danger" data-delete-table="${escapeHtml(name)}">Excluir</button>
      </div>
    </article>`;
  }).join("") : emptyMarkup();
}

function renderDashboard() {
  const serviceTotal = state.services.filter((item) => item.status !== "Cancelado")
    .reduce((sum, item) => sum + item.amount, 0);
  const paymentTotal = state.payments.reduce((sum, item) => sum + item.amount, 0);
  document.getElementById("totalOpen").textContent = money.format(serviceTotal - paymentTotal);
  document.getElementById("clientCount").textContent = state.clients.length;
  document.getElementById("serviceTotal").textContent = money.format(serviceTotal);
  document.getElementById("paymentTotal").textContent = money.format(paymentTotal);
  const pending = state.services.filter((item) => item.status === "A fazer");
  const overdue = pending.filter(isOverdueService);
  const alertPanel = document.getElementById("serviceAlertPanel");
  alertPanel.classList.toggle("has-alerts", overdue.length > 0);
  alertPanel.innerHTML = `
    <div class="panel-title">
      <div><span class="eyebrow">Alertas operacionais</span><h2>Serviços pendentes</h2></div>
      <button class="table-action" data-open-view="services">Ver lançamentos</button>
    </div>
    <div class="alert-summary">
      <article><span>A fazer</span><strong>${pending.length}</strong></article>
      <article class="${overdue.length ? "alert-danger" : ""}"><span>Acima de 24h</span><strong>${overdue.length}</strong></article>
    </div>
    ${overdue.length ? `<div class="alert-list">${overdue.slice(0, 5).map((item) => `
      <div><strong>${escapeHtml(clientById(item.clientId)?.name || "")}: ${escapeHtml(item.description)}</strong><span>${escapeHtml(item.reference || "Sem referência")} · ${formatServiceAge(item)}</span></div>`).join("")}</div>` : `<p class="meta">Nenhum serviço ultrapassou 24 horas.</p>`}`;

  const billings = currentBillings().map((billing) => ({
    ...billing,
    openAmount: billingOpenAmount(billing),
    ageDays: billingAgeDays(billing),
    currentStatus: billingCurrentStatus(billing)
  }));
  const openBillings = billings.filter((billing) => billing.openAmount > 0);
  const overdueBillings = openBillings.filter((billing) => billing.ageDays >= 7);
  const openTotal = openBillings.reduce((sum, billing) => sum + billing.openAmount, 0);
  const overdueTotal = overdueBillings.reduce((sum, billing) => sum + billing.openAmount, 0);
  const billingAlertPanel = document.getElementById("billingAlertPanel");
  billingAlertPanel.classList.toggle("has-alerts", overdueBillings.length > 0);
  billingAlertPanel.innerHTML = `
    <div class="panel-title">
      <div><span class="eyebrow">Alertas financeiros</span><h2>Cobranças em aberto</h2></div>
      <button class="table-action" data-payment-dashboard-filter="open">Ver pagamentos</button>
    </div>
    <div class="alert-summary finance-alert-summary">
      <article><span>Em aberto</span><strong>${money.format(openTotal)}</strong><small>${openBillings.length} cliente(s)</small></article>
      <article class="${overdueBillings.length ? "alert-danger" : ""}"><span>Há 7 dias ou mais</span><strong>${money.format(overdueTotal)}</strong><small>${overdueBillings.length} cobrança(s)</small></article>
    </div>
    ${overdueBillings.length ? `<div class="alert-list">${overdueBillings.slice(0, 5).map((billing) => `
      <div><strong>${escapeHtml(clientById(billing.clientId)?.name || "")}</strong><span>${money.format(billing.openAmount)} · ${billing.ageDays} dias em aberto</span></div>`).join("")}</div>
      <button class="table-action alert-link" data-payment-dashboard-filter="overdue">Ver todas as atrasadas</button>`
    : `<p class="meta">Nenhuma cobrança está aberta há 7 dias ou mais.</p>`}`;

  const dateKeys = recentDateKeys(7);
  const dailyPayments = dateKeys.map((date) => ({
    date,
    amount: state.payments
      .filter((payment) => payment.date === date)
      .reduce((sum, payment) => sum + Number(payment.amount), 0)
  }));
  const recentTotal = dailyPayments.reduce((sum, day) => sum + day.amount, 0);
  const dailyMaximum = Math.max(...dailyPayments.map((day) => day.amount), 1);
  document.getElementById("recentPaymentTotal").textContent = money.format(recentTotal);
  document.getElementById("paymentChart").innerHTML = dailyPayments.map((day) => {
    const height = day.amount ? Math.max(8, Math.round((day.amount / dailyMaximum) * 100)) : 2;
    const label = new Intl.DateTimeFormat("pt-BR", { weekday: "short" })
      .format(new Date(`${day.date}T12:00:00`))
      .replace(".", "");
    return `<div class="bar-column" title="${formatDate(day.date)}: ${money.format(day.amount)}">
      <span>${day.amount ? money.format(day.amount) : "—"}</span>
      <div class="bar-track"><i style="height:${height}%"></i></div>
      <strong>${label}</strong>
    </div>`;
  }).join("");

  const paidCount = billings.filter((billing) => billing.currentStatus === "Paga").length;
  const partialCount = billings.filter((billing) => billing.currentStatus === "Parcial").length;
  const openCount = billings.filter((billing) => billing.currentStatus === "Aberta").length;
  const billingCount = paidCount + partialCount + openCount;
  const paidDegrees = billingCount ? (paidCount / billingCount) * 360 : 0;
  const partialDegrees = billingCount ? (partialCount / billingCount) * 360 : 0;
  document.getElementById("billingStatusChart").innerHTML = `
    <div class="donut-chart" style="--paid:${paidDegrees}deg;--partial:${paidDegrees + partialDegrees}deg">
      <div><strong>${billingCount}</strong><span>cobranças</span></div>
    </div>
    <div class="chart-legend">
      <button data-payment-dashboard-filter="paid"><i class="legend-paid"></i><span>Pagas</span><strong>${paidCount}</strong></button>
      <button data-payment-dashboard-filter="open"><i class="legend-partial"></i><span>Parciais</span><strong>${partialCount}</strong></button>
      <button data-payment-dashboard-filter="open"><i class="legend-open"></i><span>Em aberto</span><strong>${openCount}</strong></button>
    </div>`;
  const list = document.getElementById("accountList");
  list.innerHTML = state.clients.length ? state.clients.map((client) => {
    const balance = balanceFor(client.id);
    const count = state.services.filter((item) => item.clientId === client.id).length;
    return `<div class="account-row">
      <div><strong>${escapeHtml(client.name)}</strong><span class="meta">${escapeHtml(client.priceGroup)}</span></div>
      <span class="meta">${count} serviço(s)</span>
      <strong class="amount ${balance < 0 ? "negative" : ""}">${money.format(balance)}</strong>
    </div>`;
  }).join("") : emptyMarkup();
}

function renderNotifications() {
  const { overdueServices, overdueBillings } = dashboardNotifications();
  const alertCount = overdueServices.length + overdueBillings.length;
  const today = new Date().toISOString().slice(0, 10);
  const receivedToday = state.payments
    .filter((payment) => payment.date === today)
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const openTotal = currentBillings()
    .reduce((sum, billing) => sum + billingOpenAmount(billing), 0);
  const count = document.getElementById("notificationCount");
  count.textContent = alertCount > 99 ? "99+" : String(alertCount);
  count.classList.toggle("hidden", alertCount === 0);
  document.getElementById("notificationButton").classList.toggle("has-alerts", alertCount > 0);
  document.getElementById("notificationDailySummary").innerHTML = `
    <article><span>Recebido hoje</span><strong>${money.format(receivedToday)}</strong></article>
    <article><span>Total em aberto</span><strong>${money.format(openTotal)}</strong></article>`;

  const items = [
    ...overdueServices.map((service) => ({
      type: "service",
      title: `${clientById(service.clientId)?.name || "Cliente"}: ${service.description}`,
      detail: `${formatServiceAge(service)} · ${service.reference || "Sem referência"}`
    })),
    ...overdueBillings.map((billing) => ({
      type: "billing",
      title: `Cobrança de ${clientById(billing.clientId)?.name || "Cliente"}`,
      detail: `${money.format(billingOpenAmount(billing))} · ${billingAgeDays(billing)} dias em aberto`
    }))
  ];
  document.getElementById("notificationList").innerHTML = items.length ? items.map((item) => `
    <button class="notification-item notification-${item.type}" data-notification-target="${item.type}">
      <i></i>
      <span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small></span>
      <b>Ver</b>
    </button>`).join("") : `
    <div class="notification-empty">
      <strong>Tudo em dia.</strong>
      <span>Não há serviços acima de 24 horas nem cobranças atrasadas.</span>
    </div>`;
}

function renderClients() {
  const target = document.getElementById("clientList");
  const search = document.getElementById("clientSearch").value.trim();
  const items = state.clients.filter((client) =>
    matchesSearch(search, client.name, client.phone, client.priceGroup));
  target.innerHTML = items.length ? items.map((client) => `
    <article class="client-card">
      <h3>${escapeHtml(client.name)}</h3>
      <p class="meta">${escapeHtml(client.phone)}</p>
      <span class="badge">${escapeHtml(client.priceGroup)}</span>
      <div class="access-box">Saldo atual: ${money.format(balanceFor(client.id))}</div>
      <div class="card-actions">
        <button class="table-action" data-edit-client="${client.id}">Editar</button>
        <button class="table-action danger" data-delete-client="${client.id}">Excluir</button>
      </div>
    </article>`).join("") : emptyMarkup();
}

function renderServices() {
  const clientFilter = document.getElementById("serviceClientFilter").value;
  const clientNameFilter = document.getElementById("serviceClientNameFilter").value.trim();
  const statusFilter = document.getElementById("serviceStatusFilter").value;
  const search = document.getElementById("serviceSearch").value.trim();
  const items = state.services
    .filter((item) => !clientFilter || item.clientId === clientFilter)
    .filter((item) => !clientNameFilter || matchesSearch(clientNameFilter, clientById(item.clientId)?.name))
    .filter((item) => !statusFilter || item.status === statusFilter)
    .filter((item) => matchesSearch(
      search,
      item.description,
      item.reference,
      clientById(item.clientId)?.name,
      serviceStatusLabel(item.status)
    ))
    .sort((a, b) => {
      const statusOrder = { "A fazer": 0, Pronto: 1, Entregue: 2, Cancelado: 3 };
      const statusDifference = (statusOrder[a.status] ?? 4) - (statusOrder[b.status] ?? 4);
      return statusDifference || b.date.localeCompare(a.date)
        || String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    });
  document.getElementById("serviceList").innerHTML = items.length ? items.map((item) => `
    <article class="timeline-item ${isOverdueService(item) ? "service-overdue" : ""} ${item.isSecondary ? "secondary-service" : ""}">
      <time>${dateFormat.format(new Date(`${item.date}T00:00:00Z`))}</time>
      <div><h3>${escapeHtml(item.description)}</h3><p class="meta">${escapeHtml(clientById(item.clientId)?.name || "")} · ${escapeHtml(item.reference || "Sem referência")}</p><span class="status status-${item.status.toLowerCase().replace(" ", "-")}">${escapeHtml(serviceStatusLabel(item.status))}</span>${item.isSecondary ? `<span class="secondary-service-label">Serviço complementar</span>` : ""}${isOverdueService(item) ? `<span class="overdue-label">${formatServiceAge(item)}</span>` : ""}${item.confirmationRequestedAt && item.status === "Pronto" ? `<span class="confirmation-label">Confirmação solicitada</span>` : ""}${item.deliveredAt ? `<span class="delivered-label">Confirmado pelo cliente</span>` : ""}</div>
      <strong>${money.format(item.amount)}</strong>
      <div class="service-actions">
        <div class="status-actions">
          ${item.status === "A fazer" ? `<button class="table-action success" data-service-status="Pronto" data-entry-id="${item.id}">Marcar feito</button>` : ""}
          ${item.status === "Pronto" ? `<button class="table-action" data-request-delivery="${item.id}">Solicitar confirmação</button>` : ""}
          ${item.status === "Pronto" ? `<button class="table-action success" data-service-status="Entregue" data-entry-id="${item.id}">Marcar entregue</button>` : ""}
        </div>
        <div class="row-actions"><button class="table-action" data-edit-entry="${item.id}">Editar</button><button class="table-action danger" data-delete-entry="${item.id}">Excluir</button></div>
      </div>
    </article>`).join("") : emptyMarkup();
}

function renderPayments() {
  const clientFilter = document.getElementById("paymentClientFilter").value;
  const statusFilter = document.getElementById("paymentStatusFilter").value;
  const startFilter = document.getElementById("paymentStartFilter").value;
  const endFilter = document.getElementById("paymentEndFilter").value;
  const search = document.getElementById("paymentSearch").value.trim();
  const billings = currentBillings()
    .map((billing) => ({
      ...billing,
      currentStatus: billingCurrentStatus(billing),
      paidAmount: billingPaidAmount(billing),
      openAmount: billingOpenAmount(billing),
      ageDays: billingAgeDays(billing)
    }))
    .filter((billing) => !clientFilter || billing.clientId === clientFilter)
    .filter((billing) => !startFilter || billing.endDate >= startFilter)
    .filter((billing) => !endFilter || billing.endDate <= endFilter)
    .filter((billing) => {
      if (!statusFilter) return true;
      if (statusFilter === "open") return billing.openAmount > 0 && billing.currentStatus !== "Cancelada";
      if (statusFilter === "overdue") return billing.openAmount > 0 && billing.ageDays >= 7;
      if (statusFilter === "paid") return billing.currentStatus === "Paga";
      return true;
    })
    .filter((billing) => matchesSearch(
      search,
      clientById(billing.clientId)?.name,
      billing.currentStatus,
      billing.identifier
    ))
    .sort((a, b) => b.endDate.localeCompare(a.endDate));

  const allActiveBillings = currentBillings();
  const totalOpen = allActiveBillings.reduce((sum, billing) => sum + billingOpenAmount(billing), 0);
  const overdueTotal = allActiveBillings
    .filter((billing) => billingOpenAmount(billing) > 0 && billingAgeDays(billing) >= 7)
    .reduce((sum, billing) => sum + billingOpenAmount(billing), 0);
  const receivedTotal = state.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  document.getElementById("paymentSummary").innerHTML = `
    <article class="metric-card metric-main"><span>Total em aberto</span><strong>${money.format(totalOpen)}</strong><small>${allActiveBillings.filter((billing) => billingOpenAmount(billing) > 0).length} cobrança(s)</small></article>
    <article class="metric-card"><span>Atrasado há 7 dias</span><strong>${money.format(overdueTotal)}</strong><small>Requer atenção</small></article>
    <article class="metric-card"><span>Total recebido</span><strong>${money.format(receivedTotal)}</strong><small>Histórico acumulado</small></article>`;

  document.getElementById("openBillingList").innerHTML = billings.length ? billings.map((billing) => `
    <article class="receivable-card ${billing.ageDays >= 7 && billing.openAmount > 0 ? "receivable-overdue" : ""}">
      <div class="receivable-heading">
        <div><span class="eyebrow">${formatDate(billing.startDate)} a ${formatDate(billing.endDate)}</span><h3>${escapeHtml(clientById(billing.clientId)?.name || "")}</h3></div>
        <span class="billing-status billing-${billing.currentStatus.toLowerCase()}">${billing.currentStatus}</span>
      </div>
      <div class="receivable-values">
        <span>Valor original<strong>${money.format(billing.amount)}</strong></span>
        <span>Pago depois da cobrança<strong>${money.format(billing.paidAmount)}</strong></span>
        <span>Saldo em aberto<strong>${money.format(billing.openAmount)}</strong></span>
      </div>
      ${billing.openAmount > 0 && billing.currentStatus !== "Cancelada" ? `
        <div class="receivable-actions">
          <button class="table-action" data-pay-billing="${billing.id}" data-payment-mode="partial">Baixa parcial</button>
          <button class="table-action success" data-pay-billing="${billing.id}" data-payment-mode="full">Quitar ${money.format(billing.openAmount)}</button>
        </div>` : ""}
      ${billing.ageDays >= 7 && billing.openAmount > 0 ? `<p class="overdue-message">Cobrança aberta há ${billing.ageDays} dias.</p>` : ""}
    </article>`).join("") : emptyMarkup();

  const items = state.payments
    .filter((item) => !clientFilter || item.clientId === clientFilter)
    .filter((item) => !startFilter || item.date >= startFilter)
    .filter((item) => !endFilter || item.date <= endFilter)
    .filter((item) => matchesSearch(search, clientById(item.clientId)?.name, item.note))
    .sort((a, b) => b.date.localeCompare(a.date));
  document.getElementById("paymentList").innerHTML = items.length ? items.map((item) => `
    <article class="timeline-item">
      <time>${dateFormat.format(new Date(`${item.date}T00:00:00Z`))}</time>
      <div><h3>${escapeHtml(clientById(item.clientId)?.name || "")}</h3><p class="meta">${escapeHtml(item.note || "Pagamento registrado")}</p><span class="payment-origin">${escapeHtml(item.method || "Forma não informada")} · ${escapeHtml(item.paymentSource || "Manual")}</span></div>
      <strong>${money.format(item.amount)}</strong>
      <div class="row-actions"><button class="table-action" data-edit-payment="${item.id}">Editar</button><button class="table-action danger" data-delete-payment="${item.id}">Excluir</button></div>
    </article>`).join("") : emptyMarkup();
}

function renderPaymentMethods() {
  const target = document.getElementById("paymentMethodList");
  const search = document.getElementById("paymentMethodSearch").value.trim();
  const statusFilter = document.getElementById("paymentMethodStatusFilter").value;
  const items = state.paymentMethods
    .filter((method) => !statusFilter || (statusFilter === "active" ? method.active : !method.active))
    .filter((method) => matchesSearch(search, method.type, method.name, method.details, method.link));
  target.innerHTML = items.length ? items.map((method) => `
    <article class="payment-method-card">
      <span class="method-type">${escapeHtml(method.type)}</span>
      <h3>${escapeHtml(method.name)}</h3>
      <p class="meta">${escapeHtml(method.details || "Sem instruções cadastradas")}</p>
      ${method.link ? `<p class="meta">${escapeHtml(method.link)}</p>` : ""}
      <span class="badge">${method.active ? "Ativa" : "Inativa"}</span>
      <div class="card-actions">
        <button class="table-action" data-edit-method="${method.id}">Editar</button>
        <button class="table-action danger" data-delete-method="${method.id}">Excluir</button>
      </div>
    </article>`).join("") : emptyMarkup();
}

function renderBillings() {
  const clientFilter = document.getElementById("billingClientFilter").value;
  const search = document.getElementById("billingSearch").value.trim();
  const accessBillingByClient = new Map();
  state.billings
    .filter((billing) => billing.status !== "Cancelada")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .forEach((billing) => accessBillingByClient.set(billing.clientId, billing.id));
  const items = state.billings
    .filter((item) => !clientFilter || item.clientId === clientFilter)
    .filter((item) => matchesSearch(
      search,
      clientById(item.clientId)?.name,
      item.identifier,
      item.status,
      item.startDate,
      item.endDate
    ))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  document.getElementById("billingList").innerHTML = items.length ? items.map((item) => `
    <article class="billing-card">
      <span class="eyebrow">${item.startDate.split("-").reverse().join("/")} a ${item.endDate.split("-").reverse().join("/")}</span>
      <h3>${escapeHtml(clientById(item.clientId)?.name || "")}</h3>
      <p class="meta">${billingCurrentStatus(item)} · Saldo em aberto</p>
      <strong class="hero-value" style="font-size:30px">${money.format(billingOpenAmount(item))}</strong>
      <p class="billing-history">${item.sendHistory?.length
        ? `Último envio: ${new Date(item.sendHistory[item.sendHistory.length - 1].sentAt).toLocaleString("pt-BR")}`
        : "Ainda não enviada pelo sistema"}</p>
      <p class="meta">Histórico no portal: <strong>${item.historyEnabled ? "Liberado" : "Bloqueado"}</strong></p>
      <div class="access-box">${item.identifier
        ? `<div class="access-data">
            <span><small>ID</small><strong>${escapeHtml(item.identifier)}</strong></span>
            <button type="button" data-copy-access="identifier" data-billing-id="${item.id}">Copiar ID</button>
          </div>
          ${item.password
            ? `<div class="access-data">
                <span><small>Senha</small><strong>${escapeHtml(item.password)}</strong></span>
                <button type="button" data-copy-access="password" data-billing-id="${item.id}">Copiar senha</button>
              </div>`
            : `<span class="access-note">Senha exibida somente ao gerar o acesso.</span>`}`
        : "Acesso do cliente ainda não gerado."}</div>
      <div class="card-actions">
        <button class="table-action" data-view-report="${item.id}">Ver relatório</button>
        <button class="table-action whatsapp-action" data-share-whatsapp="${item.id}">WhatsApp</button>
        <button class="table-action" data-share-report="${item.id}">Compartilhar relatório</button>
        <button class="table-action" data-renew-access="${item.id}">Gerar novo acesso</button>
        ${item.identifier && accessBillingByClient.get(item.clientId) === item.id
          ? `<button class="table-action" data-toggle-history="${item.id}">${item.historyEnabled ? "Bloquear histórico" : "Liberar histórico"}</button>`
          : ""}
        ${billingCurrentStatus(item) === "Aberta" ? `<button class="table-action danger" data-cancel-billing="${item.id}">Cancelar</button>` : ""}
      </div>
    </article>`).join("") : emptyMarkup();
}

async function copyText(value, label) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const field = document.createElement("textarea");
    field.value = value;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    document.execCommand("copy");
    field.remove();
  }
  alert(`${label} copiado.`);
}

function render() {
  renderSelects();
  renderDashboard();
  renderNotifications();
  renderClients();
  renderPriceTables();
  renderCatalog();
  renderServices();
  renderPayments();
  renderPaymentMethods();
  renderBillings();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[character]);
}

function setDefaultDates() {
  const today = new Date().toISOString().slice(0, 10);
  document.querySelectorAll('input[type="date"]').forEach((input) => {
    if (!input.value) input.value = today;
  });
}

function renderBillingPaymentMethods() {
  const target = document.getElementById("billingPaymentMethods");
  const activeMethods = state.paymentMethods.filter((method) => method.active);
  target.innerHTML = activeMethods.length ? activeMethods.map((method) => `
    <label class="checkbox-label">
      <input type="checkbox" name="paymentMethodId" value="${method.id}" checked>
      ${escapeHtml(method.name)} (${escapeHtml(method.type)})
    </label>`).join("") : `<p class="meta">Cadastre uma forma de pagamento ativa.</p>`;
}

function updateSuggestedPrice() {
  const form = document.getElementById("serviceForm");
  const client = clientById(form.elements.clientId.value);
  const catalogItem = state.catalog.find((item) => item.id === form.elements.catalogId.value);
  const hint = document.getElementById("suggestedPrice");
  if (!client || !catalogItem) {
    hint.textContent = "Selecione o cliente e o serviço para preencher o valor.";
    return;
  }
  const suggested = Number(catalogItem.prices[client.priceGroup] || 0);
  form.elements.amount.value = suggested.toFixed(2);
  hint.textContent = `${client.priceGroup}: ${money.format(suggested)}. Você pode editar este valor sem alterar a tabela.`;
}

function renderReferenceList() {
  document.getElementById("referenceList").innerHTML = serviceReferenceValues.map((reference, index) => `
    <span class="reference-chip">
      ${escapeHtml(reference)}
      <button type="button" data-remove-reference="${index}" aria-label="Remover ${escapeHtml(reference)}">×</button>
    </span>`).join("");
}

function addCurrentReference() {
  const input = document.querySelector('#serviceForm textarea[name="reference"]');
  const references = input.value
    .split(/\r?\n/)
    .map((reference) => reference.trim().toUpperCase())
    .filter(Boolean);
  if (!references.length) return false;
  references.forEach((reference) => {
    if (!serviceReferenceValues.includes(reference)) serviceReferenceValues.push(reference);
  });
  input.value = "";
  renderReferenceList();
  input.focus();
  return true;
}

function duplicateOpenReferences({ entryId, clientId, catalogId, amount, references }) {
  const referenceSet = new Set(references.filter(Boolean));
  if (!referenceSet.size) return [];
  return state.services.filter((item) =>
    item.id !== entryId
    && !item.billingId
    && item.status !== "Cancelado"
    && item.clientId === clientId
    && item.catalogId === catalogId
    && Number(item.amount) === Number(amount)
    && referenceSet.has(String(item.reference || "").trim().toUpperCase())
  );
}

function renderAdditionalServiceList() {
  document.getElementById("additionalServiceList").innerHTML = additionalServiceValues.map((service, index) => `
    <div class="additional-service-item">
      <span>${escapeHtml(catalogOptionLabel(state.catalog.find((item) => item.id === service.catalogId)))}</span>
      <strong>${money.format(service.amount)}</strong>
      <button type="button" data-remove-additional-service="${index}" aria-label="Remover serviço complementar">×</button>
    </div>`).join("");
}

function syncAdditionalCatalogSelection() {
  const form = document.getElementById("serviceForm");
  const catalogItem = itemByExactLabel(
    state.catalog,
    form.elements.additionalCatalogSearch.value,
    catalogOptionLabel
  );
  form.elements.additionalCatalogId.value = catalogItem?.id || "";
  const client = clientById(form.elements.clientId.value);
  const suggested = client && catalogItem
    ? Number(catalogItem.prices[client.priceGroup] || 0)
    : 0;
  form.elements.additionalAmount.value = catalogItem ? suggested.toFixed(2) : "";
  document.getElementById("additionalSuggestedPrice").textContent = catalogItem && client
    ? `${client.priceGroup}: ${money.format(suggested)}. Você pode editar este valor.`
    : "Escolha um serviço complementar.";
}

function addAdditionalService() {
  const form = document.getElementById("serviceForm");
  syncAdditionalCatalogSelection();
  const catalogId = form.elements.additionalCatalogId.value;
  const amount = Number(form.elements.additionalAmount.value);
  if (!catalogId) {
    alert("Selecione um serviço complementar válido.");
    form.elements.additionalCatalogSearch.focus();
    return false;
  }
  if (catalogId === form.elements.catalogId.value) {
    alert("O serviço complementar deve ser diferente do serviço principal.");
    return false;
  }
  if (additionalServiceValues.some((item) => item.catalogId === catalogId)) {
    alert("Este serviço complementar já foi adicionado.");
    return false;
  }
  additionalServiceValues.push({ catalogId, amount });
  form.elements.additionalCatalogId.value = "";
  form.elements.additionalCatalogSearch.value = "";
  form.elements.additionalAmount.value = "";
  document.getElementById("additionalSuggestedPrice").textContent = "Escolha outro serviço complementar ou salve o lançamento.";
  renderAdditionalServiceList();
  form.elements.additionalCatalogSearch.focus();
  return true;
}

function toggleAdditionalServices() {
  const form = document.getElementById("serviceForm");
  const enabled = form.elements.hasAdditionalServices.checked;
  document.getElementById("additionalServicesSection").classList.toggle("hidden", !enabled);
  if (!enabled) {
    additionalServiceValues = [];
    form.elements.additionalCatalogId.value = "";
    form.elements.additionalCatalogSearch.value = "";
    form.elements.additionalAmount.value = "";
    renderAdditionalServiceList();
  }
}

function syncServiceClientSelection() {
  const form = document.getElementById("serviceForm");
  const client = itemByExactLabel(state.clients, form.elements.clientSearch.value, clientOptionLabel);
  form.elements.clientId.value = client?.id || "";
  updateSuggestedPrice();
}

function syncServiceCatalogSelection() {
  const form = document.getElementById("serviceForm");
  const catalogItem = itemByExactLabel(state.catalog, form.elements.catalogSearch.value, catalogOptionLabel);
  form.elements.catalogId.value = catalogItem?.id || "";
  updateSuggestedPrice();
}

function syncServiceClientFilter() {
  const searchInput = document.getElementById("serviceClientNameFilter");
  const client = uniqueClientMatch(searchInput.value);
  document.getElementById("serviceClientFilter").value = client?.id || "";
  renderServices();
}

function renderCatalogPriceFields(item = null) {
  document.getElementById("catalogPriceFields").innerHTML = state.priceTables.map((name) => `
    <label>${escapeHtml(name)}
      <input type="number" min="0" step="0.01" required data-price-table="${escapeHtml(name)}" value="${item ? Number(item.prices[name] || 0).toFixed(2) : ""}">
    </label>`).join("");
}

function openClientForm(client = null) {
  const form = document.getElementById("clientForm");
  form.reset();
  form.elements.clientId.value = client?.id || "";
  form.elements.name.value = client?.name || "";
  form.elements.phone.value = client?.phone || "";
  form.elements.priceGroup.value = client?.priceGroup || "";
  document.getElementById("clientDialogTitle").textContent = client ? "Editar cliente" : "Novo cliente";
  document.getElementById("clientDialog").showModal();
}

function openCatalogForm(item = null) {
  const form = document.getElementById("catalogForm");
  form.reset();
  form.elements.catalogId.value = item?.id || "";
  form.elements.code.value = item?.code || "";
  form.elements.name.value = item?.name || "";
  renderCatalogPriceFields(item);
  document.getElementById("catalogDialogTitle").textContent = item ? "Editar serviço" : "Novo serviço";
  document.getElementById("catalogDialog").showModal();
}

function openEntryForm(item = null, preferredClientId = "") {
  const form = document.getElementById("serviceForm");
  form.reset();
  serviceReferenceValues = [];
  additionalServiceValues = [];
  form.elements.entryId.value = item?.id || "";
  form.elements.clientId.value = item?.clientId || preferredClientId || "";
  form.elements.clientSearch.value = clientOptionLabel(clientById(form.elements.clientId.value));
  form.elements.date.value = item?.date || new Date().toISOString().slice(0, 10);
  form.elements.catalogId.value = item?.catalogId || "";
  form.elements.catalogSearch.value = catalogOptionLabel(
    state.catalog.find((catalogItem) => catalogItem.id === form.elements.catalogId.value)
  );
  form.elements.reference.value = item?.reference || "";
  form.elements.amount.value = item ? Number(item.amount).toFixed(2) : "";
  form.elements.status.value = item?.status || "A fazer";
  form.elements.hasAdditionalServices.checked = false;
  form.elements.hasAdditionalServices.disabled = Boolean(item);
  document.getElementById("additionalServicesSection").classList.add("hidden");
  document.getElementById("serviceDialogTitle").textContent = item ? "Editar lançamento" : "Novo lançamento";
  document.getElementById("suggestedPrice").textContent = item
    ? "O valor pode ser alterado somente neste lançamento."
    : "Selecione o cliente e o serviço para preencher o valor.";
  renderReferenceList();
  renderAdditionalServiceList();
  document.getElementById("serviceDialog").showModal();
  setTimeout(() => form.elements.clientSearch.focus(), 0);
}

function openPaymentForm(item = null, billing = null, mode = "partial") {
  const form = document.getElementById("paymentForm");
  form.reset();
  form.elements.paymentId.value = item?.id || "";
  form.elements.billingId.value = item?.billingId || billing?.id || "";
  form.elements.clientId.value = item?.clientId || billing?.clientId || "";
  form.elements.date.value = item?.date || new Date().toISOString().slice(0, 10);
  form.elements.amount.value = item
    ? Number(item.amount).toFixed(2)
    : billing && mode === "full" ? billingOpenAmount(billing).toFixed(2) : "";
  form.elements.method.value = item?.method || "";
  form.elements.note.value = item?.note || "";
  const hint = document.getElementById("paymentBillingHint");
  if (billing) {
    hint.textContent = `Cobrança de ${formatDate(billing.startDate)} a ${formatDate(billing.endDate)}. Saldo atual: ${money.format(billingOpenAmount(billing))}.`;
    hint.classList.remove("hidden");
  } else {
    hint.textContent = "";
    hint.classList.add("hidden");
  }
  document.getElementById("paymentDialogTitle").textContent = item ? "Editar pagamento" : "Registrar pagamento";
  document.getElementById("paymentDialog").showModal();
}

function openPaymentMethodForm(method = null) {
  const form = document.getElementById("paymentMethodForm");
  form.reset();
  form.elements.methodId.value = method?.id || "";
  form.elements.type.value = method?.type || "PIX";
  form.elements.name.value = method?.name || "";
  form.elements.details.value = method?.details || "";
  form.elements.link.value = method?.link || "";
  form.elements.active.checked = method?.active ?? true;
  document.getElementById("paymentMethodDialogTitle").textContent = method ? "Editar forma de pagamento" : "Nova forma de pagamento";
  document.getElementById("paymentMethodDialog").showModal();
}

function billingDetails(billing) {
  const services = state.services.filter((item) =>
    item.billingId === billing.id || (
      !item.billingId && item.clientId === billing.clientId
      && item.date >= billing.startDate && item.date <= billing.endDate
    ));
  const payments = state.payments.filter((item) =>
    item.billingId === billing.id || (
      !item.billingId && item.clientId === billing.clientId
      && item.date >= billing.startDate && item.date <= billing.endDate
    ));
  const serviceTotal = billing.servicesTotal ?? services.reduce((sum, item) => sum + item.amount, 0);
  const paymentTotal = billing.paymentsTotal ?? payments.reduce((sum, item) => sum + item.amount, 0);
  const previousBalance = billing.previousBalance ?? billing.amount - serviceTotal + paymentTotal;
  return { services, payments, serviceTotal, paymentTotal, previousBalance };
}

function pdfSafeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function billingReportFileName(billing) {
  const client = clientById(billing.clientId);
  const name = String(client?.name || "cliente")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `relatorio-${name || "cliente"}-${billing.endDate}.pdf`;
}

function createBillingReportPdf(billing) {
  const client = clientById(billing.clientId);
  const details = billingDetails(billing);
  const laterPayments = state.payments.filter((payment) => paymentWasAfterBilling(payment, billing));
  const selectedMethodIds = billing.paymentMethodIds || [];
  const methods = billing.paymentMethods?.length
    ? billing.paymentMethods
    : state.paymentMethods.filter((method) =>
      selectedMethodIds.length ? selectedMethodIds.includes(method.id) : method.active);
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 42;
  const pages = [];
  let commands = [];
  let y = 800;
  const colors = {
    green: "0.086 0.31 0.263",
    blue: "0.176 0.447 0.769",
    payment: "0.094 0.525 0.294",
    orange: "0.812 0.424 0.071",
    gray: "0.455 0.506 0.49",
    dark: "0.12 0.18 0.16"
  };

  function addPage() {
    if (commands.length) pages.push(commands.join("\n"));
    commands = [
      `${colors.green} rg 0 790 ${pageWidth} 52 re f`,
      "1 1 1 rg BT /F2 17 Tf 42 812 Td (Gestor de Servicos) Tj ET"
    ];
    y = 766;
  }

  function text(value, x, size = 10, color = colors.dark, bold = false) {
    commands.push(`${color} rg BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${pdfSafeText(value)}) Tj ET`);
  }

  function line() {
    commands.push(`0.86 0.86 0.83 RG ${margin} ${y - 7} m ${pageWidth - margin} ${y - 7} l S`);
  }

  function ensureSpace(height = 28) {
    if (y - height < 44) addPage();
  }

  function heading(value) {
    ensureSpace(38);
    y -= 12;
    text(value, margin, 13, colors.green, true);
    y -= 12;
    line();
    y -= 18;
  }

  addPage();
  text("Relatorio de cobranca", margin, 9, colors.gray, true);
  y -= 25;
  text(client?.name || "Cliente", margin, 22, colors.dark, true);
  y -= 19;
  text(
    `Periodo: ${billing.startDate.split("-").reverse().join("/")} a ${billing.endDate.split("-").reverse().join("/")}`,
    margin,
    10,
    colors.gray
  );
  y -= 34;

  const cards = [
    ["Saldo anterior", details.previousBalance, colors.gray],
    ["Servicos", details.serviceTotal, colors.blue],
    ["Pagamentos", details.paymentTotal, colors.payment],
    ["Total em aberto", billingOpenAmount(billing), colors.orange]
  ];
  cards.forEach(([label, amount, color], index) => {
    const x = margin + index * 128;
    commands.push(`${color} rg ${x} ${y - 36} 116 58 re f`);
    commands.push(`1 1 1 rg BT /F1 8 Tf ${x + 9} ${y + 5} Td (${pdfSafeText(label)}) Tj ET`);
    commands.push(`1 1 1 rg BT /F2 12 Tf ${x + 9} ${y - 17} Td (${pdfSafeText(money.format(Number(amount)))}) Tj ET`);
  });
  y -= 72;

  heading("Servicos do periodo");
  if (!details.services.length) {
    text("Nenhum servico neste fechamento.", margin);
    y -= 22;
  } else {
    const columnWidth = 245;
    const columnGap = 20;
    ensureSpace(28);
    [0, 1].forEach((columnIndex) => {
      const x = margin + columnIndex * (columnWidth + columnGap);
      commands.push(`0.91 0.94 0.93 rg ${x} ${y - 15} ${columnWidth} 22 re f`);
      commands.push(`${colors.dark} rg BT /F2 7 Tf ${x + 6} ${y - 2} Td (Data) Tj ET`);
      commands.push(`${colors.dark} rg BT /F2 7 Tf ${x + 48} ${y - 2} Td (Servico) Tj ET`);
      commands.push(`${colors.dark} rg BT /F2 7 Tf ${x + 145} ${y - 2} Td (Ref) Tj ET`);
      commands.push(`${colors.dark} rg BT /F2 7 Tf ${x + 202} ${y - 2} Td (Valor) Tj ET`);
    });
    y -= 27;
    const splitAt = Math.ceil(details.services.length / 2);
    const leftServices = details.services.slice(0, splitAt);
    const rightServices = details.services.slice(splitAt);
    const rowCount = Math.max(leftServices.length, rightServices.length);
    for (let index = 0; index < rowCount; index += 1) {
      ensureSpace(27);
      const rowY = y;
      [leftServices[index], rightServices[index]].forEach((item, columnIndex) => {
        if (!item) return;
        const x = margin + columnIndex * (columnWidth + columnGap);
        const description = String(item.description || "").slice(0, 19);
        const reference = String(item.reference || "-").slice(0, 10);
        commands.push(`0.97 0.98 0.97 rg ${x} ${rowY - 16} ${columnWidth} 23 re f`);
        commands.push(`${colors.gray} rg BT /F1 6.5 Tf ${x + 5} ${rowY - 3} Td (${pdfSafeText(item.date.split("-").reverse().join("/"))}) Tj ET`);
        commands.push(`${colors.dark} rg BT /F1 7 Tf ${x + 48} ${rowY - 3} Td (${pdfSafeText(description)}) Tj ET`);
        commands.push(`${colors.gray} rg BT /F1 6.5 Tf ${x + 145} ${rowY - 3} Td (${pdfSafeText(reference)}) Tj ET`);
        commands.push(`${colors.blue} rg BT /F2 7 Tf ${x + 194} ${rowY - 3} Td (${pdfSafeText(money.format(Number(item.amount)))}) Tj ET`);
      });
      y -= 27;
    }
  }

  heading("Pagamentos");
  const reportPayments = [...details.payments, ...laterPayments.filter((payment) =>
    !details.payments.some((item) => item.id === payment.id))];
  if (!reportPayments.length) {
    text("Nenhum pagamento registrado.", margin);
    y -= 22;
  } else {
    reportPayments.forEach((item) => {
      ensureSpace(32);
      text(item.date.split("-").reverse().join("/"), margin, 9, colors.gray);
      text(item.method || item.note || "-", 145, 9, colors.dark);
      text(money.format(Number(item.amount)), 462, 9, colors.payment, true);
      y -= 17;
      line();
      y -= 8;
    });
  }

  heading("Formas de pagamento");
  if (!methods.length) {
    text("Consulte as formas de pagamento com o responsavel.", margin);
  } else {
    methods.forEach((method) => {
      ensureSpace(44);
      text(`${method.name} (${method.type})`, margin, 10, colors.green, true);
      y -= 15;
      text(method.details || method.link || "-", margin, 9, colors.dark);
      y -= 24;
    });
  }

  pages.push(commands.join("\n"));
  const objects = [];
  const pageObjectNumbers = pages.map((_, index) => 5 + index * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageObjectNumbers.map((number) => `${number} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";
  pages.forEach((content, index) => {
    const pageNumber = pageObjectNumbers[index];
    const contentNumber = pageNumber + 1;
    objects[pageNumber] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentNumber} 0 R >>`;
    objects[contentNumber] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = pdf.length;
    pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let index = 1; index < objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

function downloadBillingReport(billing, blob = createBillingReportPdf(billing)) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = billingReportFileName(billing);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function shareBillingReport(billing) {
  const client = clientById(billing.clientId);
  const blob = createBillingReportPdf(billing);
  const file = new File([blob], billingReportFileName(billing), { type: "application/pdf" });
  const shareData = {
    title: `Relatorio de cobranca - ${client?.name || "Cliente"}`,
    text: `Segue o relatorio de cobranca de ${billing.startDate.split("-").reverse().join("/")} a ${billing.endDate.split("-").reverse().join("/")}.`,
    files: [file]
  };

  const supportsFileShare = typeof navigator.share === "function"
    && typeof navigator.canShare === "function"
    && navigator.canShare({ files: [file] });
  if (supportsFileShare) {
    try {
      await navigator.share(shareData);
      return "PDF compartilhado";
    } catch (error) {
      if (error?.name === "AbortError") return "";
    }
  }

  downloadBillingReport(billing, blob);
  alert(
    "Este navegador não permite anexar o PDF automaticamente.\n\n"
    + "O relatório foi baixado. Abra o WhatsApp e anexe o arquivo PDF salvo."
  );
  return "PDF salvo";
}

function whatsappBillingMessage(billing, automaticAccessUrl) {
  const client = clientById(billing.clientId);
  const selectedMethodIds = billing.paymentMethodIds || [];
  const billingMethods = billing.paymentMethods?.length
    ? billing.paymentMethods
    : state.paymentMethods.filter((method) =>
      selectedMethodIds.length ? selectedMethodIds.includes(method.id) : method.active);
  const methods = billingMethods.length
    ? billingMethods
      .map((method) => `${method.name}: ${method.details || method.link || "Consulte as instruções no relatório"}`)
      .join("\n")
    : "Consulte as formas de pagamento no relatório.";
  return `Olá, ${client?.name || ""}!\n\nSua cobrança de ${formatDate(billing.startDate)} a ${formatDate(billing.endDate)} foi gerada.\n\nTotal em aberto: ${money.format(billingOpenAmount(billing))}\n\nFormas de pagamento:\n${methods}\n\nAcesse sua cobrança sem precisar digitar senha:\n${automaticAccessUrl}`;
}

async function issueClientMagicLink(billing) {
  const { data } = await window.supabaseClient.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Sua sessão administrativa expirou.");
  const response = await fetch("/.netlify/functions/issue-client-magic-link", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({ clientId: billing.clientId, billingId: billing.id })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Não foi possível gerar o link automático.");
  return `${location.origin}/cliente.html?access=${encodeURIComponent(result.accessCode)}`;
}

async function shareBillingByWhatsApp(billing) {
  const client = clientById(billing.clientId);
  const phone = whatsappPhone(client);
  const automaticAccessUrl = await issueClientMagicLink(billing);
  const text = whatsappBillingMessage(billing, automaticAccessUrl);
  const query = `${phone ? `phone=${phone}&` : ""}text=${encodeURIComponent(text)}`;
  const link = document.createElement("a");
  link.href = `https://api.whatsapp.com/send?${query}`;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
  return "WhatsApp";
}

function openBillingReport(billingId) {
  const billing = state.billings.find((item) => item.id === billingId);
  const client = clientById(billing.clientId);
  const details = billingDetails(billing);
  const maxValue = Math.max(details.serviceTotal, details.paymentTotal, Math.abs(details.previousBalance), 1);
  const selectedMethodIds = billing.paymentMethodIds || [];
  const methods = billing.paymentMethods?.length
    ? billing.paymentMethods
    : state.paymentMethods.filter((method) =>
      selectedMethodIds.length ? selectedMethodIds.includes(method.id) : method.active);
  const laterPayments = state.payments.filter((payment) => paymentWasAfterBilling(payment, billing));
  function serviceTable(items) {
    const rows = items.map((item) => `<tr>
      <td>${item.date.split("-").reverse().join("/")}</td>
      <td title="${escapeHtml(item.description)}">${escapeHtml(item.description)}</td>
      <td title="${escapeHtml(item.reference || "-")}">${escapeHtml(item.reference || "-")}</td>
      <td>${money.format(item.amount)}</td>
    </tr>`).join("");
    return `<table class="report-service-table">
      <thead><tr><th>Data</th><th>Serviço</th><th>Ref</th><th>Valor</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="4">-</td></tr>`}</tbody>
    </table>`;
  }
  const splitAt = Math.ceil(details.services.length / 2);
  const serviceRows = details.services.length
    ? `${serviceTable(details.services.slice(0, splitAt))}${serviceTable(details.services.slice(splitAt))}`
    : `<p class="meta">Nenhum serviço neste período.</p>`;
  const methodRows = methods.length ? methods.map((method) => `
    <div class="payment-option">
      <strong>${escapeHtml(method.name)} (${escapeHtml(method.type)})</strong>
      <span>${escapeHtml(method.details || "")}</span>
      ${method.link ? `<br><a href="${escapeHtml(method.link)}" target="_blank">Abrir link de pagamento</a>` : ""}
    </div>`).join("") : `<p class="meta">Nenhuma forma de pagamento ativa.</p>`;

  document.getElementById("reportContent").innerHTML = `<section class="report">
    <div class="report-actions">
      <button class="primary" data-print-report>Imprimir / Salvar PDF</button>
      <button class="secondary whatsapp-action" data-share-whatsapp="${billing.id}">WhatsApp</button>
      <button class="secondary" data-share-report="${billing.id}">Compartilhar relatório</button>
      <button class="icon-button" data-close-report>×</button>
    </div>
    <header class="report-header">
      <div><span class="eyebrow">Relatório de cobrança</span><h2>${escapeHtml(client?.name || "")}</h2><p class="meta">${billing.startDate.split("-").reverse().join("/")} a ${billing.endDate.split("-").reverse().join("/")}</p></div>
      <div><span class="meta">${billingCurrentStatus(billing)}</span><strong class="hero-value" style="font-size:36px">${money.format(billingOpenAmount(billing))}</strong></div>
    </header>
    <div class="report-summary">
      <article><span class="meta">Saldo anterior</span><strong>${money.format(details.previousBalance)}</strong></article>
      <article><span class="meta">Serviços</span><strong>${money.format(details.serviceTotal)}</strong></article>
      <article><span class="meta">Pagamentos</span><strong>${money.format(details.paymentTotal)}</strong></article>
      <article><span class="meta">Baixas após cobrança</span><strong>${money.format(laterPayments.reduce((sum, item) => sum + Number(item.amount), 0))}</strong></article>
    </div>
    <h3>Resumo gráfico</h3>
    <div class="chart">
      <div class="chart-row"><span>Saldo anterior</span><div class="chart-track"><div class="chart-bar" style="width:${Math.abs(details.previousBalance) / maxValue * 100}%"></div></div><strong>${money.format(details.previousBalance)}</strong></div>
      <div class="chart-row"><span>Serviços</span><div class="chart-track"><div class="chart-bar" style="width:${details.serviceTotal / maxValue * 100}%"></div></div><strong>${money.format(details.serviceTotal)}</strong></div>
      <div class="chart-row"><span>Pagamentos</span><div class="chart-track"><div class="chart-bar credit" style="width:${details.paymentTotal / maxValue * 100}%"></div></div><strong>${money.format(details.paymentTotal)}</strong></div>
    </div>
    <h3>Serviços do período</h3>
    <div class="report-service-grid">${serviceRows}</div>
    <h3>Formas de pagamento</h3>
    <div class="payment-options">${methodRows}</div>
  </section>`;
  document.getElementById("reportDialog").showModal();
}

function whatsappPhone(client) {
  const digits = String(client?.phone || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
}

async function issueClientAccess(billing) {
  const { data } = await window.supabaseClient.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Sua sessão administrativa expirou.");

  const response = await fetch("/.netlify/functions/issue-client-access", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      clientId: billing.clientId,
      billingId: billing.id,
      historyEnabled: Boolean(billing.historyEnabled)
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Não foi possível gerar o acesso do cliente.");
  return result;
}

async function updateClientHistoryAccess(billing, enabled) {
  const { data } = await window.supabaseClient.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Sua sessão administrativa expirou.");

  const response = await fetch("/.netlify/functions/update-client-history-access", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      clientId: billing.clientId,
      billingId: billing.id,
      enabled
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Não foi possível alterar o acesso ao histórico.");
  return result;
}

async function cancelClientAccess(billing) {
  const { data } = await window.supabaseClient.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Sua sessão administrativa expirou.");

  const response = await fetch("/.netlify/functions/cancel-client-access", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ billingId: billing.id })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) {
    throw new Error(result.error || "Não foi possível cancelar o acesso do cliente.");
  }
  return result;
}

function apiBrasilQrCode(result) {
  const candidate = result?.qrcode
    || result?.qrCode
    || result?.data?.qrcode
    || result?.data?.qrCode
    || "";
  if (typeof candidate !== "string" || !candidate.trim()) return "";
  if (/^data:image\//i.test(candidate) || /^https?:\/\//i.test(candidate)) return candidate;
  return `data:image/png;base64,${candidate.replace(/\s/g, "")}`;
}

async function startApiBrasilWhatsApp({ number, forceClearCache }) {
  const { data } = await window.supabaseClient.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Sua sessão administrativa expirou.");

  const response = await fetch("/.netlify/functions/apibrasil-whatsapp-start-background", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      qrcode: true,
      number: number || undefined,
      forceClearCache
    })
  });
  const result = await response.json().catch(() => ({ accepted: response.ok }));
  if (!response.ok) throw new Error(result.error || "Não foi possível iniciar o WhatsApp.");
  return result;
}

async function apiBrasilWhatsAppStatus() {
  const { data } = await window.supabaseClient.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Sua sessão administrativa expirou.");
  const response = await fetch("/.netlify/functions/apibrasil-whatsapp-status", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Não foi possível consultar o WhatsApp.");
  return result;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function pollApiBrasilWhatsApp(onUpdate) {
  const terminalStatuses = new Set([
    "inChat", "isLogged", "qrReadSuccess", "autocloseCalled", "browserClose",
    "desconnectedMobile", "phoneNotConnected", "qrReadError", "qrReadFail",
    "serverClose", "APIBRASIL_TIMEOUT", "APIBRASIL_NETWORK_ERROR", "error"
  ]);
  for (let attempt = 0; attempt < 45; attempt += 1) {
    await wait(3000);
    const result = await apiBrasilWhatsAppStatus();
    onUpdate(result);
    const isErrorStatus = /^(HTTP_\d+|APIBRASIL_|error$)/i.test(result.status || "");
    if (result.qr_code || terminalStatuses.has(result.status) || isErrorStatus) {
      if (isErrorStatus) {
        throw new Error(result.message || `A APIBrasil retornou ${result.status}.`);
      }
      return result;
    }
  }
  throw new Error("A APIBrasil ainda está processando. Aguarde um pouco e tente consultar novamente.");
}

document.addEventListener("click", async (event) => {
  const tab = event.target.closest("[data-view]");
  const opener = event.target.closest("[data-open-view]");
  const dialogButton = event.target.closest("[data-dialog]");
  if (tab) showView(tab.dataset.view);
  if (opener) showView(opener.dataset.openView);
  const paymentDashboardFilter = event.target.closest("[data-payment-dashboard-filter]");
  if (paymentDashboardFilter) {
    document.getElementById("paymentStatusFilter").value = paymentDashboardFilter.dataset.paymentDashboardFilter;
    showView("payments");
    renderPayments();
  }
  if (event.target.closest("#notificationButton")) {
    renderNotifications();
    document.getElementById("notificationDialog").showModal();
  }
  const notificationTarget = event.target.closest("[data-notification-target]");
  if (notificationTarget) {
    document.getElementById("notificationDialog").close();
    if (notificationTarget.dataset.notificationTarget === "service") {
      document.getElementById("serviceStatusFilter").value = "A fazer";
      showView("services");
      renderServices();
    } else {
      document.getElementById("paymentStatusFilter").value = "overdue";
      showView("payments");
      renderPayments();
    }
  }
  if (dialogButton) {
    if (dialogButton.dataset.dialog === "clientDialog") openClientForm();
    else if (dialogButton.dataset.dialog === "catalogDialog") openCatalogForm();
    else if (dialogButton.dataset.dialog === "serviceDialog") {
      const preferredClient = uniqueClientMatch(document.getElementById("serviceClientNameFilter").value);
      openEntryForm(null, preferredClient?.id || "");
    }
    else if (dialogButton.dataset.dialog === "paymentDialog") openPaymentForm();
    else if (dialogButton.dataset.dialog === "paymentMethodDialog") openPaymentMethodForm();
    else if (dialogButton.dataset.dialog === "priceTableDialog") {
      const form = document.getElementById("priceTableForm");
      form.reset();
      document.getElementById("priceTableDialogTitle").textContent = "Nova tabela";
      document.getElementById("priceTableDialog").showModal();
    }
    else {
      setDefaultDates();
      if (dialogButton.dataset.dialog === "billingDialog") renderBillingPaymentMethods();
      document.getElementById(dialogButton.dataset.dialog).showModal();
    }
  }
  const closeDialogButton = event.target.closest("[data-close-dialog]");
  if (closeDialogButton) closeDialogButton.closest("dialog")?.close();
  const removeReferenceButton = event.target.closest("[data-remove-reference]");
  if (removeReferenceButton) {
    serviceReferenceValues.splice(Number(removeReferenceButton.dataset.removeReference), 1);
    renderReferenceList();
  }
  const removeAdditionalServiceButton = event.target.closest("[data-remove-additional-service]");
  if (removeAdditionalServiceButton) {
    additionalServiceValues.splice(Number(removeAdditionalServiceButton.dataset.removeAdditionalService), 1);
    renderAdditionalServiceList();
  }
  const continuationButton = event.target.closest("[data-entry-next]");
  if (continuationButton && entryContinuationResolver) {
    const resolve = entryContinuationResolver;
    entryContinuationResolver = null;
    document.getElementById("continueEntryDialog").close();
    resolve(continuationButton.dataset.entryNext);
  }

  const editClient = event.target.closest("[data-edit-client]");
  if (editClient) openClientForm(clientById(editClient.dataset.editClient));
  const deleteClient = event.target.closest("[data-delete-client]");
  if (deleteClient) {
    const id = deleteClient.dataset.deleteClient;
    const linked = state.services.some((item) => item.clientId === id)
      || state.payments.some((item) => item.clientId === id)
      || state.billings.some((item) => item.clientId === id);
    if (linked) alert("Este cliente possui movimentações e não pode ser excluído.");
    else if (confirm("Excluir este cliente?")) {
      state.clients = state.clients.filter((client) => client.id !== id);
      saveState();
    }
  }

  const editTable = event.target.closest("[data-edit-table]");
  if (editTable) {
    const form = document.getElementById("priceTableForm");
    form.reset();
    form.elements.originalName.value = editTable.dataset.editTable;
    form.elements.name.value = editTable.dataset.editTable;
    document.getElementById("priceTableDialogTitle").textContent = "Editar tabela";
    document.getElementById("priceTableDialog").showModal();
  }
  const deleteTable = event.target.closest("[data-delete-table]");
  if (deleteTable) {
    const name = deleteTable.dataset.deleteTable;
    if (state.clients.some((client) => client.priceGroup === name)) {
      alert("Esta tabela está vinculada a clientes e não pode ser excluída.");
    } else if (confirm(`Excluir a ${name}?`)) {
      state.priceTables = state.priceTables.filter((table) => table !== name);
      state.catalog.forEach((item) => delete item.prices[name]);
      saveState();
    }
  }

  const editCatalog = event.target.closest("[data-edit-catalog]");
  if (editCatalog) openCatalogForm(state.catalog.find((item) => item.id === editCatalog.dataset.editCatalog));
  const deleteCatalog = event.target.closest("[data-delete-catalog]");
  if (deleteCatalog) {
    const id = deleteCatalog.dataset.deleteCatalog;
    if (state.services.some((item) => item.catalogId === id)) {
      alert("Este serviço já possui lançamentos e não pode ser excluído.");
    } else if (confirm("Excluir este serviço?")) {
      state.catalog = state.catalog.filter((item) => item.id !== id);
      saveState();
    }
  }

  const editEntry = event.target.closest("[data-edit-entry]");
  if (editEntry) openEntryForm(state.services.find((item) => item.id === editEntry.dataset.editEntry));
  const serviceStatusButton = event.target.closest("[data-service-status]");
  if (serviceStatusButton) {
    const entry = state.services.find((item) => item.id === serviceStatusButton.dataset.entryId);
    if (entry) {
      entry.status = serviceStatusButton.dataset.serviceStatus;
      if (entry.status === "Pronto" && !entry.deliveryCode) entry.deliveryCode = randomDeliveryCode();
      if (entry.status === "Entregue") {
        entry.deliveredAt = new Date().toISOString();
        entry.deliverySource = "Administrador";
      }
      entry.updatedAt = new Date().toISOString();
      saveState();
    }
  }
  const requestDeliveryButton = event.target.closest("[data-request-delivery]");
  if (requestDeliveryButton) {
    const entry = state.services.find((item) => item.id === requestDeliveryButton.dataset.requestDelivery);
    if (entry) {
      if (!entry.deliveryCode) entry.deliveryCode = randomDeliveryCode();
      entry.confirmationRequestedAt = new Date().toISOString();
      entry.updatedAt = entry.confirmationRequestedAt;
      try {
        await navigator.clipboard.writeText(deliveryConfirmationMessage(entry));
        alert("Mensagem de confirmação copiada para enviar no WhatsApp.");
      } catch {
        alert(deliveryConfirmationMessage(entry));
      }
      saveState();
    }
  }
  const deleteEntry = event.target.closest("[data-delete-entry]");
  if (deleteEntry && confirm("Excluir este lançamento?")) {
    state.services = state.services.filter((item) => item.id !== deleteEntry.dataset.deleteEntry);
    saveState();
  }

  const editPayment = event.target.closest("[data-edit-payment]");
  if (editPayment) openPaymentForm(state.payments.find((item) => item.id === editPayment.dataset.editPayment));
  const payBillingButton = event.target.closest("[data-pay-billing]");
  if (payBillingButton) {
    const billing = state.billings.find((item) => item.id === payBillingButton.dataset.payBilling);
    if (billing) openPaymentForm(null, billing, payBillingButton.dataset.paymentMode);
  }
  const deletePayment = event.target.closest("[data-delete-payment]");
  if (deletePayment && confirm("Excluir este pagamento?")) {
    state.payments = state.payments.filter((item) => item.id !== deletePayment.dataset.deletePayment);
    updateBillingStatuses();
    saveState();
  }

  const editMethod = event.target.closest("[data-edit-method]");
  if (editMethod) openPaymentMethodForm(state.paymentMethods.find((method) => method.id === editMethod.dataset.editMethod));
  const deleteMethod = event.target.closest("[data-delete-method]");
  if (deleteMethod && confirm("Excluir esta forma de pagamento?")) {
    state.paymentMethods = state.paymentMethods.filter((method) => method.id !== deleteMethod.dataset.deleteMethod);
    saveState();
  }

  const reportButton = event.target.closest("[data-view-report]");
  if (reportButton) openBillingReport(reportButton.dataset.viewReport);
  const copyAccessButton = event.target.closest("[data-copy-access]");
  if (copyAccessButton) {
    const billing = state.billings.find((item) => item.id === copyAccessButton.dataset.billingId);
    const isPassword = copyAccessButton.dataset.copyAccess === "password";
    const value = isPassword ? billing?.password : billing?.identifier;
    if (value) await copyText(value, isPassword ? "Senha" : "Identificador");
  }
  const renewAccessButton = event.target.closest("[data-renew-access]");
  if (renewAccessButton) {
    const billing = state.billings.find((item) => item.id === renewAccessButton.dataset.renewAccess);
    renewAccessButton.disabled = true;
    renewAccessButton.textContent = "Gerando...";
    try {
      const credentials = await issueClientAccess(billing);
      billing.identifier = credentials.identifier;
      billing.password = credentials.password;
      await window.dataStore.upsertState(state);
      render();
      alert(`Novo acesso gerado.\n\nIdentificador: ${billing.identifier}\nSenha: ${billing.password}\n\nO acesso anterior foi invalidado.`);
    } catch (error) {
      console.error(error);
      alert(error.message);
      renewAccessButton.disabled = false;
      renewAccessButton.textContent = "Gerar novo acesso";
    }
  }
  const toggleHistoryButton = event.target.closest("[data-toggle-history]");
  if (toggleHistoryButton) {
    const billing = state.billings.find((item) => item.id === toggleHistoryButton.dataset.toggleHistory);
    if (billing) {
      const enabled = !billing.historyEnabled;
      toggleHistoryButton.disabled = true;
      try {
        await updateClientHistoryAccess(billing, enabled);
        billing.historyEnabled = enabled;
        await window.dataStore.upsertState(state);
        render();
        alert(enabled
          ? "Histórico liberado para este acesso."
          : "Histórico bloqueado imediatamente.");
      } catch (error) {
        console.error(error);
        alert(error.message);
        toggleHistoryButton.disabled = false;
      }
    }
  }
  const cancelBillingButton = event.target.closest("[data-cancel-billing]");
  if (cancelBillingButton) {
    const billing = state.billings.find((item) => item.id === cancelBillingButton.dataset.cancelBilling);
    if (billing && billingPaidAmount(billing) > 0) {
      alert("Esta cobrança possui pagamento posterior e não pode ser cancelada.");
    } else if (billing && confirm("Cancelar esta cobrança e liberar os lançamentos para um novo fechamento?")) {
      try {
        await cancelClientAccess(billing);
        billing.status = "Cancelada";
        billing.active = false;
        state.services.forEach((item) => {
          if (item.billingId === billing.id) item.billingId = null;
        });
        state.payments.forEach((item) => {
          if (item.billingId === billing.id && !paymentWasAfterBilling(item, billing)) item.billingId = null;
        });
        saveState();
      } catch (error) {
        console.error(error);
        alert(error.message);
      }
    }
  }
  if (event.target.closest("[data-close-report]")) document.getElementById("reportDialog").close();
  if (event.target.closest("[data-print-report]")) window.print();
  const whatsappButton = event.target.closest("[data-share-whatsapp]");
  if (whatsappButton) {
    const billing = state.billings.find((item) => item.id === whatsappButton.dataset.shareWhatsapp);
    if (billing) {
      try {
        whatsappButton.disabled = true;
        whatsappButton.textContent = "Gerando link...";
        const mode = await shareBillingByWhatsApp(billing);
        billing.sendHistory ||= [];
        billing.sendHistory.push({ sentAt: new Date().toISOString(), channel: "WhatsApp", mode });
        saveState();
      } catch (error) {
        console.error(error);
        alert(error.message || "Não foi possível abrir o WhatsApp.");
      } finally {
        whatsappButton.disabled = false;
        whatsappButton.textContent = "WhatsApp";
      }
    }
  }
  const shareReportButton = event.target.closest("[data-share-report]");
  if (shareReportButton) {
    const billing = state.billings.find((item) => item.id === shareReportButton.dataset.shareReport);
    if (billing) {
      try {
        const mode = await shareBillingReport(billing);
        if (!mode) return;
        billing.sendHistory ||= [];
        billing.sendHistory.push({ sentAt: new Date().toISOString(), channel: "Relatório", mode });
        saveState();
      } catch (error) {
        console.error(error);
        alert("Não foi possível compartilhar o relatório.");
      }
    }
  }
});

document.getElementById("clientForm").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const client = {
    id: data.get("clientId") || crypto.randomUUID(),
    name: data.get("name"),
    phone: data.get("phone"),
    priceGroup: data.get("priceGroup")
  };
  const index = state.clients.findIndex((item) => item.id === client.id);
  if (index >= 0) state.clients[index] = client;
  else state.clients.push(client);
  event.currentTarget.reset();
  event.currentTarget.closest("dialog").close();
  saveState();
});

document.getElementById("priceTableForm").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const originalName = data.get("originalName");
  const name = data.get("name").trim();
  if (state.priceTables.some((table) => table === name && table !== originalName)) {
    alert("Já existe uma tabela com este nome.");
    return;
  }
  if (originalName) {
    state.priceTables = state.priceTables.map((table) => table === originalName ? name : table);
    state.clients = state.clients.map((client) => client.priceGroup === originalName ? { ...client, priceGroup: name } : client);
    state.catalog = state.catalog.map((item) => {
      const prices = { ...item.prices, [name]: item.prices[originalName] || 0 };
      if (name !== originalName) delete prices[originalName];
      return { ...item, prices };
    });
  } else {
    state.priceTables.push(name);
    state.catalog = state.catalog.map((item) => ({ ...item, prices: { ...item.prices, [name]: 0 } }));
  }
  event.currentTarget.reset();
  event.currentTarget.closest("dialog").close();
  saveState();
});

document.getElementById("catalogForm").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const code = String(data.get("code") || "").trim();
  if (code && state.catalog.some((catalogItem) =>
    catalogItem.code === code && catalogItem.id !== data.get("catalogId"))) {
    alert("Este código já está sendo usado por outro serviço.");
    return;
  }
  const item = {
    id: data.get("catalogId") || crypto.randomUUID(),
    code,
    name: data.get("name"),
    prices: Object.fromEntries([...event.currentTarget.querySelectorAll("[data-price-table]")]
      .map((input) => [input.dataset.priceTable, Number(input.value)]))
  };
  const existingIndex = state.catalog.findIndex((catalogItem) => catalogItem.id === item.id);
  if (existingIndex >= 0) state.catalog[existingIndex] = item;
  else state.catalog.push(item);
  event.currentTarget.reset();
  event.currentTarget.closest("dialog").close();
  saveState();
});

function askEntryContinuation() {
  document.getElementById("continueEntryDialog").showModal();
  return new Promise((resolve) => {
    entryContinuationResolver = resolve;
  });
}

document.getElementById("serviceForm").addEventListener("submit", async (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const form = event.currentTarget;
  syncServiceClientSelection();
  syncServiceCatalogSelection();
  if (!form.elements.clientId.value) {
    alert("Selecione um cliente válido da lista.");
    form.elements.clientSearch.focus();
    return;
  }
  if (!form.elements.catalogId.value) {
    alert("Selecione um serviço válido pelo código ou nome.");
    form.elements.catalogSearch.focus();
    return;
  }
  const data = new FormData(form);
  const catalogItem = state.catalog.find((item) => item.id === data.get("catalogId"));
  const existingEntry = state.services.find((item) => item.id === data.get("entryId"));
  const now = new Date().toISOString();
  const typedReferences = String(data.get("reference") || "")
    .split(/\r?\n/)
    .map((reference) => reference.trim().toUpperCase())
    .filter(Boolean);
  const references = existingEntry
    ? [typedReferences.join(" ")]
    : [...new Set([...serviceReferenceValues, ...typedReferences])];
  const entryReferences = references.length ? references : [""];
  if (form.elements.hasAdditionalServices.checked && !additionalServiceValues.length) {
    alert("Adicione pelo menos um serviço complementar ou desmarque a opção.");
    form.elements.additionalCatalogSearch.focus();
    return;
  }
  if (additionalServiceValues.some((service) => service.catalogId === data.get("catalogId"))) {
    alert("O serviço principal também está na lista de complementares. Remova-o ou escolha outro serviço.");
    return;
  }
  const serviceDefinitions = [
    {
      catalogId: data.get("catalogId"),
      description: catalogItem.name,
      amount: Number(data.get("amount")),
      isSecondary: Boolean(existingEntry?.isSecondary)
    },
    ...additionalServiceValues.map((service) => {
      const additionalCatalog = state.catalog.find((item) => item.id === service.catalogId);
      return {
        catalogId: service.catalogId,
        description: additionalCatalog.name,
        amount: Number(service.amount),
        isSecondary: true
      };
    })
  ];
  const duplicates = serviceDefinitions.flatMap((service) =>
    duplicateOpenReferences({
      entryId: existingEntry?.id || "",
      clientId: data.get("clientId"),
      catalogId: service.catalogId,
      amount: service.amount,
      references: entryReferences
    }).map((item) => ({ ...item, duplicateDescription: service.description }))
  );
  if (duplicates.length) {
    const duplicateNames = [...new Set(duplicates.map((item) =>
      `${item.reference || "Sem referência"} — ${item.duplicateDescription}`
    ))].join("\n");
    const shouldContinue = confirm(
      `Atenção: estas referências já possuem o mesmo serviço e valor antes da cobrança:\n\n${duplicateNames}\n\nDeseja lançar novamente?`
    );
    if (!shouldContinue) return;
  }
  entryReferences.forEach((reference, referenceIndex) => {
    const serviceGroupId = existingEntry?.serviceGroupId || crypto.randomUUID();
    const primaryEntryId = existingEntry && referenceIndex === 0
      ? existingEntry.id
      : crypto.randomUUID();
    serviceDefinitions.forEach((service, serviceIndex) => {
      const isPrimary = serviceIndex === 0;
      const entry = {
        id: isPrimary ? primaryEntryId : crypto.randomUUID(),
        clientId: data.get("clientId"),
        catalogId: service.catalogId,
        date: data.get("date"),
        description: service.description,
        reference,
        amount: service.amount,
        status: data.get("status"),
        serviceGroupId,
        primaryEntryId: existingEntry
          ? existingEntry.primaryEntryId || ""
          : isPrimary ? "" : primaryEntryId,
        isSecondary: service.isSecondary,
        deliveryCode: isPrimary && existingEntry?.deliveryCode
          ? existingEntry.deliveryCode
          : randomDeliveryCode(),
        confirmationRequestedAt: isPrimary ? existingEntry?.confirmationRequestedAt || null : null,
        deliveredAt: data.get("status") === "Entregue"
          ? (isPrimary ? existingEntry?.deliveredAt : null) || now
          : null,
        deliverySource: data.get("status") === "Entregue"
          ? (isPrimary ? existingEntry?.deliverySource : "") || "Administrador"
          : "",
        createdAt: isPrimary ? existingEntry?.createdAt || now : now,
        updatedAt: now
      };
      const index = state.services.findIndex((item) => item.id === entry.id);
      if (index >= 0) state.services[index] = entry;
      else state.services.push(entry);
    });
  });
  const savedClientId = data.get("clientId");
  form.reset();
  form.closest("dialog").close();
  saveState();
  if (existingEntry) return;

  const next = await askEntryContinuation();
  if (next === "same") openEntryForm(null, savedClientId);
  if (next === "other") openEntryForm();
});

document.getElementById("paymentForm").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const existingPayment = state.payments.find((item) => item.id === data.get("paymentId"));
  const now = new Date().toISOString();
  const billingId = data.get("billingId") || existingPayment?.billingId || null;
  const amount = Number(data.get("amount"));
  const linkedBilling = state.billings.find((item) => item.id === billingId);
  if (linkedBilling) {
    if (data.get("clientId") !== linkedBilling.clientId) {
      alert("O cliente do pagamento deve ser o mesmo da cobrança.");
      return;
    }
    const available = billingOpenAmount(linkedBilling) + Number(existingPayment?.amount || 0);
    if (amount > available + 0.001) {
      alert(`O valor máximo para esta cobrança é ${money.format(available)}.`);
      return;
    }
  }
  const payment = {
    id: data.get("paymentId") || crypto.randomUUID(),
    clientId: data.get("clientId"),
    billingId,
    date: data.get("date"),
    amount,
    method: data.get("method"),
    note: data.get("note"),
    externalPaymentId: existingPayment?.externalPaymentId || "",
    paymentSource: existingPayment?.paymentSource || "Manual",
    createdAt: existingPayment?.createdAt || now,
    updatedAt: now
  };
  const index = state.payments.findIndex((item) => item.id === payment.id);
  if (index >= 0) state.payments[index] = payment;
  else state.payments.push(payment);
  updateBillingStatuses();
  event.currentTarget.reset();
  event.currentTarget.closest("dialog").close();
  saveState();
});

document.getElementById("paymentMethodForm").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const method = {
    id: data.get("methodId") || crypto.randomUUID(),
    type: data.get("type"),
    name: data.get("name"),
    details: data.get("details"),
    link: data.get("link"),
    active: data.get("active") === "on"
  };
  const index = state.paymentMethods.findIndex((item) => item.id === method.id);
  if (index >= 0) state.paymentMethods[index] = method;
  else state.paymentMethods.push(method);
  event.currentTarget.reset();
  event.currentTarget.closest("dialog").close();
  saveState();
});

document.getElementById("billingForm").addEventListener("submit", async (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const form = event.currentTarget;
  const dialog = form.closest("dialog");
  const submitButton = event.submitter;
  const data = new FormData(form);
  const clientId = data.get("clientId");
  const startDate = data.get("startDate");
  const endDate = data.get("endDate");
  const billingId = crypto.randomUUID();
  const paymentMethodIds = data.getAll("paymentMethodId");
  if (!paymentMethodIds.length) {
    alert("Selecione pelo menos uma forma de pagamento.");
    return;
  }
  const services = state.services.filter((item) =>
    !item.billingId && item.status !== "Cancelado"
    && item.clientId === clientId && item.date >= startDate && item.date <= endDate);
  const payments = state.payments.filter((item) =>
    !item.billingId && item.clientId === clientId && item.date >= startDate && item.date <= endDate);
  const servicesTotal = services.reduce((sum, item) => sum + item.amount, 0);
  const paymentsTotal = payments.reduce((sum, item) => sum + item.amount, 0);
  const amount = balanceFor(clientId, endDate);
  const pendingServices = services.filter((item) => item.status === "A fazer");
  if (pendingServices.length) {
    const names = pendingServices.slice(0, 5)
      .map((item) => `• ${item.description}${item.reference ? ` (${item.reference})` : ""}`)
      .join("\n");
    const confirmed = confirm(
      `Existem ${pendingServices.length} serviço(s) ainda marcados como "A fazer":\n\n${names}\n\nOK: gerar a cobrança mesmo assim.\nCancelar: voltar e atualizar os status.`
    );
    if (!confirmed) return;
  }

  const billing = {
    id: billingId,
    clientId,
    startDate,
    endDate,
    amount,
    previousBalance: amount - servicesTotal + paymentsTotal,
    servicesTotal,
    paymentsTotal,
    identifier: "",
    password: "",
    status: "Aberta",
    active: true,
    paymentMethodIds,
    paymentMethods: state.paymentMethods
      .filter((method) => paymentMethodIds.includes(method.id))
      .map((method) => ({ ...method })),
    historyEnabled: data.get("historyEnabled") === "on",
    sendHistory: [],
    createdAt: new Date().toISOString()
  };
  state.billings.push(billing);

  submitButton.disabled = true;
  submitButton.textContent = "Gerando acesso...";
  let persisted = false;
  try {
    await window.dataStore.upsertState(state);
    const credentials = await issueClientAccess(billing);
    billing.identifier = credentials.identifier;
    billing.password = credentials.password;
    services.forEach((item) => { item.billingId = billingId; });
    payments.forEach((item) => { item.billingId = billingId; });
    await window.dataStore.upsertState(state);
    persisted = true;
    form.reset();
    dialog.close();
    render();
    alert(`Cobrança criada.\n\nIdentificador: ${billing.identifier}\nSenha: ${billing.password}\n\nA senha será exibida somente agora. O relatório compartilhado não inclui esses dados.`);
  } catch (error) {
    console.error(error);
    if (!persisted) {
      state.billings = state.billings.filter((item) => item.id !== billingId);
      services.forEach((item) => { item.billingId = null; });
      payments.forEach((item) => { item.billingId = null; });
      try {
        await window.dataStore.upsertState(state);
      } catch (rollbackError) {
        console.error("Falha ao desfazer a cobrança incompleta:", rollbackError);
      }
    }
    alert(error.message);
    render();
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Fechar período";
  }
});

document.getElementById("whatsappForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = event.submitter;
  const data = new FormData(form);
  const resultBox = document.getElementById("whatsappConnectionResult");
  const status = document.getElementById("whatsappConnectionStatus");
  const message = document.getElementById("whatsappConnectionMessage");
  const qrCode = document.getElementById("whatsappQrCode");

  button.disabled = true;
  button.textContent = "Conectando...";
  resultBox.classList.remove("hidden");
  status.textContent = "Iniciando sessão";
  message.textContent = "Aguarde a resposta da APIBrasil.";
  qrCode.classList.add("hidden");
  qrCode.removeAttribute("src");

  try {
    await startApiBrasilWhatsApp({
      number: String(data.get("number") || "").replace(/\D/g, ""),
      forceClearCache: data.get("forceClearCache") === "on"
    });
    await pollApiBrasilWhatsApp((result) => {
      const qrCodeSource = apiBrasilQrCode({
        qrcode: result.qr_code
      });
      status.textContent = result.status || "Processando";
      message.textContent = result.message || "Aguardando atualização da APIBrasil.";
      if (qrCodeSource) {
        qrCode.src = qrCodeSource;
        qrCode.classList.remove("hidden");
      }
    });
  } catch (error) {
    console.error(error);
    status.textContent = "Falha ao conectar";
    message.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = "Iniciar sessão";
  }
});

[
  ["clientSearch", "input", renderClients],
  ["priceTableSearch", "input", renderPriceTables],
  ["catalogSearch", "input", renderCatalog],
  ["serviceClientNameFilter", "input", syncServiceClientFilter],
  ["serviceStatusFilter", "change", renderServices],
  ["serviceSearch", "input", renderServices],
  ["paymentClientFilter", "change", renderPayments],
  ["paymentStatusFilter", "change", renderPayments],
  ["paymentStartFilter", "change", renderPayments],
  ["paymentEndFilter", "change", renderPayments],
  ["paymentSearch", "input", renderPayments],
  ["paymentMethodStatusFilter", "change", renderPaymentMethods],
  ["paymentMethodSearch", "input", renderPaymentMethods],
  ["billingClientFilter", "change", renderBillings],
  ["billingSearch", "input", renderBillings]
].forEach(([id, eventName, handler]) => {
  document.getElementById(id).addEventListener(eventName, handler);
});
document.querySelector('#serviceForm input[name="clientSearch"]').addEventListener("input", syncServiceClientSelection);
document.querySelector('#serviceForm input[name="clientSearch"]').addEventListener("change", syncServiceClientSelection);
document.querySelector('#serviceForm input[name="catalogSearch"]').addEventListener("input", syncServiceCatalogSelection);
document.querySelector('#serviceForm input[name="catalogSearch"]').addEventListener("change", syncServiceCatalogSelection);
document.getElementById("addReferenceButton").addEventListener("click", addCurrentReference);
document.querySelector('#serviceForm input[name="hasAdditionalServices"]').addEventListener("change", toggleAdditionalServices);
document.querySelector('#serviceForm input[name="additionalCatalogSearch"]').addEventListener("input", syncAdditionalCatalogSelection);
document.querySelector('#serviceForm input[name="additionalCatalogSearch"]').addEventListener("change", syncAdditionalCatalogSelection);
document.getElementById("addAdditionalServiceButton").addEventListener("click", addAdditionalService);
document.querySelector("[data-cancel-service-entry]").addEventListener("click", () => {
  serviceReferenceValues = [];
  additionalServiceValues = [];
  document.getElementById("serviceForm").reset();
  document.getElementById("serviceDialog").close();
});
document.getElementById("continueEntryDialog").addEventListener("cancel", (event) => {
  event.preventDefault();
  if (!entryContinuationResolver) return;
  const resolve = entryContinuationResolver;
  entryContinuationResolver = null;
  event.currentTarget.close();
  resolve("close");
});

document.getElementById("serviceForm").addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey || event.target.tagName === "BUTTON") return;
  if (event.target.name === "hasAdditionalServices") {
    event.preventDefault();
    return;
  }
  if (event.target.name === "additionalCatalogSearch") {
    event.preventDefault();
    syncAdditionalCatalogSelection();
    event.currentTarget.elements.additionalAmount.focus();
    return;
  }
  if (event.target.name === "additionalAmount") {
    event.preventDefault();
    addAdditionalService();
    return;
  }
  if (event.target.name === "reference") {
    event.preventDefault();
    if (event.target.value.includes("\n")) addCurrentReference();
    event.currentTarget.elements.amount.focus();
    return;
  }
  event.preventDefault();
  const form = event.currentTarget;
  if (event.target.name === "clientSearch") syncServiceClientSelection();
  if (event.target.name === "catalogSearch") syncServiceCatalogSelection();
  const fields = [
    form.elements.clientSearch,
    form.elements.date,
    form.elements.catalogSearch,
    form.elements.reference,
    form.elements.amount,
    form.elements.status
  ];
  const index = fields.indexOf(event.target);
  if (index >= 0 && index < fields.length - 1) {
    fields[index + 1].focus();
    return;
  }
  if (index === fields.length - 1) form.requestSubmit(form.querySelector('button[value="default"]'));
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  document.getElementById("installButton").classList.remove("hidden");
});

document.getElementById("installButton").addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
});

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js");
render();
window.addEventListener("app-authenticated", initializeRemoteState);
