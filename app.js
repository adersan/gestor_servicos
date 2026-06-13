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
  const debits = state.services.filter(allowed).reduce((sum, item) => sum + item.amount, 0);
  const credits = state.payments.filter(allowed).reduce((sum, item) => sum + item.amount, 0);
  return debits - credits;
}

function showView(viewId) {
  document.querySelectorAll(".view, .tab").forEach((element) => element.classList.remove("active"));
  document.getElementById(viewId).classList.add("active");
  document.querySelector(`[data-view="${viewId}"]`).classList.add("active");
}

function emptyMarkup() {
  return document.getElementById("emptyTemplate").innerHTML;
}

function renderSelects() {
  const options = state.clients.map((client) => `<option value="${client.id}">${escapeHtml(client.name)}</option>`).join("");
  document.querySelectorAll('select[name="clientId"]').forEach((select) => {
    const current = select.value;
    select.innerHTML = `<option value="">Selecione</option>${options}`;
    select.value = current;
  });
  const filter = document.getElementById("serviceClientFilter");
  const currentFilter = filter.value;
  filter.innerHTML = `<option value="">Todos os clientes</option>${options}`;
  filter.value = currentFilter;

  const catalogSelect = document.querySelector('#serviceForm select[name="catalogId"]');
  const selectedCatalog = catalogSelect.value;
  catalogSelect.innerHTML = `<option value="">Selecione</option>${state.catalog
    .map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`)
    .join("")}`;
  catalogSelect.value = selectedCatalog;

  const priceGroupSelect = document.querySelector('#clientForm select[name="priceGroup"]');
  const selectedPriceGroup = priceGroupSelect.value;
  priceGroupSelect.innerHTML = `<option value="">Selecione</option>${state.priceTables
    .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
    .join("")}`;
  priceGroupSelect.value = selectedPriceGroup;
}

function renderCatalog() {
  const target = document.getElementById("catalogTable");
  const header = state.priceTables.map((name) => `<th>${escapeHtml(name)}</th>`).join("");
  const rows = state.catalog.length ? state.catalog
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .map((item) => `
      <tr>
        <td><strong>${escapeHtml(item.name)}</strong></td>
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
  target.innerHTML = state.priceTables.length ? state.priceTables.map((name) => {
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
  const serviceTotal = state.services.reduce((sum, item) => sum + item.amount, 0);
  const paymentTotal = state.payments.reduce((sum, item) => sum + item.amount, 0);
  document.getElementById("totalOpen").textContent = money.format(serviceTotal - paymentTotal);
  document.getElementById("clientCount").textContent = state.clients.length;
  document.getElementById("serviceTotal").textContent = money.format(serviceTotal);
  document.getElementById("paymentTotal").textContent = money.format(paymentTotal);
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

function renderClients() {
  const target = document.getElementById("clientList");
  target.innerHTML = state.clients.length ? state.clients.map((client) => `
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
  const search = document.getElementById("serviceSearch").value.trim().toLowerCase();
  const items = state.services
    .filter((item) => !clientFilter || item.clientId === clientFilter)
    .filter((item) => !search || `${item.description} ${item.reference}`.toLowerCase().includes(search))
    .sort((a, b) => b.date.localeCompare(a.date));
  document.getElementById("serviceList").innerHTML = items.length ? items.map((item) => `
    <article class="timeline-item">
      <time>${dateFormat.format(new Date(`${item.date}T00:00:00Z`))}</time>
      <div><h3>${escapeHtml(item.description)}</h3><p class="meta">${escapeHtml(clientById(item.clientId)?.name || "")} · ${escapeHtml(item.reference || "Sem referência")}</p><span class="status">${escapeHtml(item.status)}</span></div>
      <strong>${money.format(item.amount)}</strong>
      <div class="row-actions"><button class="table-action" data-edit-entry="${item.id}">Editar</button><button class="table-action danger" data-delete-entry="${item.id}">Excluir</button></div>
    </article>`).join("") : emptyMarkup();
}

function renderPayments() {
  const items = [...state.payments].sort((a, b) => b.date.localeCompare(a.date));
  document.getElementById("paymentList").innerHTML = items.length ? items.map((item) => `
    <article class="timeline-item">
      <time>${dateFormat.format(new Date(`${item.date}T00:00:00Z`))}</time>
      <div><h3>${escapeHtml(clientById(item.clientId)?.name || "")}</h3><p class="meta">${escapeHtml(item.note || "Pagamento registrado")}</p></div>
      <strong>${money.format(item.amount)}</strong>
      <div class="row-actions"><button class="table-action" data-edit-payment="${item.id}">Editar</button><button class="table-action danger" data-delete-payment="${item.id}">Excluir</button></div>
    </article>`).join("") : emptyMarkup();
}

function renderPaymentMethods() {
  const target = document.getElementById("paymentMethodList");
  target.innerHTML = state.paymentMethods.length ? state.paymentMethods.map((method) => `
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
  const items = [...state.billings].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  document.getElementById("billingList").innerHTML = items.length ? items.map((item) => `
    <article class="billing-card">
      <span class="eyebrow">${item.startDate.split("-").reverse().join("/")} a ${item.endDate.split("-").reverse().join("/")}</span>
      <h3>${escapeHtml(clientById(item.clientId)?.name || "")}</h3>
      <p class="meta">Total fechado</p>
      <strong class="hero-value" style="font-size:30px">${money.format(item.amount)}</strong>
      <div class="access-box">${item.identifier
        ? `ID: ${item.identifier}<br>Senha: ${item.password || "gerada e enviada na criação"}`
        : "Acesso do cliente ainda não gerado."}</div>
      <div class="card-actions">
        <button class="table-action" data-view-report="${item.id}">Ver relatório</button>
        <button class="table-action" data-copy-whatsapp="${item.id}">WhatsApp</button>
      </div>
    </article>`).join("") : emptyMarkup();
}

function render() {
  renderSelects();
  renderDashboard();
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
  form.elements.name.value = item?.name || "";
  renderCatalogPriceFields(item);
  document.getElementById("catalogDialogTitle").textContent = item ? "Editar serviço" : "Novo serviço";
  document.getElementById("catalogDialog").showModal();
}

function openEntryForm(item = null) {
  const form = document.getElementById("serviceForm");
  form.reset();
  form.elements.entryId.value = item?.id || "";
  form.elements.clientId.value = item?.clientId || "";
  form.elements.date.value = item?.date || new Date().toISOString().slice(0, 10);
  form.elements.catalogId.value = item?.catalogId || "";
  form.elements.reference.value = item?.reference || "";
  form.elements.amount.value = item ? Number(item.amount).toFixed(2) : "";
  form.elements.status.value = item?.status || "A fazer";
  document.getElementById("serviceDialogTitle").textContent = item ? "Editar lançamento" : "Novo lançamento";
  document.getElementById("suggestedPrice").textContent = item
    ? "O valor pode ser alterado somente neste lançamento."
    : "Selecione o cliente e o serviço para preencher o valor.";
  document.getElementById("serviceDialog").showModal();
}

function openPaymentForm(item = null) {
  const form = document.getElementById("paymentForm");
  form.reset();
  form.elements.paymentId.value = item?.id || "";
  form.elements.clientId.value = item?.clientId || "";
  form.elements.date.value = item?.date || new Date().toISOString().slice(0, 10);
  form.elements.amount.value = item ? Number(item.amount).toFixed(2) : "";
  form.elements.note.value = item?.note || "";
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

function openBillingReport(billingId) {
  const billing = state.billings.find((item) => item.id === billingId);
  const client = clientById(billing.clientId);
  const details = billingDetails(billing);
  const maxValue = Math.max(details.serviceTotal, details.paymentTotal, Math.abs(details.previousBalance), 1);
  const methods = state.paymentMethods.filter((method) => method.active);
  const serviceRows = details.services.length ? details.services.map((item) => `
    <tr><td>${item.date.split("-").reverse().join("/")}</td><td>${escapeHtml(item.description)}</td><td>${escapeHtml(item.reference || "-")}</td><td>${money.format(item.amount)}</td></tr>
  `).join("") : `<tr><td colspan="4">Nenhum serviço neste período.</td></tr>`;
  const methodRows = methods.length ? methods.map((method) => `
    <div class="payment-option">
      <strong>${escapeHtml(method.name)} (${escapeHtml(method.type)})</strong>
      <span>${escapeHtml(method.details || "")}</span>
      ${method.link ? `<br><a href="${escapeHtml(method.link)}" target="_blank">Abrir link de pagamento</a>` : ""}
    </div>`).join("") : `<p class="meta">Nenhuma forma de pagamento ativa.</p>`;

  document.getElementById("reportContent").innerHTML = `<section class="report">
    <div class="report-actions">
      <button class="primary" data-print-report>Imprimir / Salvar PDF</button>
      <button class="secondary" data-copy-whatsapp="${billing.id}">Copiar mensagem do WhatsApp</button>
      <button class="icon-button" data-close-report>×</button>
    </div>
    <header class="report-header">
      <div><span class="eyebrow">Relatório de cobrança</span><h2>${escapeHtml(client?.name || "")}</h2><p class="meta">${billing.startDate.split("-").reverse().join("/")} a ${billing.endDate.split("-").reverse().join("/")}</p></div>
      <div><span class="meta">Total em aberto</span><strong class="hero-value" style="font-size:36px">${money.format(billing.amount)}</strong></div>
    </header>
    <div class="report-summary">
      <article><span class="meta">Saldo anterior</span><strong>${money.format(details.previousBalance)}</strong></article>
      <article><span class="meta">Serviços</span><strong>${money.format(details.serviceTotal)}</strong></article>
      <article><span class="meta">Pagamentos</span><strong>${money.format(details.paymentTotal)}</strong></article>
    </div>
    <h3>Resumo gráfico</h3>
    <div class="chart">
      <div class="chart-row"><span>Saldo anterior</span><div class="chart-track"><div class="chart-bar" style="width:${Math.abs(details.previousBalance) / maxValue * 100}%"></div></div><strong>${money.format(details.previousBalance)}</strong></div>
      <div class="chart-row"><span>Serviços</span><div class="chart-track"><div class="chart-bar" style="width:${details.serviceTotal / maxValue * 100}%"></div></div><strong>${money.format(details.serviceTotal)}</strong></div>
      <div class="chart-row"><span>Pagamentos</span><div class="chart-track"><div class="chart-bar credit" style="width:${details.paymentTotal / maxValue * 100}%"></div></div><strong>${money.format(details.paymentTotal)}</strong></div>
    </div>
    <h3>Serviços do período</h3>
    <table class="report-table"><thead><tr><th>Data</th><th>Serviço</th><th>Referência</th><th>Valor</th></tr></thead><tbody>${serviceRows}</tbody></table>
    <h3>Formas de pagamento</h3>
    <div class="payment-options">${methodRows}</div>
    <div class="access-box">Acesso do cliente — Identificador: ${billing.identifier || "não gerado"} | Senha: ${billing.password || "exibida somente ao gerar o acesso"}</div>
  </section>`;
  document.getElementById("reportDialog").showModal();
}

function whatsappMessage(billing) {
  const client = clientById(billing.clientId);
  const methods = state.paymentMethods.filter((method) => method.active)
    .map((method) => `${method.name}: ${method.details || method.link || "Consulte as instruções no relatório"}`)
    .join("\n");
  const portalUrl = `${location.origin}/cliente.html`;
  return `Olá, ${client?.name || ""}!\n\nSua cobrança de ${billing.startDate.split("-").reverse().join("/")} a ${billing.endDate.split("-").reverse().join("/")} foi gerada.\n\nTotal em aberto: ${money.format(billing.amount)}\n\nFormas de pagamento:\n${methods}\n\nAcesse seu relatório:\n${portalUrl}\nIdentificador: ${billing.identifier}\nSenha: ${billing.password || "solicite um novo acesso"}\n\nO PDF detalhado seguirá junto com esta mensagem.`;
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
    body: JSON.stringify({ clientId: billing.clientId, billingId: billing.id })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Não foi possível gerar o acesso do cliente.");
  return result;
}

document.addEventListener("click", (event) => {
  const tab = event.target.closest("[data-view]");
  const opener = event.target.closest("[data-open-view]");
  const dialogButton = event.target.closest("[data-dialog]");
  if (tab) showView(tab.dataset.view);
  if (opener) showView(opener.dataset.openView);
  if (dialogButton) {
    if (dialogButton.dataset.dialog === "clientDialog") openClientForm();
    else if (dialogButton.dataset.dialog === "catalogDialog") openCatalogForm();
    else if (dialogButton.dataset.dialog === "serviceDialog") openEntryForm();
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
      document.getElementById(dialogButton.dataset.dialog).showModal();
    }
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
  const deleteEntry = event.target.closest("[data-delete-entry]");
  if (deleteEntry && confirm("Excluir este lançamento?")) {
    state.services = state.services.filter((item) => item.id !== deleteEntry.dataset.deleteEntry);
    saveState();
  }

  const editPayment = event.target.closest("[data-edit-payment]");
  if (editPayment) openPaymentForm(state.payments.find((item) => item.id === editPayment.dataset.editPayment));
  const deletePayment = event.target.closest("[data-delete-payment]");
  if (deletePayment && confirm("Excluir este pagamento?")) {
    state.payments = state.payments.filter((item) => item.id !== deletePayment.dataset.deletePayment);
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
  if (event.target.closest("[data-close-report]")) document.getElementById("reportDialog").close();
  if (event.target.closest("[data-print-report]")) window.print();
  const whatsappButton = event.target.closest("[data-copy-whatsapp]");
  if (whatsappButton) {
    const billing = state.billings.find((item) => item.id === whatsappButton.dataset.copyWhatsapp);
    navigator.clipboard.writeText(whatsappMessage(billing))
      .then(() => alert("Mensagem copiada. O envio automático será conectado à API do WhatsApp."))
      .catch(() => alert(whatsappMessage(billing)));
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
  const item = {
    id: data.get("catalogId") || crypto.randomUUID(),
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

document.getElementById("serviceForm").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const catalogItem = state.catalog.find((item) => item.id === data.get("catalogId"));
  const entry = {
    id: data.get("entryId") || crypto.randomUUID(),
    clientId: data.get("clientId"),
    catalogId: data.get("catalogId"),
    date: data.get("date"),
    description: catalogItem.name,
    reference: data.get("reference"),
    amount: Number(data.get("amount")),
    status: data.get("status")
  };
  const index = state.services.findIndex((item) => item.id === entry.id);
  if (index >= 0) state.services[index] = entry;
  else state.services.push(entry);
  event.currentTarget.reset();
  event.currentTarget.closest("dialog").close();
  saveState();
});

document.getElementById("paymentForm").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const payment = {
    id: data.get("paymentId") || crypto.randomUUID(),
    clientId: data.get("clientId"),
    date: data.get("date"),
    amount: Number(data.get("amount")),
    note: data.get("note")
  };
  const index = state.payments.findIndex((item) => item.id === payment.id);
  if (index >= 0) state.payments[index] = payment;
  else state.payments.push(payment);
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
  const data = new FormData(event.currentTarget);
  const clientId = data.get("clientId");
  const startDate = data.get("startDate");
  const endDate = data.get("endDate");
  const billingId = crypto.randomUUID();
  const services = state.services.filter((item) =>
    !item.billingId && item.clientId === clientId && item.date >= startDate && item.date <= endDate);
  const payments = state.payments.filter((item) =>
    !item.billingId && item.clientId === clientId && item.date >= startDate && item.date <= endDate);
  const servicesTotal = services.reduce((sum, item) => sum + item.amount, 0);
  const paymentsTotal = payments.reduce((sum, item) => sum + item.amount, 0);
  const amount = balanceFor(clientId, endDate);

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
    createdAt: new Date().toISOString()
  };
  state.billings.push(billing);

  const submitButton = event.submitter;
  submitButton.disabled = true;
  submitButton.textContent = "Gerando acesso...";
  try {
    await window.dataStore.upsertState(state);
    const credentials = await issueClientAccess(billing);
    billing.identifier = credentials.identifier;
    billing.password = credentials.password;
    services.forEach((item) => { item.billingId = billingId; });
    payments.forEach((item) => { item.billingId = billingId; });
    await window.dataStore.upsertState(state);
    event.currentTarget.reset();
    event.currentTarget.closest("dialog").close();
    render();
    alert(`Cobrança criada.\n\nIdentificador: ${billing.identifier}\nSenha: ${billing.password}\n\nA senha será exibida somente agora e na mensagem copiada antes de recarregar.`);
  } catch (error) {
    console.error(error);
    state.billings = state.billings.filter((item) => item.id !== billingId);
    try {
      await window.dataStore.upsertState(state);
    } catch (rollbackError) {
      console.error("Falha ao desfazer a cobrança incompleta:", rollbackError);
    }
    alert(error.message);
    render();
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Fechar período";
  }
});

document.getElementById("serviceClientFilter").addEventListener("change", renderServices);
document.getElementById("serviceSearch").addEventListener("input", renderServices);
document.querySelector('#serviceForm select[name="clientId"]').addEventListener("change", updateSuggestedPrice);
document.querySelector('#serviceForm select[name="catalogId"]').addEventListener("change", updateSuggestedPrice);

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
