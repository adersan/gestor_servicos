const trackingTokenKey = "gestor_servicos_tracking_code";
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

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
  if (!response.ok) throw new Error(data.error || "Não foi possível abrir o acompanhamento.");
  return data;
}

function render(data) {
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
  document.getElementById("serviceCount").textContent = `${services.length} serviço(s)`;
  document.getElementById("expiryText").textContent = `Link válido até ${new Date(data.expiresAt).toLocaleString("pt-BR")}.`;
  document.getElementById("trackingSummary").innerHTML = `
    <article class="summary-item summary-pending"><span>A fazer</span><strong>${counts.pending}</strong><small>${money.format(values.pending)}</small></article>
    <article class="summary-item summary-done"><span>Feitos</span><strong>${counts.done}</strong><small>${money.format(values.done)}</small></article>
    <article class="summary-item summary-delivered"><span>Entregues</span><strong>${counts.delivered}</strong><small>${money.format(values.delivered)}</small></article>
    <article class="summary-item summary-total"><span>Total do período</span><strong>${money.format(total)}</strong><small>${services.length} serviço(s)</small></article>`;
  document.getElementById("serviceList").innerHTML = services.length ? services.map((item) => {
    const status = statusData(item.status);
    return `<article class="tracking-item">
      <time>${formatDate(item.service_date)}</time>
      <div><h4>${escapeHtml(item.service_name)}${item.is_secondary ? `<span class="secondary-label">Complementar</span>` : ""}</h4><p>${escapeHtml(item.reference || "Sem referência")}</p></div>
      <div class="tracking-amount"><strong>${money.format(Number(item.amount))}</strong><span class="status status-${status.className}">${status.label}</span></div>
    </article>`;
  }).join("") : `<p class="tracking-message">Nenhum serviço encontrado neste período.</p>`;
  document.getElementById("loadingPanel").classList.add("hidden");
  document.getElementById("errorPanel").classList.add("hidden");
  document.getElementById("trackingPanel").classList.remove("hidden");
}

async function loadTracking() {
  const queryCode = new URLSearchParams(location.search).get("access");
  if (queryCode) {
    sessionStorage.setItem(trackingTokenKey, queryCode);
    history.replaceState({}, "", location.pathname);
  }
  const accessCode = queryCode || sessionStorage.getItem(trackingTokenKey);
  if (!accessCode) throw new Error("Este link de acompanhamento é inválido.");
  document.getElementById("loadingPanel").classList.remove("hidden");
  document.getElementById("errorPanel").classList.add("hidden");
  render(await requestData(accessCode));
}

document.getElementById("refreshButton").addEventListener("click", () => {
  loadTracking().catch(showError);
});

function showError(error) {
  document.getElementById("loadingPanel").classList.add("hidden");
  document.getElementById("trackingPanel").classList.add("hidden");
  const target = document.getElementById("errorPanel");
  target.textContent = error.message;
  target.classList.remove("hidden");
}

loadTracking().catch(showError);
