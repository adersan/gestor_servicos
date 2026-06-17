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
  document.getElementById("serviceCount").textContent = `${services.length} servico(s)`;
  document.getElementById("expiryText").textContent = `Link valido ate ${new Date(data.expiresAt).toLocaleString("pt-BR")}.`;
  document.getElementById("trackingSummary").innerHTML = `
    <article class="summary-item summary-pending"><span>A fazer</span><strong>${counts.pending}</strong><small>${money.format(values.pending)}</small></article>
    <article class="summary-item summary-done"><span>Feitos</span><strong>${counts.done}</strong><small>${money.format(values.done)}</small></article>
    <article class="summary-item summary-delivered"><span>Entregues</span><strong>${counts.delivered}</strong><small>${money.format(values.delivered)}</small></article>
    <article class="summary-item summary-total"><span>Total do periodo</span><strong>${money.format(total)}</strong><small>${services.length} servico(s)</small></article>`;
  renderCharts(services, counts);
  document.getElementById("serviceList").innerHTML = services.length ? services.map((item) => {
    const status = statusData(item.status);
    return `<article class="tracking-item tracking-${status.className}">
      <time>${formatDate(item.service_date)}</time>
      <div><h4>${escapeHtml(item.service_name)}${item.is_secondary ? `<span class="secondary-label">Complementar</span>` : ""}</h4><p class="tracking-reference">${escapeHtml(item.reference || "Sem referencia")}</p></div>
      <div class="tracking-amount"><strong>${money.format(Number(item.amount))}</strong><span class="status status-${status.className}">${status.label}</span></div>
    </article>`;
  }).join("") : `<p class="tracking-message">Nenhum servico encontrado neste periodo.</p>`;
  renderRequestArea(data);
  document.getElementById("loadingPanel").classList.add("hidden");
  document.getElementById("errorPanel").classList.add("hidden");
  document.getElementById("trackingPanel").classList.remove("hidden");
}

function renderRequestArea(data) {
  const form = document.getElementById("trackingRequestForm");
  const services = data.requestServices || [];
  form.elements.requestedDate.value = new Date().toISOString().slice(0, 10);
  const currentService = form.elements.serviceId.value;
  form.elements.serviceId.innerHTML = services.length
    ? services.map((service) => `<option value="${escapeHtml(service.id)}" data-amount="${Number(service.amount || 0)}">${escapeHtml(service.code ? `${service.code} - ${service.name}` : service.name)}</option>`).join("")
    : `<option value="">Nenhum serviço disponível</option>`;
  if (services.some((service) => service.id === currentService)) form.elements.serviceId.value = currentService;
  const selected = services.find((service) => service.id === form.elements.serviceId.value) || services[0];
  form.elements.amount.value = money.format(Number(selected?.amount || 0));
  form.querySelector('button[type="submit"]').disabled = !services.length;

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
document.getElementById("trackingRequestForm").addEventListener("change", (event) => {
  if (event.target.name !== "serviceId" || !trackingData) return;
  const service = (trackingData.requestServices || []).find((item) => item.id === event.target.value);
  event.currentTarget.elements.amount.value = money.format(Number(service?.amount || 0));
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
  const button = form.querySelector('button[type="submit"]');
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
