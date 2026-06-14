const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const tokenKey = "gestor_servicos_client_token";
let currentStatement = null;
let portalData = null;
let activeView = "billing";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

function formatDate(value) {
  return value ? value.split("-").reverse().join("/") : "-";
}

function pdfText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function createPdf(data) {
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 42;
  const pages = [];
  let commands = [];
  let y = 800;

  const color = {
    green: "0.086 0.31 0.263",
    blue: "0.176 0.447 0.769",
    payment: "0.094 0.525 0.294",
    orange: "0.812 0.424 0.071",
    gray: "0.455 0.506 0.49",
    dark: "0.12 0.18 0.16"
  };

  function addPage() {
    if (commands.length) pages.push(commands.join("\n"));
    commands = [];
    y = 800;
    commands.push(`${color.green} rg 0 790 ${pageWidth} 52 re f`);
    commands.push("1 1 1 rg BT /F1 17 Tf 42 812 Td (Gestor de Servicos) Tj ET");
    y = 766;
  }

  function text(value, x, size = 10, selectedColor = color.dark, bold = false) {
    commands.push(`${selectedColor} rg BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${pdfText(value)}) Tj ET`);
  }

  function line() {
    commands.push("0.86 0.86 0.83 RG 42 " + (y - 7) + " m 553 " + (y - 7) + " l S");
  }

  function ensureSpace(height = 28) {
    if (y - height < 44) addPage();
  }

  function heading(value) {
    ensureSpace(38);
    y -= 12;
    text(value, margin, 13, color.green, true);
    y -= 12;
    line();
    y -= 18;
  }

  addPage();
  text("Relatorio de cobranca", margin, 9, color.gray, true);
  y -= 25;
  text(data.client.name, margin, 22, color.dark, true);
  y -= 19;
  text(`Periodo: ${formatDate(data.billing.period_start)} a ${formatDate(data.billing.period_end)}`, margin, 10, color.gray);
  y -= 34;

  const cards = [
    ["Saldo anterior", Number(data.billing.previous_balance), color.gray],
    ["Servicos", Number(data.billing.services_total), color.blue],
    ["Pagamentos", Number(data.billing.payments_total), color.payment],
    ["Total em aberto", Number(data.billing.open_amount ?? data.billing.total_due), color.orange]
  ];
  cards.forEach(([label, amount, selectedColor], index) => {
    const x = margin + index * 128;
    commands.push(`${selectedColor} rg ${x} ${y - 36} 116 58 re f`);
    commands.push(`1 1 1 rg BT /F1 8 Tf ${x + 9} ${y + 5} Td (${pdfText(label)}) Tj ET`);
    commands.push(`1 1 1 rg BT /F2 12 Tf ${x + 9} ${y - 17} Td (${pdfText(money.format(amount))}) Tj ET`);
  });
  y -= 72;

  heading("Servicos do periodo");
  if (!data.services.length) {
    text("Nenhum servico neste fechamento.", margin);
    y -= 22;
  } else {
    data.services.forEach((item) => {
      ensureSpace(34);
      text(formatDate(item.service_date), margin, 9, color.gray);
      text(item.service_name, 112, 9, color.dark, true);
      text(item.reference || "-", 315, 9, color.gray);
      text(money.format(Number(item.amount)), 462, 9, color.blue, true);
      y -= 17;
      line();
      y -= 8;
    });
  }

  heading("Pagamentos considerados");
  if (!data.payments.length) {
    text("Nenhum pagamento neste fechamento.", margin);
    y -= 22;
  } else {
    data.payments.forEach((item) => {
      ensureSpace(32);
      text(formatDate(item.payment_date), margin, 9, color.gray);
      text(item.method || item.notes || "-", 145, 9, color.dark);
      text(money.format(Number(item.amount)), 462, 9, color.payment, true);
      y -= 17;
      line();
      y -= 8;
    });
  }

  heading("Formas de pagamento");
  if (!data.paymentMethods.length) {
    text("Consulte as formas de pagamento com o responsavel.", margin);
  } else {
    data.paymentMethods.forEach((method) => {
      ensureSpace(44);
      text(`${method.name} (${method.type})`, margin, 10, color.green, true);
      y -= 15;
      text(method.details || method.payment_link || "-", margin, 9, color.dark);
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

function downloadStatementPdf() {
  if (!currentStatement) return;
  const blob = createPdf(currentStatement);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const clientName = currentStatement.client.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  link.href = url;
  link.setAttribute(
    "aria-label",
    `Abrir cobrança de ${clientName || "cliente"} em PDF`
  );
  link.target = "_blank";
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function request(path, options = {}) {
  const response = await fetch(`/.netlify/functions/${path}`, options);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Não foi possível concluir a operação.");
  return result;
}

function renderStatement(data) {
  currentStatement = data;
  const { client, billing, services, payments, paymentMethods } = data;
  document.getElementById("clientName").textContent = client.name;
  document.getElementById("billingPeriod").textContent =
    `${formatDate(billing.period_start)} a ${formatDate(billing.period_end)}`;

  const serviceRows = services.length
    ? services.map((item) => `<tr class="${item.is_secondary ? "client-secondary-service" : ""}">
        <td>${formatDate(item.service_date)}</td>
        <td>${escapeHtml(item.service_name)}${item.is_secondary ? `<span class="client-secondary-label">Complementar</span>` : ""}</td>
        <td>${escapeHtml(item.reference || "-")}</td>
        <td class="amount-service">${money.format(Number(item.amount))}</td>
      </tr>`).join("")
    : `<tr><td colspan="4">Nenhum serviço neste fechamento.</td></tr>`;
  const paymentRows = payments.length
    ? payments.map((item) => `<tr>
        <td>${formatDate(item.payment_date)}</td>
        <td>${escapeHtml(item.method || item.notes || "-")}</td>
        <td class="amount-payment">${money.format(Number(item.amount))}</td>
      </tr>`).join("")
    : `<tr><td colspan="3">Nenhum pagamento neste fechamento.</td></tr>`;
  const methods = paymentMethods.length
    ? paymentMethods.map((method) => `<article class="payment-option">
        <strong>${escapeHtml(method.name)} (${escapeHtml(method.type)})</strong>
        <span>${escapeHtml(method.details || "")}</span>
        ${method.payment_link ? `<a href="${escapeHtml(method.payment_link)}" target="_blank" rel="noopener">Abrir link de pagamento</a>` : ""}
      </article>`).join("")
    : `<p class="meta">Consulte as formas de pagamento com o responsável.</p>`;

  document.getElementById("statementContent").innerHTML = `
    <div class="client-summary">
      <article class="summary-card summary-previous"><span class="summary-dot"></span><span class="meta">Saldo anterior</span><strong>${money.format(Number(billing.previous_balance))}</strong></article>
      <article class="summary-card summary-services"><span class="summary-dot"></span><span class="meta">Serviços</span><strong>${money.format(Number(billing.services_total))}</strong></article>
      <article class="summary-card summary-payments"><span class="summary-dot"></span><span class="meta">Pagamentos</span><strong>${money.format(Number(billing.payments_total))}</strong></article>
      <article class="summary-card summary-total"><span class="summary-dot"></span><span class="meta">Total em aberto</span><strong>${money.format(Number(billing.open_amount ?? billing.total_due))}</strong></article>
    </div>
    <section class="client-section section-services">
      <h3>Serviços do período</h3>
      <table class="report-table"><thead><tr><th>Data</th><th>Serviço</th><th>Referência</th><th>Valor</th></tr></thead><tbody>${serviceRows}</tbody></table>
    </section>
    <section class="client-section section-payments">
      <h3>Pagamentos considerados</h3>
      <table class="report-table"><thead><tr><th>Data</th><th>Descrição</th><th>Valor</th></tr></thead><tbody>${paymentRows}</tbody></table>
    </section>
    <section class="client-section">
      <h3>Formas de pagamento</h3>
      <div class="payment-options">${methods}</div>
    </section>`;

  document.getElementById("loginPanel").classList.add("hidden");
  document.getElementById("statementPanel").classList.remove("hidden");
  document.getElementById("logoutButton").classList.remove("hidden");
}

function serviceFilters() {
  return {
    start: document.getElementById("currentServiceStart")?.value || "",
    end: document.getElementById("currentServiceEnd")?.value || "",
    status: document.getElementById("currentServiceStatus")?.value || ""
  };
}

function renderCurrentServices(data) {
  const filters = serviceFilters();
  const items = data.currentServices.filter((item) =>
    (!filters.start || item.service_date >= filters.start)
    && (!filters.end || item.service_date <= filters.end)
    && (!filters.status || item.status === filters.status));
  const total = items.reduce((sum, item) => sum + Number(item.amount), 0);
  const rows = items.length ? items.map((item) => `<tr class="${item.is_secondary ? "client-secondary-service" : ""}">
    <td>${formatDate(item.service_date)}</td>
    <td>${escapeHtml(item.service_name)}${item.is_secondary ? `<span class="client-secondary-label">Complementar</span>` : ""}</td>
    <td>${escapeHtml(item.reference || "-")}</td>
    <td><span class="client-status">${escapeHtml(item.status)}</span></td>
    <td class="amount-service">${money.format(Number(item.amount))}</td>
  </tr>`).join("") : `<tr><td colspan="5">Nenhum serviço encontrado.</td></tr>`;

  document.getElementById("clientName").textContent = data.client.name;
  document.getElementById("billingPeriod").textContent = "Serviços ainda não incluídos em uma cobrança";
  document.getElementById("printButton").classList.add("hidden");
  document.getElementById("statementContent").innerHTML = `
    <div class="client-summary current-summary">
      <article class="summary-card summary-services">
        <span class="summary-dot"></span><span class="meta">Consumo ainda não cobrado</span>
        <strong>${money.format(total)}</strong>
      </article>
      <article class="summary-card summary-previous">
        <span class="summary-dot"></span><span class="meta">Quantidade de serviços</span>
        <strong>${items.length}</strong>
      </article>
    </div>
    <section class="client-section section-services">
      <div class="client-section-heading">
        <h3>Consumo atual</h3>
        <div class="client-filters">
          <label>De<input id="currentServiceStart" type="date" value="${filters.start}"></label>
          <label>Até<input id="currentServiceEnd" type="date" value="${filters.end}"></label>
          <label>Status<select id="currentServiceStatus">
            <option value="">Todos</option>
            ${["A fazer", "Feito", "Entregue"].map((status) =>
              `<option value="${status}" ${filters.status === status ? "selected" : ""}>${status}</option>`).join("")}
          </select></label>
        </div>
      </div>
      <table class="report-table"><thead><tr><th>Data</th><th>Serviço</th><th>Referência</th><th>Status</th><th>Valor</th></tr></thead><tbody>${rows}</tbody></table>
    </section>`;
}

function historyFilters() {
  return {
    start: document.getElementById("historyStart")?.value || "",
    end: document.getElementById("historyEnd")?.value || "",
    status: document.getElementById("historyStatus")?.value || ""
  };
}

function renderHistory(data) {
  const filters = historyFilters();
  const items = data.billingHistory.filter((billing) =>
    (!filters.start || billing.period_end >= filters.start)
    && (!filters.end || billing.period_start <= filters.end)
    && (!filters.status || billing.status === filters.status));
  const cards = items.length ? items.map((billing) => `
    <article class="history-card">
      <div>
        <span class="eyebrow">${formatDate(billing.period_start)} a ${formatDate(billing.period_end)}</span>
        <h3>${money.format(Number(billing.total_due))}</h3>
        <span class="client-status">${escapeHtml(billing.status)}</span>
      </div>
      <button class="secondary" type="button" data-open-history="${billing.id}">Ver cobrança</button>
    </article>`).join("") : `<div class="empty-state">Nenhuma cobrança anterior encontrada.</div>`;

  document.getElementById("clientName").textContent = data.client.name;
  document.getElementById("billingPeriod").textContent = "Cobranças anteriores autorizadas pelo administrador";
  document.getElementById("printButton").classList.add("hidden");
  document.getElementById("statementContent").innerHTML = `
    <section class="client-section history-section">
      <div class="client-section-heading">
        <h3>Histórico de cobranças</h3>
        <div class="client-filters">
          <label>De<input id="historyStart" type="date" value="${filters.start}"></label>
          <label>Até<input id="historyEnd" type="date" value="${filters.end}"></label>
          <label>Status<select id="historyStatus">
            <option value="">Todos</option>
            ${["Aberta", "Parcial", "Paga"].map((status) =>
              `<option value="${status}" ${filters.status === status ? "selected" : ""}>${status}</option>`).join("")}
          </select></label>
        </div>
      </div>
      <div class="history-list">${cards}</div>
    </section>`;
}

function selectView(view) {
  activeView = view;
  document.querySelectorAll("[data-client-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.clientView === view);
  });
  if (view === "current-services") renderCurrentServices(portalData);
  else if (view === "history") renderHistory(portalData);
  else {
    document.getElementById("printButton").classList.remove("hidden");
    renderStatement(currentStatement);
  }
}

async function loadStatement(billingId = "") {
  const token = sessionStorage.getItem(tokenKey);
  if (!token) return;
  try {
    const query = billingId ? `?billingId=${encodeURIComponent(billingId)}` : "";
    const data = await request(`client-statement${query}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    portalData = data;
    document.getElementById("historyTab").classList.toggle("hidden", !data.historyEnabled);
    renderStatement(data);
    selectView("billing");
  } catch {
    sessionStorage.removeItem(tokenKey);
  }
}

async function loginFromAutomaticLink() {
  const accessCode = new URLSearchParams(location.search).get("access");
  if (!accessCode) return false;
  const error = document.getElementById("loginError");
  error.textContent = "Abrindo sua cobrança...";
  try {
    const result = await request("client-magic-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessCode })
    });
    sessionStorage.setItem(tokenKey, result.token);
    history.replaceState({}, "", `${location.pathname}${location.hash}`);
    await loadStatement();
    return true;
  } catch (requestError) {
    history.replaceState({}, "", `${location.pathname}${location.hash}`);
    error.textContent = requestError.message;
    return false;
  }
}

document.getElementById("clientLoginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.submitter;
  const error = document.getElementById("loginError");
  const data = new FormData(event.currentTarget);
  error.textContent = "";
  button.disabled = true;
  button.textContent = "Entrando...";
  try {
    const result = await request("client-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: data.get("identifier"),
        password: data.get("password")
      })
    });
    sessionStorage.setItem(tokenKey, result.token);
    await loadStatement();
  } catch (requestError) {
    error.textContent = requestError.message;
  } finally {
    button.disabled = false;
    button.textContent = "Entrar";
  }
});

document.getElementById("logoutButton").addEventListener("click", () => {
  sessionStorage.removeItem(tokenKey);
  location.reload();
});
document.getElementById("printButton").addEventListener("click", downloadStatementPdf);
document.getElementById("clientPortalNav").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-client-view]");
  if (!button || !portalData) return;
  if (button.dataset.clientView === "billing"
      && currentStatement?.billing.id !== portalData.accessBillingId) {
    await loadStatement(portalData.accessBillingId);
    return;
  }
  selectView(button.dataset.clientView);
});
document.getElementById("statementContent").addEventListener("click", async (event) => {
  const historyButton = event.target.closest("[data-open-history]");
  if (historyButton) await loadStatement(historyButton.dataset.openHistory);
});
document.getElementById("statementContent").addEventListener("change", () => {
  if (activeView === "current-services") renderCurrentServices(portalData);
  if (activeView === "history") renderHistory(portalData);
});

loginFromAutomaticLink().then((loggedIn) => {
  if (!loggedIn) loadStatement();
});
