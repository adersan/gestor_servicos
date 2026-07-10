(function () {
  const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const date = (value) => value?.split("-").reverse().join("/") || "";
  const escape = (value) => String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
  const normalized = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const accessCode = new URLSearchParams(location.search).get("acesso") || sessionStorage.getItem("supplier-access");
  if (accessCode) {
    sessionStorage.setItem("supplier-access", accessCode);
    history.replaceState({}, "", "/fornecedor.html");
  }
  let data;
  let search = "";
  let refreshInProgress = false;

  function todayForPeriod() {
    const today = new Date().toISOString().slice(0, 10);
    if (today < data.period.startDate) return data.period.startDate;
    if (today > data.period.endDate) return data.period.endDate;
    return today;
  }

  async function request(body) {
    const response = await fetch("/.netlify/functions/supplier-portal-save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, accessCode })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Não foi possível concluir esta ação.");
    return result;
  }

  async function load() {
    const response = await fetch("/.netlify/functions/supplier-portal-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessCode })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    data = result;
    render();
  }

  async function refresh() {
    if (refreshInProgress) return;
    refreshInProgress = true;
    const button = document.getElementById("refreshData");
    button.disabled = true;
    button.textContent = "Atualizando...";
    try {
      await load();
    } catch (error) {
      alert(error.message || "Não foi possível atualizar os dados.");
    } finally {
      refreshInProgress = false;
      button.disabled = false;
      button.textContent = "Atualizar";
    }
  }

  function entryMarkup(item) {
    const permissions = data.permissions;
    const canEdit = permissions.canEdit && item.status !== "Cancelado";
    const canMarkDone = permissions.canMarkDone && item.status === "A fazer";
    const canCancel = permissions.canCancel && item.status !== "Cancelado";
    const linkedNote = /^vinculado a\b/i.test(String(item.notes || "").trim());
    const showNote = item.notes && (!linkedNote || permissions.showLinkedNotes);
    return `<article class="entry ${item.status === "Feito" ? "done" : ""} ${item.status === "Cancelado" ? "cancelled" : ""}">
      <time>${date(item.service_date)}</time>
      <div>
        <h3>${escape(item.service_name)}</h3>
        <span class="entry-reference">${escape(item.reference || "Sem referência")}</span>
        ${showNote ? `<span class="meta entry-note">${escape(item.notes)}</span>` : ""}
        ${item.cancellation_reason ? `<span class="meta entry-note"><strong>Motivo:</strong> ${escape(item.cancellation_reason)}</span>` : ""}
        ${item.last_changed_by === "Fornecedor" ? `<span class="changed-label">Alterado pelo fornecedor</span>` : ""}
      </div>
      <div class="entry-value"><strong>${money.format(Number(item.amount))}</strong><span class="status ${normalized(item.status).replace(/\s/g, "-")}">${escape(item.status)}</span></div>
      <div class="entry-actions">
        ${canMarkDone ? `<button class="success" data-mark-done="${item.id}">Marcar como feito</button>` : ""}
        ${canEdit ? `<button data-edit="${item.id}">Editar</button>` : ""}
        ${canCancel ? `<button class="danger" data-cancel="${item.id}">Cancelar</button>` : ""}
      </div>
    </article>`;
  }

  function renderCharts(active, cancelled) {
    const pending = active.filter((item) => item.status === "A fazer").length;
    const done = active.filter((item) => item.status === "Feito").length;
    const total = Math.max(1, pending + done + cancelled.length);
    const pendingEnd = pending / total * 100;
    const doneEnd = (pending + done) / total * 100;
    document.getElementById("statusChart").innerHTML = `
      <div class="donut" style="--pending:${pendingEnd}%;--done:${doneEnd}%"></div>
      <div class="chart-legend">
        <div><span style="--dot:var(--orange)">A fazer</span><strong>${pending}</strong></div>
        <div><span style="--dot:var(--green)">Feitos</span><strong>${done}</strong></div>
        <div><span style="--dot:var(--red)">Cancelados</span><strong>${cancelled.length}</strong></div>
      </div>`;

    const grouped = Object.values(active.reduce((result, item) => {
      result[item.service_name] ||= { name: item.service_name, count: 0 };
      result[item.service_name].count += 1;
      return result;
    }, {})).sort((a, b) => b.count - a.count).slice(0, 6);
    const max = Math.max(1, ...grouped.map((item) => item.count));
    document.getElementById("serviceChart").innerHTML = grouped.length ? grouped.map((item) => `
      <div class="bar-row"><span>${escape(item.name)}</span><div class="bar-track"><div class="bar-fill" style="width:${item.count / max * 100}%"></div></div><strong>${item.count}</strong></div>
    `).join("") : `<div class="empty">Sem dados para o gráfico.</div>`;
  }

  function renderSupplySummary(entries) {
    const grouped = Object.values(entries.filter((item) => item.status !== "Cancelado").reduce((result, item) => {
      result[item.service_name] ||= { name: item.service_name, count: 0, total: 0 };
      result[item.service_name].count += 1;
      result[item.service_name].total += Number(item.amount);
      return result;
    }, {})).sort((a, b) => b.total - a.total);
    const total = grouped.reduce((sum, item) => sum + item.total, 0);
    document.getElementById("supplyGrandTotal").textContent = money.format(total);
    document.getElementById("supplySummary").innerHTML = grouped.length ? grouped.map((item) => `
      <div class="supply-row"><strong>${escape(item.name)}</strong><span>${item.count} serviço(s)</span><strong>${money.format(item.total)}</strong></div>
    `).join("") : `<div class="empty">Nenhum fornecimento no período.</div>`;
  }

  function serviceOptionLabel(item) {
    if (!item) return "";
    const name = item.code ? `${item.code} - ${item.name}` : item.name;
    return `${name} · ${money.format(Number(item.default_cost))}`;
  }

  function serviceMatch(value) {
    const search = normalized(value).trim();
    if (!search) return null;
    const exact = data.services.find((item) =>
      normalized(serviceOptionLabel(item)) === search
      || normalized(item.name) === search
      || normalized(item.code) === search);
    if (exact) return exact;
    const partial = data.services.filter((item) => normalized(serviceOptionLabel(item)).includes(search));
    return partial.length === 1 ? partial[0] : null;
  }

  function syncServiceSelection() {
    const form = document.getElementById("entryForm");
    const previousServiceId = form.elements.serviceId.value;
    const service = serviceMatch(form.elements.serviceSearch.value);
    form.elements.serviceId.value = service?.id || "";
    if (service && form.elements.serviceId.value !== previousServiceId) {
      form.elements.amount.value = Number(service.default_cost).toFixed(2);
    }
    return service;
  }

  function paidForPayable(payableId) {
    return data.payments.filter((item) => item.payable_id === payableId)
      .reduce((sum, item) => sum + Number(item.amount), 0);
  }

  function openForPayable(payable) {
    return Math.max(0, Number(payable.total_due) - paidForPayable(payable.id));
  }

  function syncPixField() {
    const form = document.getElementById("paymentPreferenceForm");
    const pixField = form.querySelector("[data-pix-field]");
    const isPix = form.elements.method.value === "PIX";
    pixField.classList.toggle("hidden", !isPix);
    form.elements.pixKey.required = isPix;
  }

  function renderPaymentPreference() {
    const panel = document.getElementById("paymentPreferencePanel");
    const payable = data.payables.find((item) => openForPayable(item) > 0.001) || data.payables[0];
    panel.classList.toggle("hidden", !payable);
    if (!payable) return;
    const preference = payable.snapshot?.paymentPreference || {};
    const openAmount = openForPayable(payable);
    const form = document.getElementById("paymentPreferenceForm");
    form.elements.payableId.value = payable.id;
    form.elements.method.value = preference.method || "PIX";
    form.elements.pixKey.value = preference.pixKey || "";
    form.elements.holder.value = preference.holder || "";
    form.elements.amount.value = Number(preference.amount || openAmount).toFixed(2);
    form.elements.amount.max = openAmount.toFixed(2);
    form.elements.note.value = preference.note || "";
    form.querySelector('button[type="submit"]').disabled = openAmount <= 0.001;
    document.getElementById("paymentPreferenceMessage").textContent = preference.updatedAt
      ? `Dados atualizados em ${new Date(preference.updatedAt).toLocaleString("pt-BR")}. Valor solicitado: ${money.format(Number(preference.amount || 0))}.`
      : openAmount > 0.001 ? `Saldo disponível para solicitação: ${money.format(openAmount)}.` : "Esta conta já está quitada.";
    syncPixField();
  }

  function render() {
    const permissions = data.permissions || {};
    document.getElementById("message").classList.add("hidden");
    document.getElementById("content").classList.remove("hidden");
    document.querySelector("h1").textContent = data.supplier.name;
    document.getElementById("period").textContent = `${date(data.period.startDate)} a ${date(data.period.endDate)}`;
    const permissionLabels = [
      permissions.canEdit && "Lançamentos",
      permissions.canMarkDone && "Marcar feitos",
      permissions.canCancel && "Cancelamentos",
      permissions.showLinkedNotes && "Vínculos visíveis",
      permissions.showEntries ? "Lista detalhada" : "Somente resumo"
    ].filter(Boolean);
    document.getElementById("permissionSummary").innerHTML = permissionLabels.length
      ? permissionLabels.map((item) => `<span class="permission-pill">${item}</span>`).join("")
      : `<span class="permission-pill">Somente leitura</span>`;

    const active = data.entries.filter((item) => item.status !== "Cancelado");
    const done = active.filter((item) => item.status === "Feito");
    const cancelled = data.entries.filter((item) => item.status === "Cancelado");
    const total = active.reduce((sum, item) => sum + Number(item.amount), 0);
    const paid = data.payments.reduce((sum, item) => sum + Number(item.amount), 0);
    document.getElementById("summary").innerHTML = `
      <article class="summary-total"><span>Serviços</span><strong>${active.length}</strong></article>
      <article class="summary-pending"><span>A fazer</span><strong>${active.filter((item) => item.status === "A fazer").length}</strong></article>
      <article class="summary-done"><span>Feitos</span><strong>${done.length}</strong></article>
      <article class="summary-cancelled"><span>Cancelados</span><strong>${cancelled.length}</strong></article>
      <article class="summary-paid"><span>Total lançado</span><strong>${money.format(total)}</strong></article>`;
    renderCharts(active, cancelled);

    document.getElementById("openEntryEditor").classList.toggle("hidden", !permissions.canEdit);
    const form = document.getElementById("entryForm");
    document.getElementById("entryServiceOptions").innerHTML = data.services
      .map((item) => `<option value="${escape(serviceOptionLabel(item))}"></option>`)
      .join("");
    form.elements.date.min = data.period.startDate;
    form.elements.date.max = data.period.endDate;
    form.elements.status.closest("label").classList.toggle("hidden", !permissions.canMarkDone);
    if (!form.elements.entryId.value) form.elements.date.value = todayForPeriod();

    const statusOrder = { "A fazer": 0, "Feito": 1, "Cancelado": 2 };
    document.getElementById("supplierEntriesSection").classList.toggle("hidden", !permissions.showEntries);
    const filtered = data.entries.filter((item) =>
      normalized([item.reference, item.service_name].join(" ")).includes(normalized(search))
    ).sort((a, b) => {
      const statusDifference = (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
      if (statusDifference) return statusDifference;
      const dateDifference = String(b.service_date || "").localeCompare(String(a.service_date || ""));
      if (dateDifference) return dateDifference;
      return String(b.updated_at || "").localeCompare(String(a.updated_at || ""));
    });
    document.getElementById("entries").innerHTML = permissions.showEntries && filtered.length
      ? filtered.map(entryMarkup).join("")
      : permissions.showEntries ? `<div class="empty">Nenhum serviço encontrado.</div>` : "";
    document.getElementById("payables").innerHTML = data.payables.length ? data.payables.map((item) =>
      `<div class="payable payable-detail"><div><strong>${date(item.period_start)} a ${date(item.period_end)}</strong><span>${escape(openForPayable(item) <= 0.001 ? "Paga" : paidForPayable(item.id) > 0 ? "Parcial" : item.status)}</span>${item.snapshot?.paymentPreference ? `<small>Forma informada: ${escape(item.snapshot.paymentPreference.method)} · ${money.format(Number(item.snapshot.paymentPreference.amount || 0))}</small>` : ""}</div><span>Total<strong>${money.format(Number(item.total_due))}</strong></span><span>Pago<strong>${money.format(paidForPayable(item.id))}</strong></span><span>Saldo<strong>${money.format(openForPayable(item))}</strong></span></div>`
    ).join("") : `<div class="empty">Nenhum fechamento no período.</div>`;
    renderSupplySummary(data.entries);
    renderPaymentPreference();
  }

  function resetForm() {
    const form = document.getElementById("entryForm");
    form.reset();
    form.elements.entryId.value = "";
    form.elements.date.value = todayForPeriod();
    document.getElementById("editorTitle").textContent = "Lançar serviço";
  }

  function closeEntryDialog() {
    document.getElementById("entryDialog").close();
    resetForm();
  }

  document.getElementById("entrySearch").addEventListener("input", (event) => {
    search = event.target.value;
    render();
  });
  document.getElementById("refreshData").addEventListener("click", refresh);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !document.querySelector("dialog[open]")) refresh();
  });
  document.getElementById("entryForm").addEventListener("input", (event) => {
    if (event.target.name === "serviceSearch") syncServiceSelection();
  });
  document.getElementById("entryForm").addEventListener("change", (event) => {
    if (event.target.name === "serviceSearch") syncServiceSelection();
  });
  document.getElementById("paymentPreferenceForm").addEventListener("change", (event) => {
    if (event.target.name === "method") syncPixField();
  });
  document.getElementById("paymentPreferenceForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = event.submitter;
    const message = document.getElementById("paymentPreferenceMessage");
    button.disabled = true;
    button.textContent = "Salvando...";
    try {
      await request({ action: "payment_preference", ...Object.fromEntries(new FormData(form)) });
      message.textContent = "Forma de recebimento salva com segurança.";
      await load();
    } catch (error) {
      message.textContent = error.message;
    } finally {
      button.disabled = false;
      button.textContent = "Salvar forma de recebimento";
    }
  });
  document.getElementById("entryForm").addEventListener("submit", async (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const form = event.currentTarget;
    const button = event.submitter;
    if (!syncServiceSelection()) {
      alert("Selecione um serviço válido da lista.");
      form.elements.serviceSearch.focus();
      return;
    }
    button.disabled = true;
    try {
      await request({ action: "save", ...Object.fromEntries(new FormData(form)) });
      document.getElementById("entryDialog").close();
      resetForm();
      await load();
    } catch (error) {
      alert(error.message);
    } finally {
      button.disabled = false;
    }
  });
  document.getElementById("openEntryEditor").addEventListener("click", () => {
    resetForm();
    document.getElementById("entryDialog").showModal();
  });
  document.getElementById("cancelEdit").addEventListener("click", closeEntryDialog);
  document.getElementById("entryDialog").addEventListener("close", resetForm);
  document.getElementById("cancelForm").addEventListener("submit", async (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await request({ action: "cancel", ...Object.fromEntries(new FormData(form)) });
      form.closest("dialog").close();
      await load();
    } catch (error) {
      alert(error.message);
    }
  });
  document.addEventListener("click", async (event) => {
    const editButton = event.target.closest("[data-edit]");
    if (editButton) {
      const item = data.entries.find((entry) => entry.id === editButton.dataset.edit);
      const form = document.getElementById("entryForm");
      form.elements.entryId.value = item.id;
      const service = data.services.find((entry) => entry.id === item.supplier_service_id);
      form.elements.serviceId.value = service?.id || item.supplier_service_id || "";
      form.elements.serviceSearch.value = serviceOptionLabel(service);
      form.elements.date.value = item.service_date;
      form.elements.reference.value = item.reference || "";
      form.elements.amount.value = Number(item.amount).toFixed(2);
      form.elements.status.value = item.status;
      form.elements.notes.value = item.notes || "";
      document.getElementById("editorTitle").textContent = "Editar serviço";
      document.getElementById("entryDialog").showModal();
    }
    const doneButton = event.target.closest("[data-mark-done]");
    if (doneButton && confirm("Confirmar que este serviço foi feito?")) {
      try {
        await request({ action: "mark_done", entryId: doneButton.dataset.markDone });
        await load();
      } catch (error) { alert(error.message); }
    }
    const cancelButton = event.target.closest("[data-cancel]");
    if (cancelButton) {
      const item = data.entries.find((entry) => entry.id === cancelButton.dataset.cancel);
      const form = document.getElementById("cancelForm");
      form.reset();
      form.elements.entryId.value = item.id;
      document.getElementById("cancelDescription").textContent = `${item.service_name} · ${item.reference || "Sem referência"}`;
      document.getElementById("cancelDialog").showModal();
    }
    if (event.target.closest("[data-close-cancel]")) document.getElementById("cancelDialog").close();
  });

  load().catch((error) => {
    const message = document.getElementById("message");
    message.textContent = error.message || "Não foi possível abrir este acesso.";
    message.classList.add("error");
  });
})();
