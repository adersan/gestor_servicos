(function () {
  const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const date = (value) => value?.split("-").reverse().join("/") || "";
  const escape = (value) => String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
  const accessCode = new URLSearchParams(location.search).get("acesso") || sessionStorage.getItem("supplier-access");
  if (accessCode) { sessionStorage.setItem("supplier-access", accessCode); history.replaceState({}, "", "/fornecedor.html"); }
  let data;

  async function load() {
    const response = await fetch("/.netlify/functions/supplier-portal-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessCode }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    data = result; render();
  }

  function render() {
    document.getElementById("message").classList.add("hidden");
    document.getElementById("content").classList.remove("hidden");
    document.querySelector("h1").textContent = data.supplier.name;
    document.getElementById("period").textContent = `${date(data.period.startDate)} a ${date(data.period.endDate)}${data.canEdit ? " · Alterações autorizadas" : " · Somente leitura"}`;
    const active = data.entries.filter((item) => item.status !== "Cancelado");
    const total = active.reduce((sum, item) => sum + Number(item.amount), 0);
    const paid = data.payments.reduce((sum, item) => sum + Number(item.amount), 0);
    document.getElementById("summary").innerHTML = `
      <article><span>Serviços</span><strong>${active.length}</strong></article><article><span>A fazer</span><strong>${active.filter((item) => item.status === "A fazer").length}</strong></article>
      <article><span>Total lançado</span><strong>${money.format(total)}</strong></article><article><span>Pagamentos</span><strong>${money.format(paid)}</strong></article>`;
    const editor = document.getElementById("editor");
    editor.classList.toggle("hidden", !data.canEdit);
    const form = document.getElementById("entryForm");
    form.elements.serviceId.innerHTML = `<option value="">Selecione</option>${data.services.map((item) => `<option value="${item.id}" data-cost="${item.default_cost}">${escape(item.code ? `${item.code} - ${item.name}` : item.name)}</option>`).join("")}`;
    document.getElementById("entries").innerHTML = data.entries.length ? data.entries.map((item) => `
      <article class="entry"><time>${date(item.service_date)}</time><div><h3>${escape(item.service_name)}</h3><span class="meta">${escape(item.reference || "Sem referência")} · ${escape(item.notes || "")}</span></div>
      <span class="status ${item.status === "Feito" ? "feito" : ""}">${item.status}</span><div><strong>${money.format(Number(item.amount))}</strong>${data.canEdit ? `<button data-edit="${item.id}">Editar</button>` : ""}</div></article>`).join("") : "<p>Nenhum serviço no período.</p>";
    document.getElementById("payables").innerHTML = data.payables.length ? data.payables.map((item) => `<div class="payable"><span>${date(item.period_start)} a ${date(item.period_end)} · ${item.status}</span><strong>${money.format(Number(item.total_due))}</strong></div>`).join("") : "<p>Nenhum fechamento no período.</p>";
  }

  document.getElementById("entryForm").addEventListener("change", (event) => {
    if (event.target.name === "serviceId") event.currentTarget.elements.amount.value = Number(event.target.selectedOptions[0]?.dataset.cost || 0).toFixed(2);
  });
  document.getElementById("entryForm").addEventListener("submit", async (event) => {
    event.preventDefault(); const form = event.currentTarget; const body = Object.fromEntries(new FormData(form));
    const response = await fetch("/.netlify/functions/supplier-portal-save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, accessCode }) });
    const result = await response.json(); if (!response.ok) return alert(result.error);
    form.reset(); await load();
  });
  document.getElementById("cancelEdit").addEventListener("click", () => document.getElementById("entryForm").reset());
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-edit]"); if (!button) return;
    const item = data.entries.find((entry) => entry.id === button.dataset.edit); const form = document.getElementById("entryForm");
    form.elements.entryId.value = item.id; form.elements.serviceId.value = item.supplier_service_id; form.elements.date.value = item.service_date;
    form.elements.reference.value = item.reference || ""; form.elements.amount.value = Number(item.amount).toFixed(2); form.elements.status.value = item.status; form.elements.notes.value = item.notes || "";
    document.getElementById("editor").scrollIntoView({ behavior: "smooth" });
  });
  load().catch((error) => { const message = document.getElementById("message"); message.textContent = error.message || "Não foi possível abrir este acesso."; message.classList.add("error"); });
})();
