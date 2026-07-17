const trackingTokenKey = "gestor_servicos_tracking_code";
const trackingFullKey = "gestor_servicos_tracking_full";
const trackingIdentifierKey = "gestor_servicos_tracking_identifier";
const trackingPasswordKey = "gestor_servicos_tracking_password";
const trackingChoiceKey = "gestor_servicos_tracking_choice";
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
let refreshInProgress = false;
let trackingData = null;
let pendingRestrictedData = null;
let activeTrackingView = "services";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[character]);
}

function formatDate(value) {
  return value ? value.split("-").reverse().join("/") : "-";
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString("pt-BR") : "";
}

function statusData(status) {
  if (status === "Pronto") return { label: "Feito", className: "done" };
  if (status === "Entregue") return { label: "Entregue", className: "delivered" };
  if (status === "Cancelado") return { label: "Cancelado", className: "cancelled" };
  return { label: "A fazer", className: "pending" };
}

function amountText(value) {
  return trackingData?.showAmounts === false ? "Valor sob consulta" : money.format(Number(value || 0));
}

function searchableText(...values) {
  return values.join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function requesterName(item) {
  return String(item?.requested_by || "").trim() || "Sem solicitante";
}

function requesterOptionsFromServices(services, selected = "") {
  const names = [...new Set((services || []).map(requesterName))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return `<option value="">Todos os solicitantes</option>${names.map((name) =>
    `<option value="${escapeHtml(name)}" ${selected === name ? "selected" : ""}>${escapeHtml(name)}</option>`).join("")}`;
}

function sortTrackingServices(services, sortBy) {
  const statusOrder = { "A fazer": 0, Pronto: 1, Entregue: 2 };
  return [...services].sort((a, b) => {
    if (sortBy === "requester") return requesterName(a).localeCompare(requesterName(b), "pt-BR") || b.service_date.localeCompare(a.service_date);
    if (sortBy === "status") return (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3) || requesterName(a).localeCompare(requesterName(b), "pt-BR");
    if (sortBy === "service") return String(a.service_name || "").localeCompare(String(b.service_name || ""), "pt-BR") || requesterName(a).localeCompare(requesterName(b), "pt-BR");
    return b.service_date.localeCompare(a.service_date) || requesterName(a).localeCompare(requesterName(b), "pt-BR");
  });
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
  return `<em class="tracking-origin-cancelled-note">${escapeHtml(message)}</em>`;
}

function referenceChip(reference) {
  return `<span class="tracking-reference">${escapeHtml(reference || "Sem referencia")}</span>`;
}

function requesterBadge(item) {
  return `<span class="tracking-requester-badge">Solicitante: ${escapeHtml(requesterName(item))}</span>`;
}

function complementaryLabel(item) {
  return item.is_secondary
    ? `<span class="secondary-label">Complementar vinculado ao servico original</span>`
    : "";
}

function billingServiceStatusChip(status) {
  const data = statusData(status === "Cancelado" ? "" : status);
  const info = status === "Cancelado" ? { label: "Cancelado", className: "cancelled" } : data;
  return `<span class="status status-${info.className}">${escapeHtml(info.label)}</span>`;
}

function billingHeaderStatusChip(status) {
  const classByStatus = {
    Aberta: "pending",
    Parcial: "pending",
    Paga: "done",
    Cancelada: "cancelled",
    Consolidada: "delivered"
  };
  return `<span class="status status-${classByStatus[status] || "pending"}">${escapeHtml(status)}</span>`;
}

function billingServiceName(primary, secondaries) {
  return `${escapeHtml(primary.service_name)}${secondaries.length ? `<div class="tracking-complement-list">${secondaries.map((item) => `<span>${escapeHtml(item.service_name)} &middot; ${money.format(Number(item.amount))}${originCancelledNote(item, primary)}</span>`).join("")}</div>` : originCancelledNote(primary)}`;
}

function sortBillingGroups(groups) {
  return [...groups].sort((a, b) => a.primary.service_date.localeCompare(b.primary.service_date)
    || requesterName(a.primary).localeCompare(requesterName(b.primary), "pt-BR"));
}

function billingRequesterSummary(groups) {
  const map = new Map();
  groups.forEach(({ primary, secondaries }) => {
    const requester = requesterName(primary);
    if (!map.has(requester)) map.set(requester, { requester, count: 0, total: 0, services: new Map() });
    const entry = map.get(requester);
    const amount = [primary, ...secondaries].reduce((sum, service) => sum + Number(service.amount), 0);
    entry.count += 1;
    entry.total += amount;
    const service = entry.services.get(primary.service_name) || { name: primary.service_name, count: 0, total: 0 };
    service.count += 1;
    service.total += amount;
    entry.services.set(primary.service_name, service);
  });
  return [...map.values()]
    .map((entry) => ({ ...entry, services: [...entry.services.values()] }))
    .sort((a, b) => b.total - a.total || a.requester.localeCompare(b.requester, "pt-BR"));
}

function pdfText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function createBillingPdf(data) {
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

function requestServiceOptionLabel(item) {
  return item ? (item.code ? `${item.code} - ${item.name}` : item.name) : "";
}

function requestServiceMatch(value) {
  const services = trackingData?.requestServices || [];
  const search = searchableText(value).trim();
  if (!search) return null;
  const exact = services.find((item) =>
    searchableText(requestServiceOptionLabel(item)) === search
    || searchableText(item.name) === search
    || searchableText(item.code) === search);
  if (exact) return exact;
  const partial = services.filter((item) => searchableText(requestServiceOptionLabel(item)).includes(search));
  return partial.length === 1 ? partial[0] : null;
}

function syncRequestServiceSelection() {
  const form = document.getElementById("trackingRequestForm");
  const previousServiceId = form.elements.serviceId.value;
  const service = requestServiceMatch(form.elements.serviceSearch.value);
  form.elements.serviceId.value = service?.id || "";
  if (form.elements.serviceId.value !== previousServiceId) {
    form.elements.amount.value = trackingData?.showAmounts === false ? "Valor sob consulta" : money.format(Number(service?.amount || 0));
  }
  return service;
}

async function requestData(accessCode, credentials = {}) {
  const response = await fetch("/.netlify/functions/service-tracking-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessCode, ...credentials })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Nao foi possivel abrir o acompanhamento.");
  return data;
}

function storedTrackingCredentials() {
  return {
    fullAccessCode: sessionStorage.getItem(trackingFullKey) || undefined,
    identifier: sessionStorage.getItem(trackingIdentifierKey) || undefined,
    password: sessionStorage.getItem(trackingPasswordKey) || undefined
  };
}

function showAccessChoice() {
  document.getElementById("loadingPanel").classList.add("hidden");
  document.getElementById("errorPanel").classList.add("hidden");
  document.getElementById("trackingPanel").classList.add("hidden");
  document.getElementById("trackingAccessChoice").classList.remove("hidden");
  document.getElementById("trackingAccessButtons").classList.remove("hidden");
  document.getElementById("trackingPasswordForm").classList.add("hidden");
}

function enterRestricted() {
  const data = pendingRestrictedData || trackingData;
  if (!data) return;
  sessionStorage.setItem(trackingChoiceKey, "restricted");
  document.getElementById("trackingAccessChoice").classList.add("hidden");
  pendingRestrictedData = null;
  render(data);
}

async function sendTrackingRequest(payload) {
  const response = await fetch("/.netlify/functions/tracking-service-request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Nao foi possivel enviar o pedido.");
  return data;
}

async function saveTrackingRequester(payload) {
  const response = await fetch("/.netlify/functions/tracking-requester-save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Nao foi possivel cadastrar o solicitante.");
  return data;
}

function renderCharts(services, counts) {
  const totalCount = Math.max(1, services.length);
  const pendingEnd = counts.pending / totalCount * 100;
  const doneEnd = (counts.pending + counts.done) / totalCount * 100;
  document.getElementById("statusChart").innerHTML = `
    <div class="tracking-donut" style="--pending:${pendingEnd}%;--done:${doneEnd}%">
      <div><strong>${services.length}</strong><span>servicos</span></div>
    </div>
    <div class="tracking-legend">
      <span class="legend-pending">A fazer <strong>${counts.pending}</strong></span>
      <span class="legend-done">Feitos <strong>${counts.done}</strong></span>
      <span class="legend-delivered">Entregues <strong>${counts.delivered}</strong></span>
    </div>`;

  const grouped = Object.values(services.reduce((result, item) => {
    result[item.service_name] ||= { name: item.service_name, count: 0, total: 0 };
    result[item.service_name].count += 1;
    result[item.service_name].total += Number(item.amount);
    return result;
  }, {})).sort((a, b) => b.count - a.count || b.total - a.total).slice(0, 6);
  const max = Math.max(1, ...grouped.map((item) => item.count));
  document.getElementById("serviceChart").innerHTML = grouped.length ? grouped.map((item) => `
    <div class="tracking-bar-row">
      <span>${escapeHtml(item.name)}</span>
      <div><i style="width:${item.count / max * 100}%"></i></div>
      <strong>${item.count}</strong>
    </div>`).join("") : `<p class="tracking-message">Sem servicos para o grafico.</p>`;
}

function groupedServices(services) {
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

function renderServiceItemCard({ primary, secondaries }) {
  const item = primary;
  const status = statusData(item.status);
  const total = [item, ...secondaries].reduce((sum, service) => sum + Number(service.amount), 0);
  return `<article class="tracking-item tracking-${status.className}">
    <time>${formatDate(item.service_date)}</time>
    <div>
      <h4>${escapeHtml(item.service_name)}${secondaries.length ? `<span class="secondary-label">+ ${secondaries.length} complementar(es)</span>` : ""}</h4>
      ${secondaries.length ? `<div class="tracking-complement-list">${secondaries.map((secondary) => `<span>${escapeHtml(secondary.service_name)} · ${amountText(secondary.amount)}${originCancelledNote(secondary, item)}</span>`).join("")}</div>` : originCancelledNote(item)}
      <span class="tracking-requester-badge">Solicitante: ${escapeHtml(requesterName(item))}</span>
      <p class="tracking-reference">${escapeHtml(item.reference || "Sem referencia")}</p>
      ${item.status === "Entregue" && item.delivered_at ? `<p class="tracking-status-date">Entregue em ${escapeHtml(formatDateTime(item.delivered_at))}</p>` : ""}
    </div>
    <div class="tracking-amount"><strong>${amountText(total)}</strong><span class="status status-${status.className}">${status.label}</span></div>
  </article>`;
}

function renderFinancialView(data) {
  const unbilled = data.currentServices || [];
  const unbilledTotal = unbilled.reduce((sum, item) => sum + Number(item.amount), 0);
  const billing = data.billing;
  const openAmount = billing ? Number(billing.open_amount) : 0;
  document.getElementById("trackingFinancialSummary").innerHTML = `
    <article class="summary-item summary-pending"><span>Consumo não faturado</span><strong>${amountText(unbilledTotal)}</strong><small>${unbilled.length} servico(s)</small></article>
    <article class="summary-item summary-done"><span>Cobrança atual</span><strong>${billing ? amountText(billing.total_due) : "-"}</strong><small>${billing ? `${formatDate(billing.period_start)} a ${formatDate(billing.period_end)}` : "Nenhuma cobrança em aberto"}</small></article>
    <article class="summary-item summary-total"><span>Saldo em aberto</span><strong>${billing ? amountText(openAmount) : amountText(0)}</strong><small>${billing ? escapeHtml(billing.status) : "Sem cobrança"}</small></article>
    <article class="summary-item summary-grand-total"><span>Total em aberto + não faturado</span><strong>${amountText(openAmount + unbilledTotal)}</strong><small>Saldo em aberto somado ao consumo não faturado</small></article>`;
  const groups = groupedServices(unbilled);
  document.getElementById("trackingUnbilledCount").textContent = `${unbilled.length} servico(s)`;
  document.getElementById("trackingUnbilledList").innerHTML = groups.length
    ? groups.map(renderServiceItemCard).join("")
    : `<p class="tracking-message">Nenhum servico pendente de faturamento.</p>`;
}

function renderBillingView(data) {
  const billing = data.billing;
  const container = document.getElementById("trackingBillingContent");
  if (!billing) {
    container.innerHTML = "";
    return;
  }
  const services = billing.services || [];
  const payments = billing.payments || [];
  const paymentMethods = billing.paymentMethods || [];
  const paymentTotal = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const serviceGroups = sortBillingGroups(groupedServices(services));

  function serviceTable(items) {
    const rows = items.map(({ primary: item, secondaries }) => `<tr>
      <td>${formatDate(item.service_date)}</td>
      <td>${billingServiceName(item, secondaries)}${requesterBadge(item)}${secondaries.length ? `<span class="secondary-label">Complementar vinculado ao servico original</span>` : complementaryLabel(item)}</td>
      <td>${referenceChip(item.reference)}</td>
      <td>${escapeHtml(requesterName(item))}</td>
      <td>${billingServiceStatusChip(item.status)}</td>
      <td class="amount-service">${money.format([item, ...secondaries].reduce((sum, service) => sum + Number(service.amount), 0))}</td>
    </tr>`).join("");
    return `<table class="tracking-report-table">
      <thead><tr><th>Data</th><th>Servico</th><th>Ref</th><th>Solicitante</th><th>Status</th><th>Valor</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="6">-</td></tr>`}</tbody>
    </table>`;
  }

  const requesterRows = billingRequesterSummary(serviceGroups).map((group) => `
    <article class="tracking-requester-summary-card">
      <div><strong>${escapeHtml(group.requester)}</strong><span>${group.count} servico(s) - ${money.format(group.total)}</span></div>
      <ul>${group.services.map((service) => `<li>${escapeHtml(service.name)}: ${service.count} - ${money.format(service.total)}</li>`).join("")}</ul>
    </article>`).join("") || `<p class="tracking-message">Nenhum solicitante informado neste periodo.</p>`;

  const paymentRows = payments.length
    ? payments.map((item) => `<tr>
        <td>${formatDate(item.payment_date)}</td>
        <td>${escapeHtml(item.method || item.notes || "-")}</td>
        <td class="amount-payment">${money.format(Number(item.amount))}</td>
      </tr>`).join("")
    : `<tr><td colspan="3">Nenhum pagamento neste fechamento.</td></tr>`;

  const methods = paymentMethods.length
    ? paymentMethods.map((method) => `<article class="tracking-billing-method">
        <strong>${escapeHtml(method.name)} (${escapeHtml(method.type)})</strong>
        <span>${escapeHtml(method.details || "")}</span>
        ${String(method.type || "").toUpperCase().includes("PIX") && method.details ? `<button class="tracking-copy-pix-button" type="button" data-copy-pix="${escapeHtml(method.details.includes(":") ? method.details.split(":").pop().trim() : method.details.trim())}">Copiar chave PIX</button>` : ""}
        ${method.payment_link ? `<a href="${escapeHtml(method.payment_link)}" target="_blank" rel="noopener">Abrir link de pagamento</a>` : ""}
      </article>`).join("")
    : `<p class="tracking-message">Consulte as formas de pagamento com o responsável.</p>`;

  const maxValue = Math.max(
    Number(billing.total_due),
    paymentTotal,
    Math.abs(Number(billing.previous_balance)),
    1
  );

  container.innerHTML = `
    <p class="meta">Período: ${formatDate(billing.period_start)} a ${formatDate(billing.period_end)} · ${billingHeaderStatusChip(billing.status)}</p>
    <p class="tracking-billing-note">Esta cobrança se refere ao período de ${formatDate(billing.period_start)} a ${formatDate(billing.period_end)} e não inclui os serviços ainda em aberto (não faturados).</p>
    <section class="tracking-billing-section">
      <h3>Formas de pagamento</h3>
      <div class="tracking-billing-methods">${methods}</div>
    </section>
    <div class="tracking-summary">
      <article class="summary-item summary-pending"><span>Saldo anterior</span><strong>${money.format(Number(billing.previous_balance))}</strong></article>
      <article class="summary-item summary-done"><span>Serviços</span><strong>${money.format(Number(billing.services_total))}</strong></article>
      <article class="summary-item summary-delivered"><span>Pagamentos</span><strong>${money.format(paymentTotal)}</strong></article>
      <article class="summary-item summary-total"><span>Total em aberto</span><strong>${money.format(Number(billing.open_amount ?? billing.total_due))}</strong></article>
    </div>
    <section class="tracking-billing-section">
      <h3>Resumo gráfico</h3>
      <div class="tracking-billing-chart">
        <div class="tracking-billing-chart-row"><span>Saldo anterior</span><div><i style="width:${Math.abs(Number(billing.previous_balance)) / maxValue * 100}%"></i></div><strong>${money.format(Number(billing.previous_balance))}</strong></div>
        <div class="tracking-billing-chart-row"><span>Serviços</span><div><i style="width:${Number(billing.services_total) / maxValue * 100}%"></i></div><strong>${money.format(Number(billing.services_total))}</strong></div>
        <div class="tracking-billing-chart-row"><span>Pagamentos</span><div><i class="payment" style="width:${paymentTotal / maxValue * 100}%"></i></div><strong>${money.format(paymentTotal)}</strong></div>
      </div>
    </section>
    <section class="tracking-billing-section">
      <h3>Resumo por solicitante</h3>
      <div class="tracking-requester-summary-list">${requesterRows}</div>
      <h3>Serviços do período</h3>
      <div class="tracking-report-service-grid">${serviceGroups.length ? serviceTable(serviceGroups) : `<p class="tracking-message">Nenhum serviço neste fechamento.</p>`}</div>
    </section>
    <section class="tracking-billing-section">
      <h3>Pagamentos</h3>
      <table class="tracking-payments-table"><thead><tr><th>Data</th><th>Descrição</th><th>Valor</th></tr></thead><tbody>${paymentRows}</tbody></table>
    </section>`;
}

function selectTrackingView(view) {
  if (view === "billing" && !trackingData?.billing) view = "services";
  if (view === "financial" && trackingData?.showAmounts === false) view = "services";
  activeTrackingView = view;
  document.querySelectorAll("[data-tracking-view]").forEach((button) =>
    button.classList.toggle("active", button.dataset.trackingView === view));
  document.getElementById("trackingViewServices").classList.toggle("hidden", view !== "services");
  document.getElementById("trackingViewFinancial").classList.toggle("hidden", view !== "financial");
  document.getElementById("trackingViewBilling").classList.toggle("hidden", view !== "billing");
}

function render(data) {
  trackingData = data;
  const requesterFilter = document.getElementById("trackingRequesterFilter")?.value || "";
  const sortBy = document.getElementById("trackingServiceSort")?.value || "date";
  const startFilter = document.getElementById("trackingServiceStartFilter")?.value || "";
  const endFilter = document.getElementById("trackingServiceEndFilter")?.value || "";
  const matchesTrackingFilters = (item) =>
    (!requesterFilter || requesterName(item) === requesterFilter)
    && (!startFilter || item.service_date >= startFilter)
    && (!endFilter || item.service_date <= endFilter);
  const services = sortTrackingServices([...(data.services || [])].filter((item) => item.status !== "Cancelado"), sortBy)
    .filter(matchesTrackingFilters);
  const cancelledServices = sortTrackingServices([...(data.services || [])].filter((item) => item.status === "Cancelado"), sortBy)
    .filter(matchesTrackingFilters);
  const primaryServices = services.filter((item) => !item.is_secondary);
  const primaryCancelledServices = cancelledServices.filter((item) => !item.is_secondary);
  const counts = {
    pending: primaryServices.filter((item) => item.status === "A fazer").length,
    done: primaryServices.filter((item) => item.status === "Pronto").length,
    delivered: primaryServices.filter((item) => item.status === "Entregue").length
  };
  const values = {
    pending: services.filter((item) => item.status === "A fazer").reduce((sum, item) => sum + Number(item.amount), 0),
    done: services.filter((item) => item.status === "Pronto").reduce((sum, item) => sum + Number(item.amount), 0),
    delivered: services.filter((item) => item.status === "Entregue").reduce((sum, item) => sum + Number(item.amount), 0)
  };
  const total = services.reduce((sum, item) => sum + Number(item.amount), 0);
  document.getElementById("clientName").textContent = data.client.name;
  document.getElementById("periodText").textContent = `${formatDate(data.period.startDate)} a ${formatDate(data.period.endDate)}`;
  document.getElementById("updatedAt").textContent = new Date(data.updatedAt).toLocaleString("pt-BR");
  const search = searchableText(document.getElementById("trackingServiceSearch")?.value || "");
  const requesterSelect = document.getElementById("trackingRequesterFilter");
  if (requesterSelect) requesterSelect.innerHTML = requesterOptionsFromServices(data.services || [], requesterFilter);
  const sortSelect = document.getElementById("trackingServiceSort");
  if (sortSelect) sortSelect.value = sortBy;
  document.getElementById("expiryText").textContent = `Link valido ate ${new Date(data.expiresAt).toLocaleString("pt-BR")}.`;
  document.getElementById("trackingSummary").innerHTML = `
    <article class="summary-item summary-pending"><span>A fazer</span><strong>${counts.pending}</strong><small>${amountText(values.pending)}</small></article>
    <article class="summary-item summary-done"><span>Feitos</span><strong>${counts.done}</strong><small>${amountText(values.done)}</small></article>
    <article class="summary-item summary-delivered"><span>Entregues</span><strong>${counts.delivered}</strong><small>${amountText(values.delivered)}</small></article>
    <article class="summary-item summary-total"><span>Total do periodo</span><strong>${trackingData?.showAmounts === false ? primaryServices.length : amountText(total)}</strong><small>${primaryServices.length} servico(s)</small></article>
    <article class="summary-item summary-cancelled"><span>Cancelados</span><strong>${primaryCancelledServices.length}</strong><small>servico(s) cancelado(s)</small></article>`;
  renderCharts(primaryServices, counts);
  const serviceGroups = groupedServices(services).filter(({ primary, secondaries }) => {
    if (!search) return true;
    const status = statusData(primary.status);
    return searchableText(
      primary.service_name,
      primary.reference,
      primary.status,
      primary.requested_by,
      status.label,
      ...secondaries.flatMap((item) => [item.service_name, item.reference, item.status, item.requested_by])
    ).includes(search);
  });
  document.getElementById("serviceCount").textContent = search
    ? `${serviceGroups.length} de ${primaryServices.length} servico(s)`
    : `${primaryServices.length} servico(s)`;
  document.getElementById("serviceList").innerHTML = serviceGroups.length
    ? serviceGroups.map(renderServiceItemCard).join("")
    : `<p class="tracking-message">Nenhum servico encontrado neste periodo.</p>`;
  const cancelledGroups = groupedServices(cancelledServices).filter(({ primary, secondaries }) => {
    if (!search) return true;
    const status = statusData(primary.status);
    return searchableText(
      primary.service_name,
      primary.reference,
      primary.status,
      primary.requested_by,
      status.label,
      ...secondaries.flatMap((item) => [item.service_name, item.reference, item.status, item.requested_by])
    ).includes(search);
  });
  document.getElementById("cancelledServiceCount").textContent = `${primaryCancelledServices.length} servico(s)`;
  document.getElementById("cancelledServiceList").innerHTML = cancelledGroups.length
    ? cancelledGroups.map(renderServiceItemCard).join("")
    : `<p class="tracking-message">Nenhum servico cancelado neste periodo.</p>`;
  renderRequestArea(data);
  document.getElementById("trackingFinancialTab").classList.toggle("hidden", data.showAmounts === false);
  document.getElementById("trackingBillingTab").classList.toggle("hidden", !data.billing);
  document.getElementById("switchToFullAccessButton").classList.toggle("hidden", !(data.linkMode === "gated" && data.tier === "restricted"));
  renderFinancialView(data);
  if (data.billing) renderBillingView(data);
  selectTrackingView(activeTrackingView);
  document.getElementById("loadingPanel").classList.add("hidden");
  document.getElementById("errorPanel").classList.add("hidden");
  document.getElementById("trackingPanel").classList.remove("hidden");
}

function renderRequestArea(data) {
  const section = document.getElementById("trackingRequestSection");
  section.classList.toggle("hidden", !data.allowRequests);
  if (!data.allowRequests) return;
  const form = document.getElementById("trackingRequestForm");
  const services = data.requestServices || [];
  form.elements.requestedDate.value = new Date().toISOString().slice(0, 10);
  document.getElementById("trackingRequestServiceOptions").innerHTML = services
    .map((service) => `<option value="${escapeHtml(requestServiceOptionLabel(service))}"></option>`)
    .join("");
  form.elements.serviceSearch.disabled = !services.length;
  form.elements.serviceSearch.placeholder = services.length ? "Digite o código ou nome" : "Nenhum serviço disponível";
  if (document.activeElement !== form.elements.serviceSearch) {
    const currentServiceId = form.elements.serviceId.value;
    const currentService = services.find((service) => service.id === currentServiceId) || null;
    const selected = currentService || services[0] || null;
    form.elements.serviceId.value = selected?.id || "";
    form.elements.serviceSearch.value = requestServiceOptionLabel(selected);
    form.elements.amount.value = !services.length ? "" : data.showAmounts === false ? "Valor sob consulta" : money.format(Number(selected?.amount || 0));
  }
  document.querySelector('.tracking-wizard-nav [data-wizard-next]').disabled = !services.length;
  document.getElementById("trackingRequesterOptions").innerHTML = (data.clientRequesters || [])
    .map((item) => `<option value="${escapeHtml(item.name)}"></option>`)
    .join("");
  renderTrackingServicePicker();
  renderTrackingRequesterPicker();

  const requests = data.serviceRequests || [];
  document.getElementById("trackingRequestHistory").innerHTML = requests.length ? requests.slice(0, 8).map((item) => `
    <article class="tracking-request-history-card">
      <div><strong>${escapeHtml(item.service_name)}</strong><span>${formatDate(item.requested_date)} · ${escapeHtml(item.status)}</span></div>
      <p>${(item.references || []).map((reference) => `<span>${escapeHtml(reference)}</span>`).join("")}</p>
    </article>`).join("") : `<p class="tracking-message">Nenhum pedido enviado por este link.</p>`;
}

async function loadTracking() {
  const params = new URLSearchParams(location.search);
  const queryCode = params.get("access");
  const queryFull = params.get("full");
  if (queryCode) {
    sessionStorage.setItem(trackingTokenKey, queryCode);
    if (queryFull) sessionStorage.setItem(trackingFullKey, queryFull);
    history.replaceState({}, "", location.pathname);
  }
  const accessCode = queryCode || sessionStorage.getItem(trackingTokenKey);
  if (!accessCode) throw new Error("Este link de acompanhamento e invalido.");
  document.getElementById("loadingPanel").classList.remove("hidden");
  document.getElementById("errorPanel").classList.add("hidden");
  const storedChoice = sessionStorage.getItem(trackingChoiceKey);
  // Na primeira visita (sem escolha guardada) nao aplica a senha embutida ainda,
  // para sempre perguntar "Entrar sem senha / Entrar com senha" antes de liberar o acesso completo.
  // Depois que o usuario escolhe "sem senha", nao reenviar as credenciais guardadas
  // (o full= embutido na URL continua salvo na sessao) para nao reabrir o acesso completo sozinho.
  const data = await requestData(accessCode, storedChoice === "full" ? storedTrackingCredentials() : {});
  if (data.linkMode === "gated" && !storedChoice) {
    pendingRestrictedData = data;
    showAccessChoice();
    return;
  }
  if (data.linkMode === "gated") sessionStorage.setItem(trackingChoiceKey, data.tier);
  document.getElementById("trackingAccessChoice").classList.add("hidden");
  render(data);
}

async function refreshTracking() {
  if (refreshInProgress) return;
  refreshInProgress = true;
  const button = document.getElementById("refreshButton");
  button.disabled = true;
  button.textContent = "Atualizando...";
  try {
    await loadTracking();
  } catch (error) {
    showError(error);
  } finally {
    refreshInProgress = false;
    button.disabled = false;
    button.textContent = "Atualizar";
  }
}

function showError(error) {
  document.getElementById("loadingPanel").classList.add("hidden");
  document.getElementById("trackingPanel").classList.add("hidden");
  const target = document.getElementById("errorPanel");
  target.textContent = error.message;
  target.classList.remove("hidden");
}

async function enterFullAccess(credentials) {
  const accessCode = sessionStorage.getItem(trackingTokenKey);
  const data = await requestData(accessCode, { identifier: credentials.identifier, password: credentials.password });
  if (data.tier !== "full") throw new Error("Identificador ou senha inválidos.");
  sessionStorage.setItem(trackingIdentifierKey, credentials.identifier);
  sessionStorage.setItem(trackingPasswordKey, credentials.password);
  sessionStorage.setItem(trackingChoiceKey, "full");
  pendingRestrictedData = null;
  document.getElementById("trackingAccessChoice").classList.add("hidden");
  render(data);
}

document.getElementById("refreshButton").addEventListener("click", refreshTracking);
document.getElementById("enterWithoutPasswordButton").addEventListener("click", enterRestricted);
document.getElementById("showPasswordFormButton").addEventListener("click", () => {
  document.getElementById("trackingAccessButtons").classList.add("hidden");
  document.getElementById("trackingPasswordForm").classList.remove("hidden");
});
document.getElementById("cancelPasswordEntryButton").addEventListener("click", () => {
  document.getElementById("trackingPasswordForm").classList.add("hidden");
  document.getElementById("trackingAccessButtons").classList.remove("hidden");
});
document.getElementById("switchToFullAccessButton").addEventListener("click", () => {
  sessionStorage.removeItem(trackingChoiceKey);
  showAccessChoice();
});
document.getElementById("trackingPasswordForm").addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey) return;
  if (event.target.name === "identifier") {
    event.preventDefault();
    event.currentTarget.elements.password.focus();
  }
});
document.getElementById("trackingPasswordForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const errorBox = document.getElementById("trackingPasswordError");
  const button = form.querySelector('button[type="submit"]');
  const identifier = form.elements.identifier.value.trim();
  const password = form.elements.password.value;
  errorBox.textContent = "";
  button.disabled = true;
  button.textContent = "Entrando...";
  try {
    await enterFullAccess({ identifier, password });
  } catch (error) {
    errorBox.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = "Entrar com senha";
  }
});
document.getElementById("trackingNav").addEventListener("click", (event) => {
  const button = event.target.closest("[data-tracking-view]");
  if (!button) return;
  selectTrackingView(button.dataset.trackingView);
});
document.getElementById("trackingBillingPdfButton").addEventListener("click", () => {
  if (!trackingData?.billing) return;
  const blob = createBillingPdf({
    client: trackingData.client,
    billing: trackingData.billing,
    services: trackingData.billing.services,
    payments: trackingData.billing.payments,
    paymentMethods: trackingData.billing.paymentMethods
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("aria-label", "Abrir relatório de cobrança em PDF");
  link.target = "_blank";
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
});
document.getElementById("trackingBillingContent").addEventListener("click", async (event) => {
  const copyPixButton = event.target.closest("[data-copy-pix]");
  if (!copyPixButton) return;
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
});
document.getElementById("trackingServiceSearch")?.addEventListener("input", () => {
  if (trackingData) render(trackingData);
});
document.getElementById("trackingRequesterFilter")?.addEventListener("change", () => {
  if (trackingData) render(trackingData);
});
document.getElementById("trackingServiceStartFilter")?.addEventListener("change", () => {
  if (trackingData) render(trackingData);
});
document.getElementById("trackingServiceEndFilter")?.addEventListener("change", () => {
  if (trackingData) render(trackingData);
});
document.getElementById("trackingServiceSort")?.addEventListener("change", () => {
  if (trackingData) render(trackingData);
});
const TRACKING_REQUEST_STEP_COUNT = 5;
let trackingRequestStep = 1;
let trackingRequestReferenceValues = [];
const TRACKING_PICKER_PAGE_SIZE = 6;
const trackingPickerPages = { service: 0, requester: 0 };

function renderTrackingReferenceList() {
  const form = document.getElementById("trackingRequestForm");
  document.getElementById("trackingReferenceList").innerHTML = trackingRequestReferenceValues
    .map((reference, index) => `<span class="tracking-reference">${escapeHtml(reference)}<button type="button" data-remove-tracking-reference="${index}" aria-label="Remover ${escapeHtml(reference)}">×</button></span>`)
    .join("");
  form.elements.references.value = trackingRequestReferenceValues.join("\n");
}

function addCurrentTrackingReference() {
  const form = document.getElementById("trackingRequestForm");
  const input = form.elements.referenceInput;
  const value = input.value.trim().toUpperCase();
  if (!value) return false;
  if (!trackingRequestReferenceValues.includes(value)) trackingRequestReferenceValues.push(value);
  input.value = "";
  renderTrackingReferenceList();
  return true;
}

function renderTrackingPickerGrid(key, gridId, items, selectedId) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  const totalPages = Math.max(1, Math.ceil(items.length / TRACKING_PICKER_PAGE_SIZE));
  trackingPickerPages[key] = Math.min(Math.max(trackingPickerPages[key] || 0, 0), totalPages - 1);
  const page = trackingPickerPages[key];
  const pageItems = items.slice(page * TRACKING_PICKER_PAGE_SIZE, page * TRACKING_PICKER_PAGE_SIZE + TRACKING_PICKER_PAGE_SIZE);
  grid.innerHTML = pageItems.length
    ? pageItems.map((item) => `<button type="button" class="tracking-choice-btn${item.id === selectedId ? " selected" : ""}" data-picker-item="${escapeHtml(item.id)}">${escapeHtml(item.label)}</button>`).join("")
    : '<span class="tracking-picker-hint">Nada disponível.</span>';
  const prevButton = document.querySelector(`[data-picker-prev="${key}"]`);
  const nextButton = document.querySelector(`[data-picker-next="${key}"]`);
  if (prevButton) prevButton.disabled = page === 0;
  if (nextButton) nextButton.disabled = page >= totalPages - 1;
}

function trackingServiceUsageItems(data) {
  const services = data.requestServices || [];
  const counts = {};
  [...(data.services || []), ...(data.currentServices || [])].forEach((entry) => {
    if (entry.service_id) counts[entry.service_id] = (counts[entry.service_id] || 0) + 1;
  });
  return services
    .map((service, index) => ({ id: service.id, label: requestServiceOptionLabel(service), order: index }))
    .sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0) || a.order - b.order);
}

function trackingRequesterUsageItems(data) {
  const requesters = data.clientRequesters || [];
  const counts = {};
  (data.serviceRequests || []).forEach((item) => {
    const name = (item.requested_by || "").trim();
    if (name) counts[name] = (counts[name] || 0) + 1;
  });
  return requesters
    .map((item, index) => ({ id: item.name, label: item.name, order: index }))
    .sort((a, b) => (counts[b.label] || 0) - (counts[a.label] || 0) || a.order - b.order);
}

function renderTrackingServicePicker() {
  const form = document.getElementById("trackingRequestForm");
  renderTrackingPickerGrid("service", "trackingServicePickerGrid", trackingServiceUsageItems(trackingData || {}), form.elements.serviceId.value);
}

function renderTrackingRequesterPicker() {
  const form = document.getElementById("trackingRequestForm");
  const items = [{ id: "", label: "Não informar" }, ...trackingRequesterUsageItems(trackingData || {})];
  renderTrackingPickerGrid("requester", "trackingRequesterPickerGrid", items, form.elements.requestedBy.value.trim());
}

function revealTrackingPickerSearch(step) {
  const stepElement = document.querySelector(`.tracking-wizard-step[data-step="${step}"]`);
  const field = stepElement?.querySelector(".tracking-picker-search-field");
  field?.classList.remove("hidden");
  setTimeout(() => field?.querySelector("input")?.focus(), 0);
}

function renderTrackingRequestWizardSummary() {
  const form = document.getElementById("trackingRequestForm");
  const target = document.getElementById("trackingRequestWizardSummary");
  if (!target) return;
  const referenceCount = trackingRequestReferenceValues.length;
  const rows = [
    ["Serviço", form.elements.serviceSearch.value || "-"],
    ["Valor", form.elements.amount.value || "-"],
    ["Placa/referência", referenceCount === 1 ? "1 referência" : `${referenceCount} referências`],
    ["Quem solicitou", form.elements.requestedBy.value.trim() || "Não informado"],
    form.elements.notes.value.trim() ? ["Observação", form.elements.notes.value.trim()] : null
  ].filter(Boolean);
  target.innerHTML = rows
    .map(([label, value]) => `<div class="tracking-wizard-summary-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join("");
}

function trackingRequestFirstField(step) {
  if (step === 2) return document.querySelector('#trackingRequestForm input[name="referenceInput"]');
  if (step === 4) return document.querySelector('#trackingRequestForm textarea[name="notes"]');
  return null;
}

function goToTrackingRequestStep(step) {
  const form = document.getElementById("trackingRequestForm");
  trackingRequestStep = Math.min(Math.max(step, 1), TRACKING_REQUEST_STEP_COUNT);
  form.querySelectorAll(".tracking-wizard-step").forEach((el) => {
    el.classList.toggle("hidden", Number(el.dataset.step) !== trackingRequestStep);
  });
  document.getElementById("trackingWizardProgressFill").style.width = `${(trackingRequestStep / TRACKING_REQUEST_STEP_COUNT) * 100}%`;
  document.getElementById("trackingWizardProgressLabel").textContent = `Passo ${trackingRequestStep} de ${TRACKING_REQUEST_STEP_COUNT}`;
  const nav = document.querySelector(".tracking-wizard-nav");
  nav.querySelector("[data-wizard-back]").classList.toggle("hidden", trackingRequestStep === 1);
  nav.querySelector("[data-wizard-next]").textContent = trackingRequestStep === TRACKING_REQUEST_STEP_COUNT ? "Enviar pedido" : "Continuar";
  if (trackingRequestStep === 1) renderTrackingServicePicker();
  if (trackingRequestStep === 3) renderTrackingRequesterPicker();
  if (trackingRequestStep === TRACKING_REQUEST_STEP_COUNT) renderTrackingRequestWizardSummary();
  const focusable = trackingRequestFirstField(trackingRequestStep);
  setTimeout(() => {
    if (focusable) focusable.focus();
    else nav.querySelector("[data-wizard-next]")?.focus();
  }, 0);
}

function validateTrackingRequestStep(step) {
  const form = document.getElementById("trackingRequestForm");
  const message = document.getElementById("trackingRequestMessage");
  message.textContent = "";
  if (step === 1) {
    if (!syncRequestServiceSelection()) {
      message.textContent = "Selecione um serviço válido da lista.";
      revealTrackingPickerSearch(1);
      return false;
    }
  }
  if (step === 2) {
    addCurrentTrackingReference();
    if (!trackingRequestReferenceValues.length) {
      message.textContent = "Informe ao menos uma placa ou referência.";
      form.elements.referenceInput.focus();
      return false;
    }
  }
  return true;
}

document.getElementById("openTrackingRequestDialog").addEventListener("click", () => {
  trackingPickerPages.service = 0;
  trackingPickerPages.requester = 0;
  trackingRequestReferenceValues = [];
  renderTrackingReferenceList();
  renderRequestArea(trackingData || {});
  document.getElementById("trackingRequestDialog").showModal();
  goToTrackingRequestStep(1);
});
document.querySelectorAll("[data-close-tracking-request]").forEach((button) => button.addEventListener("click", () => {
  const form = document.getElementById("trackingRequestForm");
  form.reset();
  trackingRequestReferenceValues = [];
  renderTrackingReferenceList();
  document.getElementById("trackingRequestMessage").textContent = "";
  document.getElementById("trackingRequestDialog").close();
}));
document.getElementById("trackingRequestForm").addEventListener("input", (event) => {
  if (event.target.name === "serviceSearch" && trackingData) syncRequestServiceSelection();
  if (event.target.name === "requestedBy") renderTrackingRequesterPicker();
});
document.getElementById("trackingRequestForm").addEventListener("change", (event) => {
  if (event.target.name === "serviceSearch" && trackingData) syncRequestServiceSelection();
});
document.getElementById("trackingRequestForm").addEventListener("click", (event) => {
  const prevButton = event.target.closest("[data-picker-prev]");
  const nextButton = event.target.closest("[data-picker-next]");
  const searchButton = event.target.closest("[data-picker-search]");
  const pickerButton = event.target.closest(".tracking-picker-grid .tracking-choice-btn[data-picker-item]");
  if (prevButton || nextButton) {
    const key = (prevButton || nextButton).dataset.pickerPrev || (prevButton || nextButton).dataset.pickerNext;
    trackingPickerPages[key] = Math.max(0, (trackingPickerPages[key] || 0) + (prevButton ? -1 : 1));
    if (key === "service") renderTrackingServicePicker();
    if (key === "requester") renderTrackingRequesterPicker();
    return;
  }
  if (searchButton) {
    revealTrackingPickerSearch(searchButton.dataset.pickerSearch === "service" ? 1 : 3);
    return;
  }
  if (pickerButton) {
    const form = event.currentTarget;
    const key = pickerButton.closest(".tracking-picker")?.dataset.picker;
    const itemId = pickerButton.dataset.pickerItem;
    if (key === "service") {
      const service = (trackingData?.requestServices || []).find((item) => item.id === itemId);
      form.elements.serviceId.value = itemId;
      form.elements.serviceSearch.value = service ? requestServiceOptionLabel(service) : "";
      form.elements.amount.value = service ? amountText(service.amount) : "";
      document.getElementById("trackingRequestMessage").textContent = "";
      renderTrackingServicePicker();
    } else if (key === "requester") {
      form.elements.requestedBy.value = itemId;
      renderTrackingRequesterPicker();
    }
    return;
  }
});
document.getElementById("trackingRequestForm").addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-add-tracking-reference]");
  if (addButton) {
    if (!addCurrentTrackingReference()) document.getElementById("trackingRequestForm").elements.referenceInput.focus();
    return;
  }
  const removeButton = event.target.closest("[data-remove-tracking-reference]");
  if (removeButton) {
    trackingRequestReferenceValues.splice(Number(removeButton.dataset.removeTrackingReference), 1);
    renderTrackingReferenceList();
  }
});
document.getElementById("trackingRequestForm").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-add-tracking-requester]");
  if (!button) return;
  const form = event.currentTarget;
  const message = document.getElementById("trackingRequestMessage");
  const name = form.elements.requestedBy.value.trim().replace(/\s+/g, " ");
  if (!name) {
    message.textContent = "Informe o nome do solicitante.";
    form.elements.requestedBy.focus();
    return;
  }
  button.disabled = true;
  message.textContent = "Cadastrando solicitante...";
  try {
    const result = await saveTrackingRequester({
      accessCode: sessionStorage.getItem(trackingTokenKey),
      name
    });
    trackingData.clientRequesters ||= [];
    trackingData.clientRequesters.push(result.requester);
    renderRequestArea(trackingData);
    form.elements.requestedBy.value = result.requester.name;
    renderTrackingRequesterPicker();
    message.textContent = "Solicitante cadastrado.";
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
document.querySelector(".tracking-wizard-nav").addEventListener("click", (event) => {
  if (event.target.closest("[data-wizard-back]")) {
    if (trackingRequestStep <= 1) return;
    goToTrackingRequestStep(trackingRequestStep - 1);
    return;
  }
  if (event.target.closest("[data-wizard-next]")) {
    if (trackingRequestStep >= TRACKING_REQUEST_STEP_COUNT) {
      document.getElementById("trackingRequestForm").requestSubmit();
    } else if (validateTrackingRequestStep(trackingRequestStep)) {
      goToTrackingRequestStep(trackingRequestStep + 1);
    }
  }
});
document.getElementById("trackingRequestForm").addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey || event.target.tagName === "BUTTON") return;
  if (event.target.tagName === "TEXTAREA") {
    if (event.target.name === "notes" && !event.target.value.trim()) {
      event.preventDefault();
      document.querySelector('.tracking-wizard-nav [data-wizard-next]').focus();
    }
    return;
  }
  event.preventDefault();
  if (event.target.name === "referenceInput") {
    if (addCurrentTrackingReference()) event.target.focus();
    else document.querySelector('.tracking-wizard-nav [data-wizard-next]').click();
    return;
  }
  if (event.target.name === "serviceSearch" && trackingData) {
    const form = document.getElementById("trackingRequestForm");
    const service = syncRequestServiceSelection();
    if (service) form.elements.serviceSearch.value = requestServiceOptionLabel(service);
  }
  document.querySelector('.tracking-wizard-nav [data-wizard-next]').click();
});
document.getElementById("trackingRequestForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.getElementById("trackingRequestMessage");
  if (!syncRequestServiceSelection()) {
    message.textContent = "Selecione um serviço válido da lista.";
    goToTrackingRequestStep(1);
    return;
  }
  const button = document.querySelector('.tracking-wizard-nav [data-wizard-next]');
  const accessCode = sessionStorage.getItem(trackingTokenKey);
  button.disabled = true;
  message.textContent = "Enviando pedido...";
  try {
    await sendTrackingRequest({
      accessCode,
      serviceId: form.elements.serviceId.value,
      references: form.elements.references.value,
      requestedBy: form.elements.requestedBy.value,
      notes: form.elements.notes.value
    });
    message.textContent = "Pedido enviado com sucesso.";
    form.reset();
    trackingRequestReferenceValues = [];
    renderTrackingReferenceList();
    document.getElementById("trackingRequestDialog").close();
    await refreshTracking();
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") refreshTracking();
});
setInterval(refreshTracking, 20000);

loadTracking().catch(showError);
