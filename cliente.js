const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const tokenKey = "gestor_servicos_client_token";
let currentStatement = null;
let portalData = null;
let activeView = "billing";
let clientRefreshInProgress = false;

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

function searchableText(...values) {
  return values.join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function serviceStatusData(status) {
  if (status === "Pronto" || status === "Feito") return { label: "Feito", className: "done" };
  if (status === "Entregue") return { label: "Entregue", className: "delivered" };
  if (status === "Cancelado") return { label: "Cancelado", className: "cancelled" };
  return { label: "A fazer", className: "pending" };
}

function serviceStatusChip(status) {
  const data = serviceStatusData(status);
  return `<span class="client-status client-status-${data.className}">${escapeHtml(data.label)}</span>`;
}

function referenceChip(reference) {
  return `<span class="client-reference-chip">${escapeHtml(reference || "Sem referencia")}</span>`;
}

function complementaryLabel(item) {
  return item.is_secondary
    ? `<span class="client-secondary-label">Complementar vinculado ao serviço original</span>`
    : "";
}

function originCancelledNote(item, primary = null) {
  const note = String(item.notes || "");
  const reason = note.match(/cancelad[ao] por:\s*(.+)$/i)?.[1]
    || note.match(/origem cancelada motivo:\s*(.+)$/i)?.[1]
    || item.cancellation_reason
    || primary?.cancellation_reason
    || "";
  if (!reason) return "";
  const originName = primary?.status === "Cancelado"
    ? primary.service_name
    : note.match(/^(.+?) cancelad[ao] por:/i)?.[1];
  const message = originName
    ? `${originName} cancelado por ${reason}`
    : `Servico de origem cancelado por ${reason}`;
  return `<em class="client-origin-cancelled-note">${escapeHtml(message)}</em>`;
}

function groupPortalServices(services) {
  const byId = new Map(services.map((item) => [item.id, { primary: item, secondaries: [] }]));
  const groups = [];
  services.forEach((item) => {
    if (item.is_secondary && item.primary_entry_id && byId.has(item.primary_entry_id)) {
      byId.get(item.primary_entry_id).secondaries.push(item);
      return;
    }
    if (!item.is_secondary) groups.push(byId.get(item.id));
    else groups.push({ primary: item, secondaries: [] });
  });
  return groups;
}

function groupedServiceName(primary, secondaries) {
  return `${escapeHtml(primary.service_name)}${secondaries.length ? `<div class="client-complement-list">${secondaries.map((item) => `<span>${escapeHtml(item.service_name)} &middot; ${money.format(Number(item.amount))}${originCancelledNote(item, primary)}</span>`).join("")}</div>` : originCancelledNote(primary)}`;
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
  const paymentTotal = (data.payments || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
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

  heading("Formas de pagamento");
  if (!data.paymentMethods.length) {
    text("Consulte as formas de pagamento com o responsavel.", margin);
    y -= 24;
  } else {
    data.paymentMethods.forEach((method) => {
      ensureSpace(44);
      text(`${method.name} (${method.type})`, margin, 10, color.green, true);
      y -= 15;
      text(method.details || method.payment_link || "-", margin, 9, color.dark);
      y -= 24;
    });
  }

  const cards = [
    ["Saldo anterior", Number(data.billing.previous_balance), color.gray],
    ["Servicos", Number(data.billing.services_total), color.blue],
    ["Pagamentos", paymentTotal, color.payment],
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
    const columnWidth = 510;
    ensureSpace(28);
    commands.push(`0.91 0.94 0.93 rg ${margin} ${y - 15} ${columnWidth} 22 re f`);
    commands.push(`${color.dark} rg BT /F2 7 Tf ${margin + 6} ${y - 2} Td (Data) Tj ET`);
    commands.push(`${color.dark} rg BT /F2 7 Tf ${margin + 70} ${y - 2} Td (Servico) Tj ET`);
    commands.push(`${color.dark} rg BT /F2 7 Tf ${margin + 360} ${y - 2} Td (Referencia) Tj ET`);
    commands.push(`${color.dark} rg BT /F2 7 Tf ${margin + 455} ${y - 2} Td (Valor) Tj ET`);
    y -= 27;
    for (const item of data.services) {
      const description = String(item.service_name || "").slice(0, 55);
      const reference = String(item.reference || "-");
      const referenceLines = reference.match(/.{1,18}/g) || ["-"];
      const rowHeight = 27 + Math.max(0, referenceLines.length - 1) * 12;
      ensureSpace(rowHeight);
      const rowY = y;
      commands.push(`0.97 0.98 0.97 rg ${margin} ${rowY - rowHeight + 11} ${columnWidth} ${rowHeight - 4} re f`);
      commands.push(`${color.gray} rg BT /F1 7.5 Tf ${margin + 5} ${rowY - 3} Td (${pdfText(formatDate(item.service_date))}) Tj ET`);
      commands.push(`${color.dark} rg BT /F1 8.5 Tf ${margin + 70} ${rowY - 3} Td (${pdfText(description)}) Tj ET`);
      referenceLines.forEach((line, index) => commands.push(`${color.gray} rg BT /F2 8 Tf ${margin + 360} ${rowY - 3 - index * 12} Td (${pdfText(line)}) Tj ET`));
      commands.push(`${color.blue} rg BT /F2 8 Tf ${margin + 447} ${rowY - 3} Td (${pdfText(money.format(Number(item.amount)))}) Tj ET`);
      y -= rowHeight;
    }
  }

  heading("Pagamentos");
  if (!data.payments.length) {
    text("Nenhum pagamento registrado.", margin);
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

async function fetchWithTimeout(url, options, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("O acesso demorou demais para responder. Tente novamente.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function request(path, options = {}) {
  const response = await fetchWithTimeout(`/.netlify/functions/${path}`, options);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Não foi possível concluir a operação.");
  return result;
}

function renderStatement(data) {
  currentStatement = data;
  const { client, billing, services, payments, paymentMethods } = data;
  const paymentTotal = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  document.getElementById("clientName").textContent = client.name;
  document.getElementById("billingPeriod").textContent =
    `${formatDate(billing.period_start)} a ${formatDate(billing.period_end)}`;

  function serviceTable(items) {
    const rows = items.map(({ primary: item, secondaries }) => `<tr class="${secondaries.length ? "client-secondary-service" : ""}">
      <td>${formatDate(item.service_date)}</td>
      <td title="${escapeHtml(item.service_name)}">${groupedServiceName(item, secondaries)}${secondaries.length ? `<span class="client-secondary-label">Complementar vinculado ao serviÃ§o original</span>` : complementaryLabel(item)}</td>
      <td title="${escapeHtml(item.reference || "-")}">${referenceChip(item.reference || "-")}</td>
      <td>${serviceStatusChip(item.status)}</td>
      <td class="amount-service">${money.format([item, ...secondaries].reduce((sum, service) => sum + Number(service.amount), 0))}</td>
    </tr>`).join("");
    return `<table class="client-report-service-table">
      <thead><tr><th>Data</th><th>Serviço</th><th>Ref</th><th>Status</th><th>Valor</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="5">-</td></tr>`}</tbody>
    </table>`;
  }
  const serviceGroups = groupPortalServices(services);
  const serviceRows = serviceGroups.length
    ? serviceTable(serviceGroups)
    : `<p class="meta">Nenhum serviço neste fechamento.</p>`;
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
        ${String(method.type || "").toUpperCase().includes("PIX") && method.details ? `<button class="copy-pix-button" type="button" data-copy-pix="${escapeHtml(method.details.includes(":") ? method.details.split(":").pop().trim() : method.details.trim())}">Copiar chave PIX</button>` : ""}
        ${method.payment_link ? `<a href="${escapeHtml(method.payment_link)}" target="_blank" rel="noopener">Abrir link de pagamento</a>` : ""}
      </article>`).join("")
    : `<p class="meta">Consulte as formas de pagamento com o responsável.</p>`;
  const maxValue = Math.max(
    Number(billing.services_total),
    paymentTotal,
    Math.abs(Number(billing.previous_balance)),
    1
  );

  document.getElementById("statementContent").innerHTML = `
    <section class="client-section payment-methods-first">
      <h3>Formas de pagamento</h3>
      <div class="payment-options">${methods}</div>
    </section>
    <div class="client-summary">
      <article class="summary-card summary-previous"><span class="summary-dot"></span><span class="meta">Saldo anterior</span><strong>${money.format(Number(billing.previous_balance))}</strong></article>
      <article class="summary-card summary-services"><span class="summary-dot"></span><span class="meta">Serviços</span><strong>${money.format(Number(billing.services_total))}</strong></article>
      <article class="summary-card summary-payments"><span class="summary-dot"></span><span class="meta">Pagamentos</span><strong>${money.format(paymentTotal)}</strong></article>
      <article class="summary-card summary-total"><span class="summary-dot"></span><span class="meta">Total em aberto</span><strong>${money.format(Number(billing.open_amount ?? billing.total_due))}</strong></article>
    </div>
    <section class="client-section section-chart">
      <h3>Resumo gráfico</h3>
      <div class="client-chart">
        <div class="client-chart-row"><span>Saldo anterior</span><div><i style="width:${Math.abs(Number(billing.previous_balance)) / maxValue * 100}%"></i></div><strong>${money.format(Number(billing.previous_balance))}</strong></div>
        <div class="client-chart-row"><span>Serviços</span><div><i style="width:${Number(billing.services_total) / maxValue * 100}%"></i></div><strong>${money.format(Number(billing.services_total))}</strong></div>
        <div class="client-chart-row"><span>Pagamentos</span><div><i class="payment" style="width:${paymentTotal / maxValue * 100}%"></i></div><strong>${money.format(paymentTotal)}</strong></div>
      </div>
    </section>
    <section class="client-section section-services">
      <h3>Serviços do período</h3>
      <div class="client-report-service-grid">${serviceRows}</div>
    </section>
    <section class="client-section section-payments">
      <h3>Pagamentos</h3>
      <table class="report-table"><thead><tr><th>Data</th><th>Descrição</th><th>Valor</th></tr></thead><tbody>${paymentRows}</tbody></table>
    </section>`;

  document.getElementById("loginPanel").classList.add("hidden");
  document.getElementById("statementPanel").classList.remove("hidden");
  document.getElementById("logoutButton").classList.remove("hidden");
}

function serviceFilters() {
  return {
    start: document.getElementById("currentServiceStart")?.value || "",
    end: document.getElementById("currentServiceEnd")?.value || "",
    status: document.getElementById("currentServiceStatus")?.value || "",
    search: document.getElementById("currentServiceSearch")?.value || ""
  };
}

function renderCurrentServices(data) {
  const filters = serviceFilters();
  const items = data.currentServices.filter((item) =>
    (!filters.start || item.service_date >= filters.start)
    && (!filters.end || item.service_date <= filters.end)
    && (!filters.status || item.status === filters.status)
    && (!filters.search || searchableText(item.service_name, item.reference, item.status).includes(searchableText(filters.search))));
  const serviceGroups = groupPortalServices(items);
  const total = items.reduce((sum, item) => sum + Number(item.amount), 0);
  const rows = serviceGroups.length ? serviceGroups.map(({ primary: item, secondaries }) => `<tr class="${secondaries.length ? "client-secondary-service" : ""}">
    <td>${formatDate(item.service_date)}</td>
    <td>${groupedServiceName(item, secondaries)}${secondaries.length ? `<span class="client-secondary-label">Complementar vinculado ao servi\u00E7o original</span>` : complementaryLabel(item)}</td>
    <td>${referenceChip(item.reference || "-")}</td>
    <td>${serviceStatusChip(item.status)}</td>
    <td class="amount-service">${money.format([item, ...secondaries].reduce((sum, service) => sum + Number(service.amount), 0))}</td>
  </tr>`).join("") : `<tr><td colspan="5">Nenhum servi\u00E7o encontrado.</td></tr>`;

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
          <label>Buscar<input id="currentServiceSearch" type="search" value="${escapeHtml(filters.search)}" placeholder="Placa ou serviço"></label>
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

function renderClientRequest(data) {
  const services = data.requestServices || [];
  const requests = data.serviceRequests || [];
  const selectedService = services[0];
  const options = services.length
    ? services.map((service) => `<option value="${escapeHtml(service.id)}" data-amount="${Number(service.amount || 0)}">${escapeHtml(service.code ? `${service.code} - ${service.name}` : service.name)}</option>`).join("")
    : `<option value="">Nenhum serviço disponível</option>`;
  const history = requests.length ? requests.slice(0, 8).map((item) => `
    <article class="client-request-history-card">
      <div><strong>${escapeHtml(item.service_name)}</strong><span>${formatDate(item.requested_date)} · ${escapeHtml(item.status)}</span></div>
      <p>${(item.references || []).map((reference) => `<span>${escapeHtml(reference)}</span>`).join("")}</p>
    </article>`).join("") : `<div class="empty-state">Nenhum pedido enviado por este acesso.</div>`;

  document.getElementById("clientName").textContent = data.client.name;
  document.getElementById("billingPeriod").textContent = "Envie pedidos simples para o administrador";
  document.getElementById("printButton").classList.add("hidden");
  document.getElementById("statementContent").innerHTML = `
    <section class="client-section client-request-section">
      <div class="client-section-heading">
        <div><h3>Novo pedido de serviço</h3><p class="meta">A data é registrada automaticamente como hoje.</p></div>
      </div>
      <form id="clientRequestForm" class="client-request-form">
        <label>Data do pedido<input name="requestedDate" type="date" value="${new Date().toISOString().slice(0, 10)}" readonly></label>
        <label>Serviço<select name="serviceId" required>${options}</select></label>
        <label>Valor<input name="amount" type="text" value="${money.format(Number(selectedService?.amount || 0))}" readonly></label>
        <label>Placa/referência<textarea name="references" rows="5" required placeholder="Uma por linha. Ex.:&#10;ABC1D23&#10;DEF4G56"></textarea></label>
        <label>Quem solicitou<input name="requestedBy" placeholder="Nome do solicitante"></label>
        <label>Observação<textarea name="notes" rows="3" placeholder="Detalhes importantes do pedido"></textarea></label>
        <p id="clientRequestMessage" class="form-message" role="status"></p>
        <div class="client-request-actions">
          <button class="secondary" type="reset">Cancelar</button>
          <button class="primary" type="submit" ${services.length ? "" : "disabled"}>Salvar pedido</button>
        </div>
      </form>
    </section>
    <section class="client-section client-request-history">
      <h3>Pedidos enviados</h3>
      <div class="client-request-history-list">${history}</div>
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
  else if (view === "request") renderClientRequest(portalData);
  else if (view === "history") renderHistory(portalData);
  else {
    document.getElementById("printButton").classList.remove("hidden");
    renderStatement(currentStatement);
  }
}

async function loadStatement(billingId = "") {
  const token = sessionStorage.getItem(tokenKey);
  if (!token) return false;
  try {
    const query = billingId ? `?billingId=${encodeURIComponent(billingId)}` : "";
    const data = await request(`client-statement${query}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    portalData = data;
    document.getElementById("historyTab").classList.toggle("hidden", !data.historyEnabled);
    renderStatement(data);
    selectView("billing");
    return true;
  } catch (error) {
    sessionStorage.removeItem(tokenKey);
    throw error;
  }
}

async function refreshClientPortal() {
  if (clientRefreshInProgress || !sessionStorage.getItem(tokenKey)) return;
  clientRefreshInProgress = true;
  const button = document.getElementById("refreshClientButton");
  button.disabled = true;
  button.textContent = "Atualizando...";
  const viewToRestore = activeView;
  try {
    await loadStatement(viewToRestore === "billing" ? portalData?.accessBillingId || "" : "");
    if (portalData) selectView(viewToRestore);
  } catch (error) {
    document.getElementById("loginError").textContent = error.message;
  } finally {
    clientRefreshInProgress = false;
    button.disabled = false;
    button.textContent = "Atualizar";
  }
}

async function submitClientRequest(form) {
  const message = document.getElementById("clientRequestMessage");
  const button = form.querySelector('button[type="submit"]');
  const service = (portalData.requestServices || []).find((item) => item.id === form.elements.serviceId.value);
  button.disabled = true;
  message.textContent = "Enviando pedido...";
  try {
    await request("client-service-request", {
      method: "POST",
      headers: { Authorization: `Bearer ${sessionStorage.getItem(tokenKey)}` },
      body: JSON.stringify({
        serviceId: form.elements.serviceId.value,
        references: form.elements.references.value,
        requestedBy: form.elements.requestedBy.value,
        notes: form.elements.notes.value
      })
    });
    message.textContent = "Pedido enviado com sucesso.";
    form.reset();
    form.elements.requestedDate.value = new Date().toISOString().slice(0, 10);
    form.elements.amount.value = money.format(Number(service?.amount || 0));
    await refreshClientPortal();
    if (portalData) selectView("request");
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

function advanceClientRequestField(event) {
  if (event.key !== "Enter" || event.shiftKey || event.target.tagName === "BUTTON") return;
  const form = event.target.closest("#clientRequestForm");
  if (!form) return;
  event.preventDefault();
  const fields = [
    form.elements.requestedDate,
    form.elements.serviceId,
    form.elements.amount,
    form.elements.references,
    form.elements.requestedBy,
    form.elements.notes
  ];
  const index = fields.indexOf(event.target);
  if (index >= 0 && index < fields.length - 1) fields[index + 1].focus();
  else form.requestSubmit();
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
    error.textContent = "";
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
    error.textContent = "";
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
document.getElementById("refreshClientButton").addEventListener("click", refreshClientPortal);
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
  const copyPixButton = event.target.closest("[data-copy-pix]");
  if (copyPixButton) {
    const value = copyPixButton.dataset.copyPix;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const field = document.createElement("textarea");
      field.value = value;
      document.body.appendChild(field);
      field.select();
      document.execCommand("copy");
      field.remove();
    }
    copyPixButton.textContent = "Chave copiada";
    setTimeout(() => { copyPixButton.textContent = "Copiar chave PIX"; }, 1800);
    return;
  }
  const historyButton = event.target.closest("[data-open-history]");
  if (historyButton) await loadStatement(historyButton.dataset.openHistory);
});
document.getElementById("statementContent").addEventListener("change", () => {
  if (activeView === "current-services") renderCurrentServices(portalData);
  if (activeView === "history") renderHistory(portalData);
  if (activeView === "request") {
    const form = document.getElementById("clientRequestForm");
    if (form) {
      const service = (portalData.requestServices || []).find((item) => item.id === form.elements.serviceId.value);
      form.elements.amount.value = money.format(Number(service?.amount || 0));
    }
  }
});
document.getElementById("statementContent").addEventListener("keydown", advanceClientRequestField);
document.getElementById("statementContent").addEventListener("submit", async (event) => {
  if (event.target.id !== "clientRequestForm") return;
  event.preventDefault();
  await submitClientRequest(event.target);
});

loginFromAutomaticLink().then((loggedIn) => {
  if (!loggedIn) {
    loadStatement().catch((error) => {
      document.getElementById("loginError").textContent = error.message;
    });
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") refreshClientPortal();
});
setInterval(refreshClientPortal, 20000);
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js?v=65").then((registration) => registration.update());
