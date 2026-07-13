(function () {
  let activeTab = "dashboard";
  let clientSupplierServiceValues = [];
  let generatedSupplierAccessUrl = "";
  let generatedSupplierAccessText = "";
  let activeSupplierReportId = "";
  let supplierRequestShareResolver = null;

  const byId = (id) => document.getElementById(id);
  const today = () => new Date().toISOString().slice(0, 10);
  const supplierById = (id) => state.suppliers.find((item) => item.id === id);
  const supplierServiceById = (id) => state.supplierServices.find((item) => item.id === id);
  const clientName = (id) => clientById(id)?.name || "";
  const normalized = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const empty = () => `<div class="empty"><strong>Nenhum registro.</strong><span>Use os botões acima para começar.</span></div>`;

  function originCancelledNote(item) {
    const linkedService = state.services.find((service) => service.id === item?.clientServiceEntryId);
    const note = String(item?.notes || linkedService?.notes || "");
    const reason = note.match(/cancelad[ao] por:\s*(.+)$/i)?.[1]
      || note.match(/origem cancelada motivo:\s*(.+)$/i)?.[1]
      || item?.cancellationReason
      || linkedService?.cancellationReason
      || "";
    if (!reason) return "";
    const primary = linkedService?.isSecondary ? state.services.find((service) => service.id === linkedService.primaryEntryId) : null;
    const originName = note.match(/^(.+?) cancelad[ao] por:/i)?.[1] || primary?.description || "Servico de origem";
    return `${originName} cancelado por ${reason}`;
  }

  function defaultSupplier() {
    return state.suppliers.find((item) => item.isDefault) || state.suppliers[0];
  }

  function payablePaid(payable) {
    return state.supplierPayments
      .filter((item) => item.payableId === payable.id)
      .reduce((sum, item) => sum + Number(item.amount), 0);
  }

  function payableOpen(payable) {
    return Math.max(0, Number(payable.amount) - payablePaid(payable));
  }

  function payableStatus(payable) {
    if (payable.status === "Cancelada") return "Cancelada";
    const paid = payablePaid(payable);
    if (!paid) return "Aberta";
    return payableOpen(payable) <= 0.001 ? "Paga" : "Parcial";
  }

  function supplierOptionLabel(supplier) {
    return supplier ? `${supplier.name}${supplier.isDefault ? " (padrão)" : ""}` : "";
  }

  function uniqueSupplierMatch(value) {
    const search = normalized(value).trim();
    if (!search) return null;
    const matches = state.suppliers.filter((item) => normalized(item.name).includes(search));
    return matches.length === 1 ? matches[0] : null;
  }

  function syncSupplierSearchField(form) {
    const supplier = itemByExactLabel(state.suppliers, form.elements.supplierSearch.value, supplierOptionLabel)
      || uniqueSupplierMatch(form.elements.supplierSearch.value);
    form.elements.supplierId.value = supplier?.id || "";
    return supplier;
  }

  function supplierServiceOptionLabel(service) {
    if (!service) return "";
    const name = service.code ? `${service.code} - ${service.name}` : service.name;
    return `${name} · ${money.format(service.cost)}`;
  }

  function clientSupplierServiceMatch(supplierId, value) {
    const search = normalized(value).trim();
    if (!search) return null;
    const services = state.supplierServices.filter((item) => item.supplierId === supplierId);
    const exact = services.find((item) =>
      normalized(supplierServiceOptionLabel(item)) === search
      || normalized(item.name) === search
      || normalized(item.code) === search
    );
    if (exact) return exact;
    const partial = services.filter((item) => normalized(supplierServiceOptionLabel(item)).includes(search));
    return partial.length === 1 ? partial[0] : null;
  }

  function setClientSupplierServiceError(message = "") {
    const form = byId("serviceForm");
    const field = form.elements.supplierServiceSearch;
    const invalid = Boolean(message);
    field.setCustomValidity(message);
    field.setAttribute("aria-invalid", String(invalid));
    byId("clientSupplierServiceField").classList.toggle("field-invalid", invalid);
    byId("clientSupplierServiceError").textContent = message;
    byId("clientSupplierServiceError").classList.toggle("hidden", !invalid);
  }

  function fillSelects() {
    const ids = [
      "supplierDashboardFilter", "supplierEntrySupplierFilter",
      "supplierPayableSupplierFilter"
    ];
    ids.forEach((id) => {
      const field = byId(id);
      if (!field) return;
      const selected = field.value;
      field.innerHTML = `<option value="">Todos os fornecedores</option>${state.suppliers.map((item) =>
        `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("")}`;
      field.value = selected;
    });
    byId("supplierOptions").innerHTML = [...state.suppliers]
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      .map((item) => `<option value="${escapeHtml(supplierOptionLabel(item))}"></option>`)
      .join("");
  }

  function renderDashboard() {
    const supplierId = byId("supplierDashboardFilter").value;
    const start = byId("supplierDashboardStart").value;
    const end = byId("supplierDashboardEnd").value;
    const entries = state.supplierEntries.filter((item) =>
      item.status !== "Cancelado"
      && (!supplierId || item.supplierId === supplierId)
      && (!start || item.date >= start)
      && (!end || item.date <= end)
    );
    const total = entries.reduce((sum, item) => sum + Number(item.amount), 0);
    const pendingEntries = entries.filter((item) => item.status === "A fazer");
    const doneEntries = entries.filter((item) => item.status === "Feito");
    const pendingTotal = pendingEntries.reduce((sum, item) => sum + Number(item.amount), 0);
    const doneTotal = doneEntries.reduce((sum, item) => sum + Number(item.amount), 0);
    const open = state.supplierPayables
      .filter((item) => item.status !== "Cancelada" && (!supplierId || item.supplierId === supplierId))
      .reduce((sum, item) => sum + payableOpen(item), 0);
    byId("supplierDashboardCards").innerHTML = `
      <article class="metric-card supplier-card-total"><span>Serviços no período</span><strong>${entries.length}</strong><small>Custos registrados</small></article>
      <article class="metric-card supplier-card-cost"><span>Custo no período</span><strong>${money.format(total)}</strong><small>Antes das baixas</small></article>
      <article class="metric-card supplier-card-pending"><span>A fazer</span><strong>${pendingEntries.length}</strong><small>${money.format(pendingTotal)} em produção</small></article>
      <article class="metric-card supplier-card-done"><span>Feitos</span><strong>${doneEntries.length}</strong><small>${money.format(doneTotal)} concluídos</small></article>
      <article class="metric-card metric-main supplier-card-open"><span>Total a pagar</span><strong>${money.format(open)}</strong><small>Contas abertas e parciais</small></article>`;

    const ranking = Object.values(entries.reduce((result, item) => {
      result[item.supplierId] ||= { supplierId: item.supplierId, count: 0, total: 0 };
      result[item.supplierId].count += 1;
      result[item.supplierId].total += Number(item.amount);
      return result;
    }, {})).sort((a, b) => b.total - a.total);
    byId("supplierRanking").innerHTML = ranking.length ? ranking.map((item, index) => `
      <div class="ranking-row"><strong>${index + 1}</strong><span>${escapeHtml(supplierById(item.supplierId)?.name || "")}</span><small>${item.count} serviço(s)</small><strong>${money.format(item.total)}</strong></div>`
    ).join("") : empty();

    const statuses = [
      { status: "A fazer", count: pendingEntries.length, total: pendingTotal, className: "pending" },
      { status: "Feito", count: doneEntries.length, total: doneTotal, className: "done" }
    ];
    byId("supplierStatusSummary").innerHTML = `<div class="supplier-status-grid">${statuses.map((item) =>
      `<article class="supplier-status-${item.className}"><span>${item.status}</span><strong>${item.count}</strong><small>${money.format(item.total)}</small></article>`).join("")}</div>`;
  }

  function renderRecords() {
    const supplierSearch = normalized(byId("supplierSearch").value);
    const suppliers = state.suppliers.filter((item) =>
      normalized([item.name, item.phone, item.document].join(" ")).includes(supplierSearch));
    byId("supplierList").innerHTML = suppliers.length ? suppliers.map((item) => `
      <article class="price-table-card">
        <span class="eyebrow">${item.isDefault ? "Fornecedor padrão" : "Fornecedor"}</span>
        <h3>${escapeHtml(item.name)}</h3>
        <p class="meta">${escapeHtml(item.phone || "Sem telefone")} · ${escapeHtml(item.document || "Sem documento")}</p>
        <div class="card-actions"><button class="table-action" data-edit-supplier="${item.id}">Editar</button><button class="table-action danger" data-delete-supplier="${item.id}">Excluir</button></div>
      </article>`).join("") : empty();

    const serviceSearch = normalized(byId("supplierServiceSearch").value);
    const services = state.supplierServices.filter((item) =>
      normalized([item.code, item.name, supplierById(item.supplierId)?.name].join(" ")).includes(serviceSearch));
    byId("supplierServiceList").innerHTML = services.length ? `<div class="catalog-table-wrap"><table class="catalog-table"><thead><tr><th>Código</th><th>Serviço</th><th>Fornecedor</th><th>Custo</th><th></th></tr></thead><tbody>${services.map((item) => `
      <tr><td>${escapeHtml(item.code || "-")}</td><td>${escapeHtml(item.name)}</td><td>${escapeHtml(supplierById(item.supplierId)?.name || "")}</td><td>${money.format(item.cost)}</td>
      <td><div class="row-actions"><button class="table-action" data-edit-supplier-service="${item.id}">Editar</button><button class="table-action danger" data-delete-supplier-service="${item.id}">Excluir</button></div></td></tr>`).join("")}</tbody></table></div>` : empty();
  }

  function renderEntries() {
    const supplierId = byId("supplierEntrySupplierFilter").value;
    const clientId = byId("supplierEntryClientFilter").value;
    const status = byId("supplierEntryStatusFilter").value;
    const start = byId("supplierEntryStart").value;
    const end = byId("supplierEntryEnd").value;
    const search = normalized(byId("supplierEntrySearch").value);
    byId("supplierEntryPeriodLabel").textContent = start && end
      ? `${formatDate(start)} a ${formatDate(end)}`
      : "Todos os períodos";
    const statusOrder = { "A fazer": 0, "Feito": 1, "Entregue": 2, "Cancelado": 3 };
    const entries = [...state.supplierEntries].filter((item) =>
      (!supplierId || item.supplierId === supplierId)
      && (!clientId || item.clientId === clientId)
      && (!status || item.status === status)
      && (!start || item.date >= start)
      && (!end || item.date <= end)
      && normalized([item.description, item.reference, clientName(item.clientId), supplierById(item.supplierId)?.name].join(" ")).includes(search)
    ).sort((a, b) => {
      const statusDifference = (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
      if (statusDifference) return statusDifference;
      const dateDifference = b.date.localeCompare(a.date);
      if (dateDifference) return dateDifference;
      return String(b.createdAt || b.updatedAt || "").localeCompare(String(a.createdAt || a.updatedAt || ""));
    });
    byId("supplierEntryList").innerHTML = entries.length ? entries.map((item) => `
      <article class="supplier-entry-row ${item.payableId ? "supplier-entry-closed" : ""}">
        <time>${formatDate(item.date)}</time>
        <div>
          <span class="eyebrow">${escapeHtml(supplierById(item.supplierId)?.name || "")}</span>
          <h3 class="service-card-description">${escapeHtml(item.description)}</h3>
          <p class="service-card-reference">${escapeHtml(item.reference || "Sem referência")}</p>
          ${originCancelledNote(item) ? `<span class="origin-cancelled-label">${escapeHtml(originCancelledNote(item))}</span>` : ""}
          <p class="meta service-card-context">${item.clientId ? escapeHtml(clientName(item.clientId)) : "Sem cliente vinculado"} · ${escapeHtml(item.source)}</p>
          ${item.lastChangedBy === "Fornecedor" ? `<span class="supplier-change-label">Alterado pelo fornecedor</span>` : ""}
          ${item.doneAt || item.deliveredAt ? `<p class="service-status-dates">${item.doneAt ? `Feito em ${new Date(item.doneAt).toLocaleString("pt-BR")}` : ""}${item.doneAt && item.deliveredAt ? " · " : ""}${item.deliveredAt ? `Entregue em ${new Date(item.deliveredAt).toLocaleString("pt-BR")}` : ""}</p>` : ""}
          ${item.status === "Cancelado" ? `<p class="cancellation-reason"><strong>Motivo:</strong> ${escapeHtml(item.cancellationReason || "Não informado")}${item.cancellationOriginalAmount !== null && item.cancellationOriginalAmount !== undefined ? ` · Custo anterior: ${money.format(item.cancellationOriginalAmount)}` : ""}</p>` : ""}
        </div>
        <div><span class="status status-${normalized(item.status).replace(/\s/g, "-")}">${item.status}</span><strong>${money.format(item.amount)}</strong></div>
        <div class="service-actions">
          ${item.status !== "Cancelado" ? `<div class="status-actions">
            ${item.status === "A fazer" ? `<button class="table-action success" data-supplier-entry-status="Feito" data-entry-id="${item.id}" ${item.payableId ? "disabled" : ""}>Marcar feito</button>` : ""}
            ${item.status === "Feito" ? `<button class="table-action success" data-supplier-entry-status="Entregue" data-entry-id="${item.id}" ${item.payableId ? "disabled" : ""}>Marcar entregue</button><button class="table-action" data-supplier-entry-status="A fazer" data-entry-id="${item.id}" ${item.payableId ? "disabled" : ""}>Voltar para A fazer</button>` : ""}
            ${item.status === "Entregue" ? `<button class="table-action" data-supplier-entry-status="Feito" data-entry-id="${item.id}" ${item.payableId ? "disabled" : ""}>Voltar para Feito</button>` : ""}
          </div>` : ""}
          <div class="row-actions">
            ${item.status !== "Cancelado" ? `<button class="table-action" data-edit-supplier-entry="${item.id}" ${item.payableId ? "disabled" : ""}>Editar</button><button class="table-action danger" data-cancel-supplier-entry="${item.id}" ${item.payableId ? "disabled" : ""}>Cancelar</button>` : ""}
            <button class="table-action danger" data-delete-supplier-entry="${item.id}" ${item.payableId ? "disabled" : ""}>Excluir</button>
          </div>
        </div>
      </article>`).join("") : empty();
  }

  function renderPayables() {
    state.supplierPayables.forEach((item) => { item.status = payableStatus(item); });
    const supplierId = byId("supplierPayableSupplierFilter").value;
    const status = byId("supplierPayableStatusFilter").value;
    const payables = state.supplierPayables.filter((item) =>
      (!supplierId || item.supplierId === supplierId)
      && (!status || (status === "open" ? payableOpen(item) > 0 : payableStatus(item) === "Paga"))
      && item.status !== "Cancelada"
    );
    const totalOpen = state.supplierPayables.filter((item) => item.status !== "Cancelada")
      .reduce((sum, item) => sum + payableOpen(item), 0);
    const paid = state.supplierPayments.reduce((sum, item) => sum + Number(item.amount), 0);
    byId("supplierPayableSummary").innerHTML = `
      <article class="metric-card metric-main"><span>Total a pagar</span><strong>${money.format(totalOpen)}</strong><small>Saldo atual</small></article>
      <article class="metric-card"><span>Total já pago</span><strong>${money.format(paid)}</strong><small>Histórico de baixas</small></article>
      <article class="metric-card"><span>Contas abertas</span><strong>${state.supplierPayables.filter((item) => payableOpen(item) > 0 && item.status !== "Cancelada").length}</strong><small>Inclui parciais</small></article>`;
    byId("supplierPayableList").innerHTML = payables.length ? payables.map((item) => `
      <article class="receivable-card">
        <div class="receivable-heading"><div><span class="eyebrow">${formatDate(item.startDate)} a ${formatDate(item.endDate)}</span><h3>${escapeHtml(supplierById(item.supplierId)?.name || "")}</h3></div><span class="billing-status billing-${payableStatus(item).toLowerCase()}">${payableStatus(item)}</span></div>
        <div class="receivable-values"><span>Valor original<strong>${money.format(item.amount)}</strong></span><span>Pago<strong>${money.format(payablePaid(item))}</strong></span><span>Saldo<strong>${money.format(payableOpen(item))}</strong></span></div>
        ${item.snapshot?.paymentPreference ? `<p class="supplier-preference-badge">Recebimento informado: <strong>${escapeHtml(item.snapshot.paymentPreference.method)}</strong> · ${money.format(Number(item.snapshot.paymentPreference.amount || 0))}</p>` : ""}
        <div class="supplier-payable-buttons">
          <button class="table-action" data-supplier-report="${item.id}">Abrir conta</button>
          <button class="table-action whatsapp-action" data-supplier-share="${item.id}">Compartilhar</button>
          ${payableOpen(item) > 0 ? `<button class="table-action" data-pay-supplier="${item.id}" data-mode="partial">Baixa parcial</button><button class="table-action success" data-pay-supplier="${item.id}" data-mode="full">Quitar</button>` : ""}
          ${!payablePaid(item) ? `<button class="table-action danger" data-cancel-supplier-payable="${item.id}">Cancelar conta</button>` : ""}
        </div>
      </article>`).join("") : empty();
    byId("supplierPaymentList").innerHTML = state.supplierPayments.length ? [...state.supplierPayments].sort((a, b) => b.date.localeCompare(a.date)).map((item) => {
      const payable = state.supplierPayables.find((entry) => entry.id === item.payableId);
      return `<article class="timeline-item supplier-payment-history"><time>${formatDate(item.date)}</time><div><h3>${escapeHtml(supplierById(item.supplierId)?.name || "")}</h3><p class="meta">${escapeHtml(item.method || "Não informada")} · ${escapeHtml(item.note || "Sem observação")}</p>${payable ? `<span class="payment-allocation">Conta de ${formatDate(payable.startDate)} a ${formatDate(payable.endDate)}</span>` : ""}</div><strong>${money.format(item.amount)}</strong><div class="row-actions">${payable ? `<button class="table-action" data-supplier-report="${payable.id}">Ver conta</button>` : ""}<button class="table-action danger" data-delete-supplier-payment="${item.id}">Excluir</button></div></article>`;
    }
    ).join("") : empty();
  }

  function render() {
    fillSelects();
    renderDashboard();
    renderRecords();
    renderEntries();
    renderPayables();
  }

  function showSupplierTab(tab) {
    activeTab = tab;
    document.querySelectorAll("[data-supplier-tab]").forEach((button) =>
      button.classList.toggle("active", button.dataset.supplierTab === tab));
    const panelNames = { dashboard: "Dashboard", records: "Records", entries: "Entries", payables: "Payables", access: "Access" };
    Object.entries(panelNames).forEach(([name, suffix]) =>
      byId(`supplier${suffix}Panel`).classList.toggle("hidden", name !== tab));
  }

  function openSupplier(item) {
    const form = byId("supplierForm");
    form.reset();
    form.elements.id.value = item?.id || "";
    form.elements.name.value = item?.name || "";
    form.elements.phone.value = item?.phone || "";
    form.elements.whatsappDestination.value = item?.whatsappDestination || "individual";
    form.elements.whatsappGroupName.value = item?.whatsappGroupName || "";
    form.elements.document.value = item?.document || "";
    form.elements.notes.value = item?.notes || "";
    form.elements.isDefault.checked = Boolean(item?.isDefault);
    byId("supplierDialogTitle").textContent = item ? "Editar fornecedor" : "Novo fornecedor";
    supplierWizard.activate(!item && window.matchMedia("(max-width: 1024px)").matches);
    byId("supplierDialog").showModal();
    if (!supplierWizard.isActive()) setTimeout(() => form.elements.name.focus(), 0);
  }

  function renderSupplierWizardSummary() {
    const form = byId("supplierForm");
    const target = byId("supplierWizardSummary");
    if (!target) return;
    const rows = [
      ["Nome", form.elements.name.value || "-"],
      form.elements.phone.value ? ["WhatsApp", form.elements.phone.value] : null,
      ["Destino das solicitações", form.elements.whatsappDestination.value === "group" ? "Grupo do WhatsApp" : "Número individual"],
      form.elements.whatsappGroupName.value ? ["Nome do grupo", form.elements.whatsappGroupName.value] : null,
      form.elements.document.value ? ["CPF ou CNPJ", form.elements.document.value] : null,
      form.elements.notes.value ? ["Observações", form.elements.notes.value] : null,
      ["Fornecedor padrão", form.elements.isDefault.checked ? "Sim" : "Não"]
    ].filter(Boolean);
    target.innerHTML = rows
      .map(([label, value]) => `<div class="wizard-summary-row"><span class="wizard-summary-label">${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
      .join("");
  }

  const supplierWizard = createDialogWizard({
    dialogId: "supplierDialog",
    formId: "supplierForm",
    navId: "supplierWizardNav",
    progressFillId: "supplierWizardProgressFill",
    progressLabelId: "supplierWizardProgressLabel",
    stepCount: 8,
    onReachLastStep: renderSupplierWizardSummary,
    validateStep: (step, form) => {
      if (step === 1 && !form.elements.name.value.trim()) {
        alert("Informe o nome do fornecedor.");
        form.elements.name.focus();
        return false;
      }
      return true;
    }
  });

  function openSupplierService(item) {
    const form = byId("supplierServiceForm");
    form.reset();
    fillSelects();
    form.elements.id.value = item?.id || "";
    form.elements.supplierId.value = item?.supplierId || defaultSupplier()?.id || "";
    form.elements.supplierSearch.value = supplierOptionLabel(supplierById(form.elements.supplierId.value));
    form.elements.code.value = item?.code || "";
    form.elements.name.value = item?.name || "";
    form.elements.cost.value = item ? Number(item.cost).toFixed(2) : "";
    byId("supplierServiceDialogTitle").textContent = item ? "Editar serviço do fornecedor" : "Novo serviço do fornecedor";
    byId("supplierServiceDialog").showModal();
  }

  function syncEntryServices(form, selected = "") {
    const supplierId = form.elements.supplierId.value;
    const services = state.supplierServices.filter((item) => item.supplierId === supplierId);
    byId("supplierEntryServiceOptions").innerHTML = services
      .map((item) => `<option value="${escapeHtml(supplierServiceOptionLabel(item))}"></option>`)
      .join("");
    const service = services.find((item) => item.id === selected) || null;
    form.elements.supplierServiceId.value = service?.id || "";
    form.elements.supplierServiceSearch.value = supplierServiceOptionLabel(service);
  }

  function syncSupplierEntryServiceSelection(form) {
    const service = clientSupplierServiceMatch(form.elements.supplierId.value, form.elements.supplierServiceSearch.value);
    form.elements.supplierServiceId.value = service?.id || "";
    if (service) form.elements.amount.value = Number(service.cost).toFixed(2);
  }

  function syncClientEntryServices(selected = "") {
    const form = byId("serviceForm");
    const supplierId = form.elements.supplierId.value;
    const services = state.supplierServices.filter((item) => item.supplierId === supplierId);
    byId("clientSupplierServiceOptions").innerHTML = services
      .map((item) => `<option value="${escapeHtml(supplierServiceOptionLabel(item))}"></option>`)
      .join("");
    const service = services.find((item) => item.id === selected);
    form.elements.supplierServiceId.value = service?.id || "";
    form.elements.supplierServiceSearch.value = supplierServiceOptionLabel(service);
    form.elements.supplierAmount.value = service ? Number(service.cost).toFixed(2) : "";
    setClientSupplierServiceError();
  }

  function syncClientEntryServiceSelection(showError = false) {
    const form = byId("serviceForm");
    const service = clientSupplierServiceMatch(
      form.elements.supplierId.value,
      form.elements.supplierServiceSearch.value
    );
    form.elements.supplierServiceId.value = service?.id || "";
    form.elements.supplierAmount.value = service ? Number(service.cost).toFixed(2) : "";
    if (service) setClientSupplierServiceError();
    else if (showError) setClientSupplierServiceError("Digite o código ou nome e escolha um serviço válido da lista.");
    return Boolean(service);
  }

  function renderClientSupplierServices() {
    byId("clientSupplierServiceList").innerHTML = clientSupplierServiceValues.map((item, index) => {
      const supplier = supplierById(item.supplierId);
      const service = supplierServiceById(item.supplierServiceId);
      return `<div class="client-supplier-service-item">
        <span>${escapeHtml(service?.name || "Serviço")}<small>${escapeHtml(supplier?.name || "Fornecedor")}</small></span>
        <strong>${money.format(item.amount)}</strong>
        ${item.locked
          ? `<span class="locked-service-note" title="Já está em uma conta a pagar e não pode ser removido aqui">Em conta</span>`
          : `<button type="button" data-remove-client-supplier-service="${index}" aria-label="Remover ${escapeHtml(service?.name || "serviço")}">×</button>`}
      </div>`;
    }).join("");
  }

  function addClientSupplierService() {
    const form = byId("serviceForm");
    syncSupplierSearchField(form);
    syncClientEntryServiceSelection(true);
    const supplierId = form.elements.supplierId.value;
    const supplierServiceId = form.elements.supplierServiceId.value;
    const amount = Number(form.elements.supplierAmount.value);
    if (!supplierId) {
      alert("Selecione o fornecedor.");
      form.elements.supplierSearch.focus();
      return false;
    }
    if (!supplierServiceId) {
      form.elements.supplierServiceSearch.focus();
      return false;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      alert("Informe um custo válido para o fornecedor.");
      form.elements.supplierAmount.focus();
      return false;
    }
    if (clientSupplierServiceValues.some((item) =>
      item.supplierId === supplierId && item.supplierServiceId === supplierServiceId)) {
      alert("Este serviço do fornecedor já foi adicionado.");
      form.elements.supplierServiceSearch.focus();
      return false;
    }
    clientSupplierServiceValues.push({ supplierId, supplierServiceId, amount });
    renderClientSupplierServices();
    form.elements.supplierServiceId.value = "";
    form.elements.supplierServiceSearch.value = "";
    form.elements.supplierAmount.value = "";
    setClientSupplierServiceError();
    form.elements.supplierServiceSearch.focus();
    return true;
  }

  function hasClientSupplierServices() {
    return clientSupplierServiceValues.length > 0;
  }

  function currentClientSupplierServiceSelections() {
    return clientSupplierServiceValues.map((item) => ({ ...item }));
  }

  function toggleClientSupplierServiceSection(hidden) {
    byId("clientSupplierServiceSection")?.classList.toggle("hidden", hidden);
    byId("clientSupplierServiceItemsSection")?.classList.toggle("hidden", hidden);
  }

  function resetClientEntryOptions(disabled = false, existingLinks = []) {
    const form = byId("serviceForm");
    const checkbox = form.elements.hasSupplierService;
    clientSupplierServiceValues = existingLinks.map((link) => ({ ...link }));
    renderClientSupplierServices();
    checkbox.checked = Boolean(clientSupplierServiceValues.length);
    checkbox.disabled = disabled || !state.suppliers.length || !state.supplierServices.length;
    toggleClientSupplierServiceSection(!clientSupplierServiceValues.length);
    form.elements.supplierId.value = defaultSupplier()?.id || "";
    form.elements.supplierSearch.value = supplierOptionLabel(defaultSupplier());
    syncClientEntryServices();
    byId("clientSupplierServiceHint").textContent = checkbox.disabled && !disabled
      ? "Cadastre um fornecedor e pelo menos um serviço para ativar esta opção."
      : "Adicione um ou mais serviços. Cada custo será lançado separadamente por placa/referência.";
  }

  function clientEntrySelection() {
    const form = byId("serviceForm");
    if (!form.elements.hasSupplierService.checked) return null;
    if (!clientSupplierServiceValues.length) {
      return {
        error: "Adicione pelo menos um serviço do fornecedor usando o botão +.",
        field: form.elements.supplierServiceSearch
      };
    }
    return clientSupplierServiceValues.map((item) => ({ ...item }));
  }

  function createForClientEntries(entries, selections) {
    if (!selections?.length || !entries?.length) return [];
    const now = new Date().toISOString();
    const created = [];
    const entriesByReference = entries.filter((entry) => !entry.isSecondary);
    entriesByReference.forEach((entry) => selections.forEach((selection) => {
      const service = supplierServiceById(selection.supplierServiceId);
      if (!service) return;
      const supplierEntry = {
        id: crypto.randomUUID(),
        supplierId: selection.supplierId,
        supplierServiceId: selection.supplierServiceId,
        clientId: entry.clientId,
        clientServiceEntryId: entry.id,
        payableId: null,
        date: entry.date,
        description: service.name,
        reference: entry.reference,
        amount: selection.amount,
        status: "A fazer",
        source: "Cliente",
        notes: `Vinculado a ${entry.description}`,
        lastChangedBy: "Administrador",
        doneAt: null,
        deliveredAt: null,
        createdAt: now,
        updatedAt: now
      };
      state.supplierEntries.push(supplierEntry);
      created.push(supplierEntry);
    }));
    clientSupplierServiceValues = [];
    renderClientSupplierServices();
    saveState();
    return created;
  }

  function supplierRequestMessage(supplier, entries, includeGreeting = false) {
    const lines = entries.map((item) => `• ${item.reference || "Sem referência"} - ${item.description}`).join("\n");
    const greeting = includeGreeting ? `Olá, ${supplier.name}!\n\n` : "";
    return `${greeting}${lines}`;
  }

  function openWhatsApp(url) {
    const whatsappWindow = window.open(url, "gestor_servicos_whatsapp");
    whatsappWindow?.focus?.();
  }

  async function shareSupplierRequests(supplierId) {
    const supplier = supplierById(supplierId);
    const selectedIds = [...document.querySelectorAll(`[data-supplier-share-entry="${supplierId}"]:checked`)]
      .map((field) => field.value);
    const entries = state.supplierEntries.filter((item) => selectedIds.includes(item.id));
    if (!supplier || !entries.length) return alert("Selecione pelo menos um serviço.");
    const includeGreeting = document.querySelector(`[data-supplier-share-greeting="${supplierId}"]`)?.checked;
    const text = supplierRequestMessage(supplier, entries, includeGreeting);
    if (supplier.whatsappDestination === "group") {
      const mobileShare = navigator.share && window.matchMedia("(pointer: coarse)").matches;
      if (mobileShare) {
        await navigator.share({ title: supplier.whatsappGroupName || supplier.name, text });
      } else {
        await navigator.clipboard.writeText(text);
        openWhatsApp("https://web.whatsapp.com/");
        alert(`Mensagem copiada. Escolha o grupo "${supplier.whatsappGroupName || supplier.name}" e cole a mensagem.`);
      }
      return;
    }
    const digits = String(supplier.phone || "").replace(/\D/g, "");
    const phone = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
    if (!phone) return alert("Cadastre o WhatsApp deste fornecedor.");
    const baseUrl = window.matchMedia("(pointer: coarse)").matches
      ? "https://api.whatsapp.com/send"
      : "https://web.whatsapp.com/send";
    openWhatsApp(`${baseUrl}?phone=${phone}&text=${encodeURIComponent(text)}`);
  }

  function offerSupplierRequestShare(entries) {
    if (!entries?.length) return Promise.resolve();
    const grouped = entries.reduce((result, item) => {
      (result[item.supplierId] ||= []).push(item);
      return result;
    }, {});
    byId("supplierRequestShareList").innerHTML = Object.entries(grouped).map(([supplierId, items]) => {
      const supplier = supplierById(supplierId);
      const destination = supplier?.whatsappDestination === "group"
        ? `Grupo: ${supplier.whatsappGroupName || "escolher no WhatsApp"}`
        : `WhatsApp: ${supplier?.phone || "não cadastrado"}`;
      return `<section class="supplier-request-share-card">
        <div><h3>${escapeHtml(supplier?.name || "Fornecedor")}</h3><span>${escapeHtml(destination)}</span></div>
        ${items.map((item) => `<label class="supplier-share-option">
          <input type="checkbox" value="${item.id}" data-supplier-share-entry="${supplierId}" checked>
          <span><strong>${escapeHtml(item.reference || "Sem referência")}</strong><small>${escapeHtml(item.description)}</small></span>
        </label>`).join("")}
        <label class="supplier-share-greeting">
          <input type="checkbox" data-supplier-share-greeting="${supplierId}">
          <span>Incluir saudação</span>
        </label>
        <button class="primary" type="button" data-share-new-supplier-entries="${supplierId}">
          ${supplier?.whatsappDestination === "group" ? "Compartilhar no WhatsApp" : "Enviar pelo WhatsApp"}
        </button>
      </section>`;
    }).join("");
    byId("supplierRequestShareDialog").showModal();
    return new Promise((resolve) => { supplierRequestShareResolver = resolve; });
  }

  function closeSupplierRequestShare() {
    const dialog = byId("supplierRequestShareDialog");
    if (dialog.open) dialog.close();
    const resolve = supplierRequestShareResolver;
    supplierRequestShareResolver = null;
    resolve?.();
  }

  function openSupplierEntry(item) {
    const form = byId("supplierEntryForm");
    form.reset();
    fillSelects();
    form.elements.id.value = item?.id || "";
    form.elements.clientServiceEntryId.value = item?.clientServiceEntryId || "";
    form.elements.clientId.value = item?.clientId || "";
    form.elements.supplierId.value = item?.supplierId || defaultSupplier()?.id || "";
    form.elements.supplierSearch.value = supplierOptionLabel(supplierById(form.elements.supplierId.value));
    syncEntryServices(form, item?.supplierServiceId || "");
    form.elements.date.value = item?.date || today();
    form.elements.reference.value = item?.reference || "";
    form.elements.amount.value = item ? Number(item.amount).toFixed(2) : "";
    form.elements.status.value = item?.status || "A fazer";
    form.elements.notes.value = item?.notes || "";
    byId("supplierEntryDialogTitle").textContent = item ? "Editar lançamento do fornecedor" : "Lançamento direto";
    supplierEntryWizard.activate(!item && window.matchMedia("(max-width: 1024px)").matches);
    byId("supplierEntryDialog").showModal();
    if (!supplierEntryWizard.isActive()) setTimeout(() => form.elements.supplierSearch.focus(), 0);
  }

  function renderSupplierEntryWizardSummary() {
    const form = byId("supplierEntryForm");
    const target = byId("supplierEntryWizardSummary");
    if (!target) return;
    const service = supplierServiceById(form.elements.supplierServiceId.value);
    const rows = [
      ["Fornecedor", form.elements.supplierSearch.value || "-"],
      ["Serviço", service ? supplierServiceOptionLabel(service) : form.elements.supplierServiceSearch.value || "-"],
      ["Data", formatDate(form.elements.date.value)],
      form.elements.reference.value ? ["Referência", form.elements.reference.value] : null,
      ["Valor do fornecedor", money.format(Number(form.elements.amount.value || 0))],
      ["Status", form.elements.status.value],
      form.elements.notes.value ? ["Observações", form.elements.notes.value] : null
    ].filter(Boolean);
    target.innerHTML = rows
      .map(([label, value]) => `<div class="wizard-summary-row"><span class="wizard-summary-label">${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
      .join("");
  }

  const supplierEntryWizard = createDialogWizard({
    dialogId: "supplierEntryDialog",
    formId: "supplierEntryForm",
    navId: "supplierEntryWizardNav",
    progressFillId: "supplierEntryWizardProgressFill",
    progressLabelId: "supplierEntryWizardProgressLabel",
    stepCount: 8,
    onReachLastStep: renderSupplierEntryWizardSummary,
    pickers: {
      supplierEntrySupplier: {
        searchField: "supplierSearch",
        idField: "supplierId",
        items: () => pickerSuppliers(),
        onApply: (form) => { syncSupplierSearchField(form); supplierEntryWizard.renderPicker("supplierEntryService"); }
      },
      supplierEntryService: {
        searchField: "supplierServiceSearch",
        idField: "supplierServiceId",
        items: (form) => form.elements.supplierId.value ? pickerServicesForSupplier(form.elements.supplierId.value) : [],
        onApply: (form) => syncSupplierEntryServiceSelection(form)
      }
    },
    validateStep: (step, form) => {
      if (step === 1) {
        const supplier = syncSupplierSearchField(form);
        if (!supplier) {
          alert("Selecione um fornecedor válido da lista.");
          document.querySelector('[data-picker-search-target="supplierEntrySupplier"]')?.classList.remove("hidden");
          form.elements.supplierSearch.focus();
          return false;
        }
      }
      if (step === 2) {
        syncSupplierEntryServiceSelection(form);
        if (!form.elements.supplierServiceId.value) {
          alert("Selecione um serviço válido da lista.");
          document.querySelector('[data-picker-search-target="supplierEntryService"]')?.classList.remove("hidden");
          form.elements.supplierServiceSearch.focus();
          return false;
        }
      }
      if (step === 5) {
        if (form.elements.amount.value === "" || Number(form.elements.amount.value) < 0) {
          alert("Informe o valor do fornecedor.");
          form.elements.amount.focus();
          return false;
        }
      }
      return true;
    }
  });

  function openPayable() {
    const form = byId("supplierPayableForm");
    form.reset();
    fillSelects();
    const week = currentOperationalWeek();
    form.elements.supplierId.value = defaultSupplier()?.id || "";
    form.elements.supplierSearch.value = supplierOptionLabel(defaultSupplier());
    form.elements.startDate.value = week.startDate;
    form.elements.endDate.value = week.endDate;
    byId("supplierPayableDialog").showModal();
  }

  function openAccess() {
    const form = byId("supplierAccessForm");
    form.reset();
    generatedSupplierAccessUrl = "";
    generatedSupplierAccessText = "";
    byId("supplierAccessResult").classList.add("hidden");
    byId("supplierAccessError").classList.add("hidden");
    byId("supplierAccessError").textContent = "";
    byId("supplierAccessLink").textContent = "";
    byId("supplierAccessLink").removeAttribute("href");
    const submitButton = form.querySelector('button[value="default"]');
    submitButton.disabled = false;
    submitButton.textContent = "Gerar link";
    fillSelects();
    const week = currentOperationalWeek();
    form.elements.supplierId.value = defaultSupplier()?.id || "";
    form.elements.supplierSearch.value = supplierOptionLabel(defaultSupplier());
    form.elements.startDate.value = week.startDate;
    form.elements.endDate.value = week.endDate;
    byId("supplierAccessDialog").showModal();
  }

  async function issueSupplierPortalLink(payload) {
    const session = await window.supabaseClient.auth.getSession();
    const accessToken = session.data.session?.access_token;
    if (!accessToken) throw new Error("Sua sessão administrativa expirou. Entre novamente no sistema.");
    const response = await fetch("/.netlify/functions/issue-supplier-link", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(payload)
    });
    const responseText = await response.text();
    let result = {};
    try { result = responseText ? JSON.parse(responseText) : {}; } catch {}
    if (!response.ok) throw new Error(result.error || `Não foi possível gerar o link (HTTP ${response.status}).`);
    if (!result.accessCode) throw new Error("O servidor não retornou o código de acesso.");
    return {
      ...result,
      url: `${location.origin}/fornecedor.html?acesso=${encodeURIComponent(result.accessCode)}`
    };
  }

  function supplierReportData(payable) {
    return {
      supplier: supplierById(payable.supplierId),
      entries: state.supplierEntries
        .filter((item) => item.payableId === payable.id)
        .sort((a, b) => a.date.localeCompare(b.date) || String(a.createdAt || "").localeCompare(String(b.createdAt || ""))),
      payments: state.supplierPayments
        .filter((item) => item.payableId === payable.id)
        .sort((a, b) => a.date.localeCompare(b.date) || String(a.createdAt || "").localeCompare(String(b.createdAt || "")))
    };
  }

  function openSupplierReport(payable) {
    if (!payable) return;
    activeSupplierReportId = payable.id;
    const { supplier, entries, payments } = supplierReportData(payable);
    const preference = payable.snapshot?.paymentPreference;
    const entryRows = entries.map((item) => `<tr class="${item.status === "Cancelado" ? "supplier-report-cancelled" : ""}">
      <td>${formatDate(item.date)}</td><td>${escapeHtml(item.description)}</td><td><strong>${escapeHtml(item.reference || "-")}</strong></td>
      <td>${escapeHtml(item.status)}</td><td>${money.format(item.amount)}</td>
      <td>${escapeHtml(item.status === "Cancelado" ? item.cancellationReason || item.notes || "Cancelado" : item.notes || "-")}</td>
    </tr>`).join("");
    const paymentRows = payments.map((item) => `<tr><td>${formatDate(item.date)}</td><td>${escapeHtml(item.method || "Não informada")}</td><td>${escapeHtml(item.note || "-")}</td><td>${money.format(item.amount)}</td></tr>`).join("");
    byId("supplierReportContent").innerHTML = `
      <header class="supplier-report-header"><div><span class="eyebrow">Gestor de Serviços</span><h2>Demonstrativo do fornecedor</h2><p>${escapeHtml(supplier?.name || "Fornecedor")}</p></div><div><strong>${payableStatus(payable)}</strong><span>${formatDate(payable.startDate)} a ${formatDate(payable.endDate)}</span></div></header>
      <section class="supplier-report-identification"><span><small>Fornecedor</small><strong>${escapeHtml(supplier?.name || "-")}</strong></span><span><small>Documento</small><strong>${escapeHtml(supplier?.document || "Não informado")}</strong></span><span><small>Contato</small><strong>${escapeHtml(supplier?.phone || "Não informado")}</strong></span></section>
      <section class="supplier-report-summary"><article><span>Total da conta</span><strong>${money.format(payable.amount)}</strong></article><article><span>Total pago</span><strong>${money.format(payablePaid(payable))}</strong></article><article><span>Saldo</span><strong>${money.format(payableOpen(payable))}</strong></article><article><span>Lançamentos</span><strong>${entries.length}</strong></article></section>
      ${preference ? `<section class="supplier-payment-request"><div><span class="eyebrow">Informado pelo fornecedor</span><h3>Solicitação de recebimento</h3><p>Atualizado em ${new Date(preference.updatedAt).toLocaleString("pt-BR")}</p></div><span><small>Forma</small><strong>${escapeHtml(preference.method)}</strong></span><span><small>Titular</small><strong>${escapeHtml(preference.holder || "Não informado")}</strong></span><span><small>Valor solicitado</small><strong>${money.format(Number(preference.amount || 0))}</strong></span>${preference.pixKey ? `<span class="supplier-pix-data"><small>Chave PIX</small><strong>${escapeHtml(preference.pixKey)}</strong><button class="table-action" type="button" data-copy-supplier-pix="${escapeHtml(preference.pixKey)}">Copiar PIX</button></span>` : ""}${preference.note ? `<p>${escapeHtml(preference.note)}</p>` : ""}</section>` : `<section class="supplier-payment-request empty-request"><strong>O fornecedor ainda não informou como deseja receber.</strong></section>`}
      <section class="supplier-report-section"><div class="subsection-heading"><div><span class="eyebrow">Composição</span><h3>Lançamentos incluídos</h3></div></div><div class="catalog-table-wrap"><table class="catalog-table supplier-report-table"><thead><tr><th>Data</th><th>Serviço</th><th>Referência</th><th>Status</th><th>Valor</th><th>Observação</th></tr></thead><tbody>${entryRows || `<tr><td colspan="6">Nenhum lançamento.</td></tr>`}</tbody></table></div></section>
      ${payable.snapshot?.portalUrl ? `<section class="supplier-report-portal"><div><span class="eyebrow">Acesso semanal</span><h3>Link do fornecedor</h3><p>${payable.snapshot.showEntries === false ? "Somente resumo, cards e gráficos" : "Resumo completo com lista de serviços"}</p></div><a href="${escapeHtml(payable.snapshot.portalUrl)}" target="_blank" rel="noopener">Abrir portal</a><button class="secondary" type="button" data-copy-payable-portal="${escapeHtml(payable.snapshot.portalUrl)}">Copiar link</button></section>` : ""}
      <section class="supplier-report-section"><div class="subsection-heading"><div><span class="eyebrow">Financeiro</span><h3>Pagamentos realizados</h3></div></div><div class="catalog-table-wrap"><table class="catalog-table supplier-report-table"><thead><tr><th>Data</th><th>Forma</th><th>Observação</th><th>Valor pago</th></tr></thead><tbody>${paymentRows || `<tr><td colspan="4">Nenhum pagamento registrado.</td></tr>`}</tbody><tfoot><tr><th colspan="3">Total pago</th><th>${money.format(payablePaid(payable))}</th></tr></tfoot></table></div></section>`;
    byId("supplierReportDialog").showModal();
  }

  function createSupplierReportPdf(payable) {
    const { supplier, entries, payments } = supplierReportData(payable);
    const safe = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
    const pages = [];
    let commands = [];
    let y = 0;

    function addPage() {
      if (commands.length) pages.push(commands.join("\n"));
      commands = [
        "0.086 0.31 0.263 rg 0 780 595 62 re f",
        "1 1 1 rg BT /F2 18 Tf 42 812 Td (Gestor de Servicos) Tj ET",
        "1 1 1 rg BT /F1 9 Tf 42 796 Td (Demonstrativo completo do fornecedor) Tj ET"
      ];
      y = 755;
      write(supplier?.name || "Fornecedor", 42, 16, true);
      write(`${formatDate(payable.startDate)} a ${formatDate(payable.endDate)}  |  Status: ${payableStatus(payable)}`, 310, 8);
      y -= 20;
      commands.push(`0.78 0.82 0.80 RG 42 ${y} m 553 ${y} l S`);
      y -= 20;
    }

    function write(value, x, size = 9, bold = false, color = "0.12 0.18 0.16") {
      commands.push(`${color} rg BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${safe(value)}) Tj ET`);
    }

    function ensureSpace(height = 30) {
      if (y - height < 48) addPage();
    }

    function heading(value) {
      ensureSpace(38);
      commands.push(`0.92 0.95 0.94 rg 42 ${y - 15} 511 24 re f`);
      write(value, 50, 10, true);
      y -= 32;
    }

    addPage();
    write(`Documento: ${supplier?.document || "Nao informado"}`, 42, 9);
    write(`Contato: ${supplier?.phone || "Nao informado"}`, 310, 9);
    y -= 30;
    write(`Total da conta: ${money.format(payable.amount)}`, 42, 11, true);
    write(`Total pago: ${money.format(payablePaid(payable))}`, 220, 11, true, "0.08 0.45 0.27");
    write(`Saldo: ${money.format(payableOpen(payable))}`, 400, 11, true, "0.75 0.32 0.08");
    y -= 35;

    const preference = payable.snapshot?.paymentPreference;
    if (preference) {
      heading("Solicitacao de recebimento do fornecedor");
      write(`Forma: ${preference.method || "-"}`, 42, 9, true);
      write(`Valor solicitado: ${money.format(Number(preference.amount || 0))}`, 300, 9, true);
      y -= 16;
      write(`Titular: ${preference.holder || "Nao informado"}`, 42, 8);
      write(`Chave PIX: ${preference.pixKey || "-"}`, 300, 8);
      y -= 16;
      write(`Observacao: ${String(preference.note || "-").slice(0, 80)}`, 42, 8);
      y -= 24;
    }

    heading(`Lancamentos incluidos (${entries.length})`);
    entries.forEach((item) => {
      ensureSpace(42);
      commands.push(`0.97 0.98 0.97 rg 42 ${y - 24} 511 34 re f`);
      write(formatDate(item.date), 47, 7.5);
      write(String(item.description || "-").slice(0, 38), 105, 8, true);
      write(String(item.reference || "-").slice(0, 18), 300, 8, true, "0.12 0.38 0.68");
      write(item.status, 395, 7.5);
      write(money.format(item.amount), 475, 8, true);
      y -= 14;
      const detail = item.status === "Cancelado" ? `Motivo: ${item.cancellationReason || item.notes || "Nao informado"}` : `Obs: ${item.notes || "-"}`;
      write(String(detail).slice(0, 92), 105, 6.8, false, "0.35 0.40 0.38");
      y -= 26;
    });

    heading(`Pagamentos realizados (${payments.length})`);
    if (!payments.length) {
      write("Nenhum pagamento registrado.", 42, 9);
      y -= 24;
    } else {
      payments.forEach((payment) => {
        ensureSpace(32);
        commands.push(`0.96 0.99 0.97 rg 42 ${y - 17} 511 26 re f`);
        write(formatDate(payment.date), 47, 8);
        write(String(payment.method || "Nao informada").slice(0, 22), 125, 8, true);
        write(String(payment.note || "Sem observacao").slice(0, 42), 260, 7.5);
        write(money.format(payment.amount), 470, 8, true, "0.08 0.45 0.27");
        y -= 31;
      });
    }
    ensureSpace(45);
    y -= 8;
    write(`TOTAL PAGO: ${money.format(payablePaid(payable))}`, 350, 11, true, "0.08 0.45 0.27");
    y -= 18;
    write(`SALDO: ${money.format(payableOpen(payable))}`, 350, 11, true, "0.75 0.32 0.08");
    pages.push(commands.join("\n"));

    const objects = [];
    const pageNumbers = pages.map((_, index) => 5 + index * 2);
    objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    objects[2] = `<< /Type /Pages /Kids [${pageNumbers.map((number) => `${number} 0 R`).join(" ")}] /Count ${pages.length} >>`;
    objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
    objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";
    pages.forEach((content, index) => {
      const pageNumber = 5 + index * 2;
      objects[pageNumber] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageNumber + 1} 0 R >>`;
      objects[pageNumber + 1] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
    });
    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    for (let index = 1; index < objects.length; index += 1) { offsets[index] = pdf.length; pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`; }
    const xref = pdf.length;
    pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let index = 1; index < objects.length; index += 1) pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
    pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return new Blob([pdf], { type: "application/pdf" });
  }

  function reportFile(payable) {
    return `fornecedor-${normalized(supplierById(payable.supplierId)?.name).replace(/[^a-z0-9]+/g, "-")}-${payable.endDate}.pdf`;
  }

  function downloadReport(payable) {
    const url = URL.createObjectURL(createSupplierReportPdf(payable));
    const link = document.createElement("a"); link.href = url; link.download = reportFile(payable); link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  async function shareReport(payable) {
    const blob = createSupplierReportPdf(payable);
    const file = new File([blob], reportFile(payable), { type: "application/pdf" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: "Relatório do fornecedor", text: `Relatório de ${formatDate(payable.startDate)} a ${formatDate(payable.endDate)}.`, files: [file] });
      return;
    }
    downloadReport(payable);
    alert("O PDF foi salvo. Anexe o arquivo na conversa do fornecedor.");
  }

  byId("supplierForm").addEventListener("submit", (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const item = {
      id: data.get("id") || crypto.randomUUID(),
      name: data.get("name").trim(),
      phone: data.get("phone").trim(),
      whatsappDestination: data.get("whatsappDestination") || "individual",
      whatsappGroupName: data.get("whatsappGroupName").trim(),
      document: data.get("document").trim(),
      notes: data.get("notes").trim(),
      isDefault: data.get("isDefault") === "on",
      active: true
    };
    if (item.isDefault) state.suppliers.forEach((supplier) => { supplier.isDefault = false; });
    const index = state.suppliers.findIndex((supplier) => supplier.id === item.id);
    if (index >= 0) state.suppliers[index] = item; else state.suppliers.push(item);
    event.currentTarget.closest("dialog").close(); saveState();
  });

  byId("supplierServiceForm").addEventListener("submit", (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const form = event.currentTarget;
    if (!syncSupplierSearchField(form)) {
      alert("Selecione um fornecedor válido da lista.");
      form.elements.supplierSearch.focus();
      return;
    }
    const data = new FormData(form);
    const item = { id: data.get("id") || crypto.randomUUID(), supplierId: data.get("supplierId"), code: data.get("code").trim(), name: data.get("name").trim(), cost: Number(data.get("cost")), active: true };
    const index = state.supplierServices.findIndex((service) => service.id === item.id);
    if (index >= 0) state.supplierServices[index] = item; else state.supplierServices.push(item);
    event.currentTarget.closest("dialog").close(); saveState();
  });

  byId("supplierEntryForm").addEventListener("submit", async (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const form = event.currentTarget;
    if (!syncSupplierSearchField(form)) {
      alert("Selecione um fornecedor válido da lista.");
      form.elements.supplierSearch.focus();
      return;
    }
    syncSupplierEntryServiceSelection(form);
    if (!form.elements.supplierServiceId.value) {
      alert("Selecione um serviço válido da lista.");
      form.elements.supplierServiceSearch.focus();
      return;
    }
    const data = new FormData(form);
    const existing = state.supplierEntries.find((entry) => entry.id === data.get("id"));
    const service = supplierServiceById(data.get("supplierServiceId"));
    const now = new Date().toISOString();
    const status = data.get("status");
    const item = { id: data.get("id") || crypto.randomUUID(), supplierId: data.get("supplierId"), supplierServiceId: data.get("supplierServiceId"), clientId: data.get("clientId") || null, clientServiceEntryId: data.get("clientServiceEntryId") || null, payableId: existing?.payableId || null, date: data.get("date"), description: service?.name || "", reference: data.get("reference").trim(), amount: Number(data.get("amount")), status, source: existing?.source || (data.get("clientId") ? "Cliente" : "Direto"), notes: data.get("notes").trim(), lastChangedBy: "Administrador", doneAt: ["Feito", "Entregue"].includes(status) ? existing?.doneAt || now : null, deliveredAt: status === "Entregue" ? existing?.deliveredAt || now : null, createdAt: existing?.createdAt || now, updatedAt: now };
    const index = state.supplierEntries.findIndex((entry) => entry.id === item.id);
    if (index >= 0) state.supplierEntries[index] = item; else state.supplierEntries.push(item);
    event.currentTarget.closest("dialog").close();
    try {
      await window.persistStateNow();
    } catch (error) {
      console.error("Falha ao sincronizar o lançamento do fornecedor:", error);
      alert("O lançamento ficou salvo neste aparelho, mas a sincronização online falhou. O sistema tentará novamente.");
      saveState();
    }
  });

  byId("supplierEntryForm").addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.target.tagName === "BUTTON") return;
    event.preventDefault();
    const form = event.currentTarget;
    const fields = [
      form.elements.supplierSearch,
      form.elements.supplierServiceSearch,
      form.elements.date,
      form.elements.reference,
      form.elements.amount,
      form.elements.status,
      form.elements.notes
    ].filter((field) => field && !field.disabled);
    const index = fields.indexOf(event.target);
    if (index < 0) return;
    const next = fields.slice(index + 1).find((field) => field !== form.elements.date);
    if (next) next.focus();
    else form.requestSubmit(form.querySelector('button[value="default"]'));
  });

  byId("supplierCancelForm").addEventListener("submit", (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const entry = state.supplierEntries.find((item) => item.id === data.get("entryId"));
    if (!entry || entry.payableId) return;
    entry.cancellationOriginalAmount = Number(entry.amount);
    entry.cancellationReason = String(data.get("reason") || "").trim();
    entry.amount = 0;
    entry.status = "Cancelado";
    entry.lastChangedBy = "Administrador";
    entry.updatedAt = new Date().toISOString();
    event.currentTarget.closest("dialog").close();
    saveState();
  });

  byId("supplierPayableForm").addEventListener("submit", async (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const form = event.currentTarget;
    if (!syncSupplierSearchField(form)) {
      alert("Selecione um fornecedor válido da lista.");
      form.elements.supplierSearch.focus();
      return;
    }
    const data = new FormData(form);
    const entries = state.supplierEntries.filter((item) => item.supplierId === data.get("supplierId") && !item.payableId && item.status !== "Cancelado" && item.date >= data.get("startDate") && item.date <= data.get("endDate"));
    if (!entries.length) return alert("Não há lançamentos livres neste período.");
    const payableId = crypto.randomUUID();
    const amount = entries.reduce((sum, item) => sum + Number(item.amount), 0);
    const payable = { id: payableId, supplierId: data.get("supplierId"), startDate: data.get("startDate"), endDate: data.get("endDate"), amount, status: "Aberta", snapshot: { entryCount: entries.length }, createdAt: new Date().toISOString() };
    state.supplierPayables.push(payable);
    entries.forEach((item) => { item.payableId = payableId; });
    event.currentTarget.closest("dialog").close();
    await window.persistStateNow();
    if (data.get("generatePortalLink") === "on") {
      try {
        const issued = await issueSupplierPortalLink({
          supplierId: payable.supplierId,
          startDate: payable.startDate,
          endDate: payable.endDate,
          validDays: 30,
          canEdit: false,
          canMarkDone: false,
          canCancel: false,
          showLinkedNotes: false,
          showEntries: data.get("showEntries") === "on",
          replaceExisting: false
        });
        payable.snapshot = { ...payable.snapshot, portalUrl: issued.url, showEntries: data.get("showEntries") === "on" };
        generatedSupplierAccessUrl = issued.url;
        generatedSupplierAccessText = `Olá, ${issued.supplierName}. Consulte o resumo de ${formatDate(payable.startDate)} a ${formatDate(payable.endDate)}:\n${issued.url}`;
        await window.persistStateNow();
      } catch (error) {
        console.error(error);
        alert(`A conta foi gerada, mas o link do fornecedor não pôde ser criado. ${error.message}`);
      }
    }
    showSupplierTab("payables"); openSupplierReport(payable);
  });

  byId("supplierPaymentForm").addEventListener("submit", (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payable = state.supplierPayables.find((item) => item.id === data.get("payableId"));
    const amount = Number(data.get("amount"));
    if (amount > payableOpen(payable) + 0.001) return alert(`O valor máximo é ${money.format(payableOpen(payable))}.`);
    state.supplierPayments.push({ id: crypto.randomUUID(), supplierId: data.get("supplierId"), payableId: payable.id, date: data.get("date"), amount, method: data.get("method"), note: data.get("note").trim(), createdAt: new Date().toISOString() });
    payable.status = payableOpen(payable) <= 0.001 ? "Paga" : "Parcial";
    event.currentTarget.closest("dialog").close(); saveState(); openSupplierReport(payable);
  });

  byId("supplierAccessForm").addEventListener("submit", async (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const form = event.currentTarget;
    if (!syncSupplierSearchField(form)) {
      alert("Selecione um fornecedor válido da lista.");
      form.elements.supplierSearch.focus();
      return;
    }
    const submitButton = event.submitter;
    const data = new FormData(form);
    const errorBox = byId("supplierAccessError");
    const resultBox = byId("supplierAccessResult");
    submitButton.disabled = true;
    submitButton.textContent = "Gerando...";
    errorBox.classList.add("hidden");
    resultBox.classList.add("hidden");

    try {
      const session = await window.supabaseClient.auth.getSession();
      const accessToken = session.data.session?.access_token;
      if (!accessToken) throw new Error("Sua sessão administrativa expirou. Entre novamente no sistema.");
      const response = await fetch("/.netlify/functions/issue-supplier-link", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          supplierId: data.get("supplierId"),
          startDate: data.get("startDate"),
          endDate: data.get("endDate"),
          validDays: Number(data.get("validDays")),
          canEdit: data.get("canEdit") === "on",
          canMarkDone: data.get("canMarkDone") === "on",
          canCancel: data.get("canCancel") === "on",
          showLinkedNotes: data.get("showLinkedNotes") === "on",
          showEntries: data.get("showEntries") === "on",
          replaceExisting: true
        })
      });
      const responseText = await response.text();
      let result = {};
      try { result = responseText ? JSON.parse(responseText) : {}; } catch {}
      if (!response.ok) throw new Error(result.error || `Não foi possível gerar o link (HTTP ${response.status}).`);
      if (!result.accessCode) throw new Error("O servidor não retornou o código de acesso.");

      generatedSupplierAccessUrl = `${location.origin}/fornecedor.html?acesso=${encodeURIComponent(result.accessCode)}`;
      generatedSupplierAccessText = `Olá, ${result.supplierName}. Acompanhe os serviços de ${formatDate(data.get("startDate"))} a ${formatDate(data.get("endDate"))}:\n${generatedSupplierAccessUrl}`;
      byId("supplierAccessStatus").textContent = `Link de ${result.supplierName} gerado com sucesso`;
      byId("supplierAccessLink").href = generatedSupplierAccessUrl;
      byId("supplierAccessLink").textContent = generatedSupplierAccessUrl;
      resultBox.classList.remove("hidden");
      submitButton.textContent = "Gerar novo link";
    } catch (error) {
      console.error(error);
      errorBox.textContent = error.message || "Não foi possível gerar o link do fornecedor.";
      errorBox.classList.remove("hidden");
      submitButton.textContent = "Tentar novamente";
    } finally {
      submitButton.disabled = false;
    }
  });

  function handleSupplierSearchChange(event) {
    if (!event.target.matches('input[name="supplierSearch"]')) return;
    const form = event.target.form;
    syncSupplierSearchField(form);
    if (form.id === "serviceForm") syncClientEntryServices();
    if (form.id === "supplierEntryForm") syncEntryServices(form);
  }

  document.addEventListener("change", (event) => {
    handleSupplierSearchChange(event);
    if (event.target.matches("#serviceForm input[name=hasSupplierService]")) {
      if (!event.target.checked) clientSupplierServiceValues = clientSupplierServiceValues.filter((item) => item.id);
      toggleClientSupplierServiceSection(!event.target.checked && !clientSupplierServiceValues.length);
      if (event.target.checked) {
        event.target.form.elements.supplierId.value ||= defaultSupplier()?.id || "";
        event.target.form.elements.supplierSearch.value ||= supplierOptionLabel(supplierById(event.target.form.elements.supplierId.value));
        syncClientEntryServices();
      } else {
        renderClientSupplierServices();
      }
    }
    if (event.target.matches("#supplierEntryForm input[name=supplierServiceSearch]")) syncSupplierEntryServiceSelection(event.target.form);
  });

  document.addEventListener("input", (event) => {
    handleSupplierSearchChange(event);
    if (event.target.matches("#serviceForm input[name=supplierServiceSearch]")) {
      setClientSupplierServiceError();
      syncClientEntryServiceSelection();
    }
    if (event.target.matches("#supplierEntryForm input[name=supplierServiceSearch]")) syncSupplierEntryServiceSelection(event.target.form);
  });

  document.addEventListener("blur", (event) => {
    if (!event.target.matches("#serviceForm input[name=supplierServiceSearch]")) return;
    if (event.target.value.trim()) syncClientEntryServiceSelection(true);
  }, true);

  document.addEventListener("click", async (event) => {
    const tab = event.target.closest("[data-supplier-tab]"); if (tab) showSupplierTab(tab.dataset.supplierTab);
    const action = event.target.closest("[data-supplier-action]");
    if (action) ({ supplier: () => openSupplier(), service: () => openSupplierService(), entry: () => openSupplierEntry(), payable: openPayable, access: openAccess }[action.dataset.supplierAction])?.();
    const close = event.target.closest("[data-close-supplier-dialog]"); if (close) close.closest("dialog")?.close();
    const closeRequestShare = event.target.closest("[data-close-supplier-request-share]");
    if (closeRequestShare) closeSupplierRequestShare();
    const shareNewEntries = event.target.closest("[data-share-new-supplier-entries]");
    if (shareNewEntries) {
      try {
        await shareSupplierRequests(shareNewEntries.dataset.shareNewSupplierEntries);
        shareNewEntries.textContent = "Compartilhado";
      } catch (error) {
        if (error?.name !== "AbortError") alert("Não foi possível abrir o compartilhamento do WhatsApp.");
      }
    }
    const currentWeekButton = event.target.closest("[data-supplier-current-week]");
    if (currentWeekButton) {
      const week = currentOperationalWeek();
      byId("supplierEntryStart").value = week.startDate;
      byId("supplierEntryEnd").value = week.endDate;
      render();
    }
    const copySupplierAccess = event.target.closest("[data-copy-supplier-access]");
    if (copySupplierAccess && generatedSupplierAccessUrl) await copyText(generatedSupplierAccessUrl, "Link do fornecedor");
    const copyPayablePortal = event.target.closest("[data-copy-payable-portal]");
    if (copyPayablePortal) await copyText(copyPayablePortal.dataset.copyPayablePortal, "Link do fornecedor");
    const copySupplierPix = event.target.closest("[data-copy-supplier-pix]");
    if (copySupplierPix) await copyText(copySupplierPix.dataset.copySupplierPix, "Chave PIX");
    const whatsappSupplierAccess = event.target.closest("[data-whatsapp-supplier-access]");
    if (whatsappSupplierAccess && generatedSupplierAccessText) {
      const link = document.createElement("a");
      link.href = `https://api.whatsapp.com/send?text=${encodeURIComponent(generatedSupplierAccessText)}`;
      link.target = "_blank";
      link.rel = "noopener";
      link.click();
    }
    const shareSupplierAccess = event.target.closest("[data-share-supplier-access]");
    if (shareSupplierAccess && generatedSupplierAccessText) {
      try {
        if (navigator.share) {
          await navigator.share({ title: "Acompanhamento de serviços", text: generatedSupplierAccessText });
        } else {
          await copyText(generatedSupplierAccessText, "Mensagem do fornecedor");
        }
      } catch (error) {
        if (error?.name !== "AbortError") {
          console.error(error);
          await copyText(generatedSupplierAccessText, "Mensagem do fornecedor");
        }
      }
    }
    const addClientSupplierServiceButton = event.target.closest("#addSupplierServiceButton");
    if (addClientSupplierServiceButton) addClientSupplierService();
    const removeClientSupplierServiceButton = event.target.closest("[data-remove-client-supplier-service]");
    if (removeClientSupplierServiceButton) {
      const removeIndex = Number(removeClientSupplierServiceButton.dataset.removeClientSupplierService);
      const target = clientSupplierServiceValues[removeIndex];
      if (!target?.id || confirm("Remover este serviço de fornecedor já salvo? Ele será excluído ao salvar o lançamento.")) {
        clientSupplierServiceValues.splice(removeIndex, 1);
        if (!clientSupplierServiceValues.length) {
          byId("serviceForm").elements.hasSupplierService.checked = false;
          toggleClientSupplierServiceSection(true);
        }
        renderClientSupplierServices();
      }
    }
    const editSupplier = event.target.closest("[data-edit-supplier]"); if (editSupplier) openSupplier(supplierById(editSupplier.dataset.editSupplier));
    const editService = event.target.closest("[data-edit-supplier-service]"); if (editService) openSupplierService(supplierServiceById(editService.dataset.editSupplierService));
    const editEntry = event.target.closest("[data-edit-supplier-entry]"); if (editEntry) openSupplierEntry(state.supplierEntries.find((item) => item.id === editEntry.dataset.editSupplierEntry));
    const entryStatus = event.target.closest("[data-supplier-entry-status]");
    if (entryStatus) {
      const entry = state.supplierEntries.find((item) => item.id === entryStatus.dataset.entryId);
      if (entry?.payableId) alert("Este serviço já está em uma conta a pagar e não pode ter o status alterado.");
      else if (entry && entry.status !== "Cancelado") {
        const nextStatus = entryStatus.dataset.supplierEntryStatus;
        const changedAt = new Date().toISOString();
        entry.status = nextStatus;
        if (["Feito", "Entregue"].includes(nextStatus)) entry.doneAt ||= changedAt;
        if (nextStatus === "Entregue") entry.deliveredAt = changedAt;
        else entry.deliveredAt = null;
        if (nextStatus === "A fazer") entry.doneAt = null;
        entry.lastChangedBy = "Administrador";
        entry.updatedAt = changedAt;
        saveState();
      }
    }
    const cancelEntry = event.target.closest("[data-cancel-supplier-entry]");
    if (cancelEntry) {
      const entry = state.supplierEntries.find((item) => item.id === cancelEntry.dataset.cancelSupplierEntry);
      if (entry?.payableId) alert("Este serviço já está em uma conta a pagar e não pode ser cancelado.");
      else if (entry) {
        const form = byId("supplierCancelForm");
        form.reset();
        form.elements.entryId.value = entry.id;
        byId("supplierCancelDescription").textContent = `${entry.description} · ${entry.reference || "Sem referência"} · ${supplierById(entry.supplierId)?.name || ""}`;
        byId("supplierCancelDialog").showModal();
        setTimeout(() => form.elements.reason.focus(), 0);
      }
    }
    const deleteSupplier = event.target.closest("[data-delete-supplier]");
    if (deleteSupplier && !state.supplierEntries.some((item) => item.supplierId === deleteSupplier.dataset.deleteSupplier) && confirm("Excluir este fornecedor?")) { state.suppliers = state.suppliers.filter((item) => item.id !== deleteSupplier.dataset.deleteSupplier); saveState(); }
    else if (deleteSupplier && state.supplierEntries.some((item) => item.supplierId === deleteSupplier.dataset.deleteSupplier)) alert("Este fornecedor possui movimentações e não pode ser excluído.");
    const deleteService = event.target.closest("[data-delete-supplier-service]");
    if (deleteService && !state.supplierEntries.some((item) => item.supplierServiceId === deleteService.dataset.deleteSupplierService) && confirm("Excluir este serviço?")) { state.supplierServices = state.supplierServices.filter((item) => item.id !== deleteService.dataset.deleteSupplierService); saveState(); }
    else if (deleteService && state.supplierEntries.some((item) => item.supplierServiceId === deleteService.dataset.deleteSupplierService)) alert("Este serviço já possui lançamentos.");
    const deleteEntry = event.target.closest("[data-delete-supplier-entry]");
    if (deleteEntry && confirm("Excluir este lançamento?")) { state.supplierEntries = state.supplierEntries.filter((item) => item.id !== deleteEntry.dataset.deleteSupplierEntry); saveState(); }
    const pay = event.target.closest("[data-pay-supplier]");
    if (pay) {
      const payable = state.supplierPayables.find((item) => item.id === pay.dataset.paySupplier);
      const form = byId("supplierPaymentForm"); form.reset(); form.elements.payableId.value = payable.id; form.elements.supplierId.value = payable.supplierId; form.elements.date.value = today();
      const preference = payable.snapshot?.paymentPreference;
      form.elements.amount.value = pay.dataset.mode === "full"
        ? payableOpen(payable).toFixed(2)
        : preference?.amount ? Math.min(Number(preference.amount), payableOpen(payable)).toFixed(2) : "";
      if (preference?.method && [...form.elements.method.options].some((option) => option.value === preference.method)) form.elements.method.value = preference.method;
      if (preference) form.elements.note.value = [`Solicitado pelo fornecedor`, preference.holder && `Titular: ${preference.holder}`, preference.pixKey && `PIX: ${preference.pixKey}`, preference.note].filter(Boolean).join(" | ");
      byId("supplierPaymentDialog").showModal();
    }
    const report = event.target.closest("[data-supplier-report]"); if (report) openSupplierReport(state.supplierPayables.find((item) => item.id === report.dataset.supplierReport));
    const share = event.target.closest("[data-supplier-share]"); if (share) await shareReport(state.supplierPayables.find((item) => item.id === share.dataset.supplierShare));
    const downloadOpenReport = event.target.closest("[data-download-supplier-report]");
    if (downloadOpenReport) downloadReport(state.supplierPayables.find((item) => item.id === activeSupplierReportId));
    const shareOpenReport = event.target.closest("[data-share-open-supplier-report]");
    if (shareOpenReport) await shareReport(state.supplierPayables.find((item) => item.id === activeSupplierReportId));
    const cancelPayable = event.target.closest("[data-cancel-supplier-payable]");
    if (cancelPayable && confirm("Cancelar esta conta e liberar os lançamentos para outro fechamento?")) {
      const payable = state.supplierPayables.find((item) => item.id === cancelPayable.dataset.cancelSupplierPayable);
      payable.status = "Cancelada";
      state.supplierEntries.forEach((item) => { if (item.payableId === payable.id) item.payableId = null; });
      saveState();
    }
    const deletePayment = event.target.closest("[data-delete-supplier-payment]");
    if (deletePayment && confirm("Excluir esta baixa?")) {
      state.supplierPayments = state.supplierPayments.filter((item) => item.id !== deletePayment.dataset.deleteSupplierPayment);
      saveState();
    }
  });

  ["supplierDashboardFilter", "supplierDashboardStart", "supplierDashboardEnd", "supplierEntrySupplierFilter", "supplierEntryClientFilter", "supplierEntryStatusFilter", "supplierEntryStart", "supplierEntryEnd", "supplierEntrySearch", "supplierSearch", "supplierServiceSearch", "supplierPayableSupplierFilter", "supplierPayableStatusFilter"].forEach((id) => {
    byId(id).addEventListener(id.includes("Search") ? "input" : "change", render);
  });

  const week = currentOperationalWeek();
  byId("supplierDashboardStart").value = week.startDate;
  byId("supplierDashboardEnd").value = week.endDate;
  byId("supplierEntryStart").value = week.startDate;
  byId("supplierEntryEnd").value = week.endDate;
  function removeClientSupplierServiceById(supplierServiceId) {
    const index = clientSupplierServiceValues.findIndex((item) => item.supplierServiceId === supplierServiceId);
    if (index < 0) return;
    const target = clientSupplierServiceValues[index];
    if (target.id && !confirm("Remover este serviço de fornecedor já salvo? Ele será excluído ao salvar o lançamento.")) return;
    clientSupplierServiceValues.splice(index, 1);
    if (!clientSupplierServiceValues.length) {
      byId("serviceForm").elements.hasSupplierService.checked = false;
      toggleClientSupplierServiceSection(true);
    }
    renderClientSupplierServices();
  }

  function pickerSuppliers() {
    const counts = {};
    (state.supplierEntries || []).forEach((entry) => {
      counts[entry.supplierId] = (counts[entry.supplierId] || 0) + 1;
    });
    return [...state.suppliers]
      .sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0))
      .map((item) => ({ id: item.id, label: supplierOptionLabel(item) }));
  }

  function pickerServicesForSupplier(supplierId) {
    const counts = {};
    (state.supplierEntries || []).forEach((entry) => {
      if (entry.supplierId === supplierId) counts[entry.supplierServiceId] = (counts[entry.supplierServiceId] || 0) + 1;
    });
    return state.supplierServices
      .filter((item) => item.supplierId === supplierId)
      .sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0))
      .map((item) => ({ id: item.id, label: supplierServiceOptionLabel(item) }));
  }

  window.supplierModule = {
    render,
    resetClientEntryOptions,
    clientEntrySelection,
    createForClientEntries,
    offerSupplierRequestShare,
    addClientSupplierService,
    syncClientEntryServiceSelection,
    hasClientSupplierServices,
    currentClientSupplierServiceSelections,
    pickerSuppliers,
    pickerServicesForSupplier,
    removeClientSupplierServiceById
  };
  resetClientEntryOptions();
  byId("supplierRequestShareDialog").addEventListener("cancel", (event) => {
    event.preventDefault();
    closeSupplierRequestShare();
  });
  render();
})();
