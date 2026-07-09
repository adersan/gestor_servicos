const trackingTokenKey = "gestor_servicos_tracking_code";
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
let refreshInProgress = false;
let trackingData = null;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[character]);
}

function formatDate(value) {
  return value ? value.split("-").reverse().join("/") : "-";
}

function statusData(status) {
  if (status === "Pronto") return { label: "Feito", className: "done" };
  if (status === "Entregue") return { label: "Entregue", className: "delivered" };
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

async function requestData(accessCode) {
  const response = await fetch("/.netlify/functions/service-tracking-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessCode })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Nao foi possivel abrir o acompanhamento.");
  return data;
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

function render(data) {
  trackingData = data;
  const statusOrder = { "A fazer": 0, Pronto: 1, Entregue: 2 };
  const services = [...(data.services || [])].sort((a, b) =>
    (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3)
    || b.service_date.localeCompare(a.service_date)
  );
  const counts = {
    pending: services.filter((item) => item.status === "A fazer").length,
    done: services.filter((item) => item.status === "Pronto").length,
    delivered: services.filter((item) => item.status === "Entregue").length
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
  document.getElementById("expiryText").textContent = `Link valido ate ${new Date(data.expiresAt).toLocaleString("pt-BR")}.`;
  document.getElementById("trackingSummary").innerHTML = `
    <article class="summary-item summary-pending"><span>A fazer</span><strong>${counts.pending}</strong><small>${amountText(values.pending)}</small></article>
    <article class="summary-item summary-done"><span>Feitos</span><strong>${counts.done}</strong><small>${amountText(values.done)}</small></article>
    <article class="summary-item summary-delivered"><span>Entregues</span><strong>${counts.delivered}</strong><small>${amountText(values.delivered)}</small></article>
    <article class="summary-item summary-total"><span>Total do periodo</span><strong>${trackingData?.showAmounts === false ? services.length : amountText(total)}</strong><small>${services.length} servico(s)</small></article>`;
  renderCharts(services, counts);
  const serviceGroups = groupedServices(services).filter(({ primary, secondaries }) => {
    if (!search) return true;
    const status = statusData(primary.status);
    return searchableText(
      primary.service_name,
      primary.reference,
      primary.status,
      status.label,
      ...secondaries.flatMap((item) => [item.service_name, item.reference, item.status])
    ).includes(search);
  });
  document.getElementById("serviceCount").textContent = search
    ? `${serviceGroups.length} de ${services.length} servico(s)`
    : `${services.length} servico(s)`;
  document.getElementById("serviceList").innerHTML = serviceGroups.length ? serviceGroups.map(({ primary, secondaries }) => {
    const item = primary;
    const status = statusData(item.status);
    const total = [item, ...secondaries].reduce((sum, service) => sum + Number(service.amount), 0);
    return `<article class="tracking-item tracking-${status.className}">
      <time>${formatDate(item.service_date)}</time>
      <div>
        <h4>${escapeHtml(item.service_name)}${secondaries.length ? `<span class="secondary-label">+ ${secondaries.length} complementar(es)</span>` : ""}</h4>
        ${secondaries.length ? `<div class="tracking-complement-list">${secondaries.map((secondary) => `<span>${escapeHtml(secondary.service_name)} · ${amountText(secondary.amount)}${originCancelledNote(secondary, item)}</span>`).join("")}</div>` : originCancelledNote(item)}
        <p class="tracking-reference">${escapeHtml(item.reference || "Sem referencia")}</p>
      </div>
      <div class="tracking-amount"><strong>${amountText(total)}</strong><span class="status status-${status.className}">${status.label}</span></div>
    </article>`;
  }).join("") : `<p class="tracking-message">Nenhum servico encontrado neste periodo.</p>`;
  renderRequestArea(data);
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
  const currentService = form.elements.serviceId.value;
  form.elements.serviceId.innerHTML = services.length
    ? services.map((service) => `<option value="${escapeHtml(service.id)}" data-amount="${Number(service.amount || 0)}">${escapeHtml(service.code ? `${service.code} - ${service.name}` : service.name)}</option>`).join("")
    : `<option value="">Nenhum serviço disponível</option>`;
  if (services.some((service) => service.id === currentService)) form.elements.serviceId.value = currentService;
  const selected = services.find((service) => service.id === form.elements.serviceId.value) || services[0];
  form.elements.amount.value = data.showAmounts === false ? "Valor sob consulta" : money.format(Number(selected?.amount || 0));
  form.querySelector('button[value="default"]').disabled = !services.length;
  document.getElementById("trackingRequesterOptions").innerHTML = (data.clientRequesters || [])
    .map((item) => `<option value="${escapeHtml(item.name)}"></option>`)
    .join("");

  const requests = data.serviceRequests || [];
  document.getElementById("trackingRequestHistory").innerHTML = requests.length ? requests.slice(0, 8).map((item) => `
    <article class="tracking-request-history-card">
      <div><strong>${escapeHtml(item.service_name)}</strong><span>${formatDate(item.requested_date)} · ${escapeHtml(item.status)}</span></div>
      <p>${(item.references || []).map((reference) => `<span>${escapeHtml(reference)}</span>`).join("")}</p>
    </article>`).join("") : `<p class="tracking-message">Nenhum pedido enviado por este link.</p>`;
}

async function loadTracking() {
  const queryCode = new URLSearchParams(location.search).get("access");
  if (queryCode) {
    sessionStorage.setItem(trackingTokenKey, queryCode);
    history.replaceState({}, "", location.pathname);
  }
  const accessCode = queryCode || sessionStorage.getItem(trackingTokenKey);
  if (!accessCode) throw new Error("Este link de acompanhamento e invalido.");
  document.getElementById("loadingPanel").classList.remove("hidden");
  document.getElementById("errorPanel").classList.add("hidden");
  render(await requestData(accessCode));
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

document.getElementById("refreshButton").addEventListener("click", refreshTracking);
document.getElementById("trackingServiceSearch")?.addEventListener("input", () => {
  if (trackingData) render(trackingData);
});
document.getElementById("openTrackingRequestDialog").addEventListener("click", () => {
  renderRequestArea(trackingData || {});
  document.getElementById("trackingRequestDialog").showModal();
  setTimeout(() => document.querySelector('#trackingRequestForm select[name="serviceId"]').focus(), 0);
});
document.querySelectorAll("[data-close-tracking-request]").forEach((button) => button.addEventListener("click", () => {
  const form = document.getElementById("trackingRequestForm");
  form.reset();
  document.getElementById("trackingRequestMessage").textContent = "";
  document.getElementById("trackingRequestDialog").close();
}));
document.getElementById("trackingRequestForm").addEventListener("change", (event) => {
  if (event.target.name !== "serviceId" || !trackingData) return;
  const service = (trackingData.requestServices || []).find((item) => item.id === event.target.value);
  event.currentTarget.elements.amount.value = trackingData.showAmounts === false ? "Valor sob consulta" : money.format(Number(service?.amount || 0));
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
    message.textContent = "Solicitante cadastrado.";
  } catch (error) {
    message.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});
document.getElementById("trackingRequestForm").addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey || event.target.tagName === "BUTTON") return;
  const form = event.currentTarget;
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
});
document.getElementById("trackingRequestForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.getElementById("trackingRequestMessage");
  const button = form.querySelector('button[value="default"]');
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
