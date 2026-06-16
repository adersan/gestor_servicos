(function () {
  let activeTab = "dashboard";
  let clientSupplierServiceValues = [];
  let generatedSupplierAccessUrl = "";
  let generatedSupplierAccessText = "";

  const byId = (id) => document.getElementById(id);
  const today = () => new Date().toISOString().slice(0, 10);
  const supplierById = (id) => state.suppliers.find((item) => item.id === id);
  const supplierServiceById = (id) => state.supplierServices.find((item) => item.id === id);
  const clientName = (id) => clientById(id)?.name || "";
  const normalized = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const empty = () => `<div class="empty"><strong>Nenhum registro.</strong><span>Use os botões acima para começar.</span></div>`;

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

  function supplierOptions(selected = "") {
    return `<option value="">Selecione</option>${state.suppliers.map((item) =>
      `<option value="${item.id}" ${item.id === selected ? "selected" : ""}>${escapeHtml(item.name)}${item.isDefault ? " (padrão)" : ""}</option>`
    ).join("")}`;
  }

  function serviceOptions(supplierId, selected = "") {
    return `<option value="">Selecione</option>${state.supplierServices
      .filter((item) => item.supplierId === supplierId)
      .map((item) => `<option value="${item.id}" ${item.id === selected ? "selected" : ""}>${escapeHtml(item.code ? `${item.code} - ${item.name}` : item.name)} · ${money.format(item.cost)}</option>`)
      .join("")}`;
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
    document.querySelectorAll(
      "#supplierServiceForm select[name=supplierId], #supplierEntryForm select[name=supplierId], #supplierPayableForm select[name=supplierId], #supplierAccessForm select[name=supplierId]"
    ).forEach((field) => {
      const selected = field.value;
      field.innerHTML = supplierOptions(selected);
      field.value = selected;
    });
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
    const status = byId("supplierEntryStatusFilter").value;
    const start = byId("supplierEntryStart").value;
    const end = byId("supplierEntryEnd").value;
    const search = normalized(byId("supplierEntrySearch").value);
    byId("supplierEntryPeriodLabel").textContent = start && end
      ? `${formatDate(start)} a ${formatDate(end)}`
      : "Todos os períodos";
    const statusOrder = { "A fazer": 0, "Feito": 1, "Cancelado": 2 };
    const entries = [...state.supplierEntries].filter((item) =>
      (!supplierId || item.supplierId === supplierId)
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
      <article class="timeline-item ${item.payableId ? "supplier-entry-closed" : ""}">
        <time>${formatDate(item.date)}</time>
        <div>
          <span class="eyebrow">${escapeHtml(supplierById(item.supplierId)?.name || "")}</span>
          <h3 class="service-card-description">${escapeHtml(item.description)}</h3>
          <p class="service-card-reference">${escapeHtml(item.reference || "Sem referência")}</p>
          <p class="meta service-card-context">${item.clientId ? escapeHtml(clientName(item.clientId)) : "Sem cliente vinculado"} · ${escapeHtml(item.source)}</p>
          ${item.lastChangedBy === "Fornecedor" ? `<span class="supplier-change-label">Alterado pelo fornecedor</span>` : ""}
          ${item.status === "Cancelado" ? `<p class="cancellation-reason"><strong>Motivo:</strong> ${escapeHtml(item.cancellationReason || "Não informado")}${item.cancellationOriginalAmount !== null && item.cancellationOriginalAmount !== undefined ? ` · Custo anterior: ${money.format(item.cancellationOriginalAmount)}` : ""}</p>` : ""}
        </div>
        <div><span class="status status-${normalized(item.status).replace(/\s/g, "-")}">${item.status}</span><strong>${money.format(item.amount)}</strong></div>
        <div class="service-actions">
          ${item.status !== "Cancelado" ? `<div class="status-actions">
            ${item.status === "A fazer" ? `<button class="table-action success" data-supplier-entry-status="Feito" data-entry-id="${item.id}" ${item.payableId ? "disabled" : ""}>Marcar feito</button>` : ""}
            ${item.status === "Feito" ? `<button class="table-action" data-supplier-entry-status="A fazer" data-entry-id="${item.id}" ${item.payableId ? "disabled" : ""}>Voltar para A fazer</button>` : ""}
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
        <div class="supplier-payable-buttons">
          <button class="table-action" data-supplier-report="${item.id}">Relatório</button>
          <button class="table-action whatsapp-action" data-supplier-share="${item.id}">Compartilhar</button>
          ${payableOpen(item) > 0 ? `<button class="table-action" data-pay-supplier="${item.id}" data-mode="partial">Baixa parcial</button><button class="table-action success" data-pay-supplier="${item.id}" data-mode="full">Quitar</button>` : ""}
          ${!payablePaid(item) ? `<button class="table-action danger" data-cancel-supplier-payable="${item.id}">Cancelar conta</button>` : ""}
        </div>
      </article>`).join("") : empty();
    byId("supplierPaymentList").innerHTML = state.supplierPayments.length ? [...state.supplierPayments].sort((a, b) => b.date.localeCompare(a.date)).map((item) => `
      <article class="timeline-item"><time>${formatDate(item.date)}</time><div><h3>${escapeHtml(supplierById(item.supplierId)?.name || "")}</h3><p class="meta">${escapeHtml(item.method || "Não informada")} · ${escapeHtml(item.note || "Sem observação")}</p></div><strong>${money.format(item.amount)}</strong><button class="table-action danger" data-delete-supplier-payment="${item.id}">Excluir</button></article>`
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
    form.elements.document.value = item?.document || "";
    form.elements.notes.value = item?.notes || "";
    form.elements.isDefault.checked = Boolean(item?.isDefault);
    byId("supplierDialogTitle").textContent = item ? "Editar fornecedor" : "Novo fornecedor";
    byId("supplierDialog").showModal();
  }

  function openSupplierService(item) {
    const form = byId("supplierServiceForm");
    form.reset();
    fillSelects();
    form.elements.id.value = item?.id || "";
    form.elements.supplierId.value = item?.supplierId || defaultSupplier()?.id || "";
    form.elements.code.value = item?.code || "";
    form.elements.name.value = item?.name || "";
    form.elements.cost.value = item ? Number(item.cost).toFixed(2) : "";
    byId("supplierServiceDialogTitle").textContent = item ? "Editar serviço do fornecedor" : "Novo serviço do fornecedor";
    byId("supplierServiceDialog").showModal();
  }

  function syncEntryServices(form, selected = "") {
    form.elements.supplierServiceId.innerHTML = serviceOptions(form.elements.supplierId.value, selected);
  }

  function syncClientEntryServices(selected = "") {
    const form = byId("serviceForm");
    const supplierId = form.elements.supplierId.value;
    form.elements.supplierServiceId.innerHTML = serviceOptions(supplierId, selected);
    const service = supplierServiceById(form.elements.supplierServiceId.value);
    form.elements.supplierAmount.value = service ? Number(service.cost).toFixed(2) : "";
  }

  function renderClientSupplierServices() {
    byId("clientSupplierServiceList").innerHTML = clientSupplierServiceValues.map((item, index) => {
      const supplier = supplierById(item.supplierId);
      const service = supplierServiceById(item.supplierServiceId);
      return `<div class="client-supplier-service-item">
        <span>${escapeHtml(service?.name || "Serviço")}<small>${escapeHtml(supplier?.name || "Fornecedor")}</small></span>
        <strong>${money.format(item.amount)}</strong>
        <button type="button" data-remove-client-supplier-service="${index}" aria-label="Remover ${escapeHtml(service?.name || "serviço")}">×</button>
      </div>`;
    }).join("");
  }

  function addClientSupplierService() {
    const form = byId("serviceForm");
    const supplierId = form.elements.supplierId.value;
    const supplierServiceId = form.elements.supplierServiceId.value;
    const amount = Number(form.elements.supplierAmount.value);
    if (!supplierId) {
      alert("Selecione o fornecedor.");
      form.elements.supplierId.focus();
      return false;
    }
    if (!supplierServiceId) {
      alert("Selecione o serviço do fornecedor.");
      form.elements.supplierServiceId.focus();
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
      form.elements.supplierServiceId.focus();
      return false;
    }
    clientSupplierServiceValues.push({ supplierId, supplierServiceId, amount });
    renderClientSupplierServices();
    form.elements.supplierServiceId.value = "";
    form.elements.supplierAmount.value = "";
    form.elements.supplierServiceId.focus();
    return true;
  }

  function hasClientSupplierServices() {
    return clientSupplierServiceValues.length > 0;
  }

  function resetClientEntryOptions(disabled = false) {
    const form = byId("serviceForm");
    const checkbox = form.elements.hasSupplierService;
    clientSupplierServiceValues = [];
    renderClientSupplierServices();
    checkbox.checked = false;
    checkbox.disabled = disabled || !state.suppliers.length || !state.supplierServices.length;
    byId("clientSupplierServiceSection").classList.add("hidden");
    form.elements.supplierId.innerHTML = supplierOptions();
    form.elements.supplierId.value = defaultSupplier()?.id || "";
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
        field: form.elements.supplierServiceId
      };
    }
    return clientSupplierServiceValues.map((item) => ({ ...item }));
  }

  function createForClientEntries(entries, selections) {
    if (!selections?.length || !entries?.length) return;
    const now = new Date().toISOString();
    const entriesByReference = entries.filter((entry) => !entry.isSecondary);
    entriesByReference.forEach((entry) => selections.forEach((selection) => {
      const service = supplierServiceById(selection.supplierServiceId);
      if (!service) return;
      state.supplierEntries.push({
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
        createdAt: now,
        updatedAt: now
      });
    }));
    clientSupplierServiceValues = [];
    renderClientSupplierServices();
    saveState();
  }

  function openSupplierEntry(item) {
    const form = byId("supplierEntryForm");
    form.reset();
    fillSelects();
    form.elements.id.value = item?.id || "";
    form.elements.clientServiceEntryId.value = item?.clientServiceEntryId || "";
    form.elements.clientId.value = item?.clientId || "";
    form.elements.supplierId.value = item?.supplierId || defaultSupplier()?.id || "";
    syncEntryServices(form, item?.supplierServiceId || "");
    form.elements.date.value = item?.date || today();
    form.elements.reference.value = item?.reference || "";
    form.elements.amount.value = item ? Number(item.amount).toFixed(2) : "";
    form.elements.status.value = item?.status || "A fazer";
    form.elements.notes.value = item?.notes || "";
    byId("supplierEntryDialogTitle").textContent = item ? "Editar lançamento do fornecedor" : "Lançamento direto";
    byId("supplierEntryDialog").showModal();
  }

  function openPayable() {
    const form = byId("supplierPayableForm");
    form.reset();
    fillSelects();
    const week = currentOperationalWeek();
    form.elements.supplierId.value = defaultSupplier()?.id || "";
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
    form.elements.startDate.value = week.startDate;
    form.elements.endDate.value = week.endDate;
    byId("supplierAccessDialog").showModal();
  }

  function createSupplierReportPdf(payable) {
    const entries = state.supplierEntries.filter((item) => item.payableId === payable.id && item.status !== "Cancelado");
    const supplier = supplierById(payable.supplierId);
    const safe = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
    let y = 790;
    const commands = ["0.086 0.31 0.263 rg 0 790 595 52 re f", "1 1 1 rg BT /F2 17 Tf 42 812 Td (Gestor de Servicos) Tj ET"];
    const text = (value, x, size = 10, bold = false) => commands.push(`0.12 0.18 0.16 rg BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${safe(value)}) Tj ET`);
    y = 760; text("Relatorio de fornecedor", 42, 10, true); y -= 28; text(supplier?.name || "Fornecedor", 42, 22, true);
    y -= 20; text(`Periodo: ${formatDate(payable.startDate)} a ${formatDate(payable.endDate)}`, 42);
    y -= 34; text(`Total: ${money.format(payable.amount)}  |  Pago: ${money.format(payablePaid(payable))}  |  Saldo: ${money.format(payableOpen(payable))}`, 42, 11, true);
    y -= 34; text("Data", 42, 8, true); text("Servico", 100, 8, true); text("Referencia", 330, 8, true); text("Valor", 475, 8, true); y -= 18;
    entries.slice(0, 28).forEach((item) => {
      text(formatDate(item.date), 42, 8); text(String(item.description).slice(0, 34), 100, 8);
      text(String(item.reference || "-").slice(0, 18), 330, 8); text(money.format(item.amount), 475, 8, true); y -= 20;
    });
    const content = commands.join("\n");
    const objects = [null, "<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [5 0 R] /Count 1 >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>", "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents 6 0 R >>", `<< /Length ${content.length} >>\nstream\n${content}\nendstream`];
    let pdf = "%PDF-1.4\n"; const offsets = [0];
    for (let i = 1; i < objects.length; i += 1) { offsets[i] = pdf.length; pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`; }
    const xref = pdf.length; pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let i = 1; i < objects.length; i += 1) pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
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
    const item = { id: data.get("id") || crypto.randomUUID(), name: data.get("name").trim(), phone: data.get("phone").trim(), document: data.get("document").trim(), notes: data.get("notes").trim(), isDefault: data.get("isDefault") === "on", active: true };
    if (item.isDefault) state.suppliers.forEach((supplier) => { supplier.isDefault = false; });
    const index = state.suppliers.findIndex((supplier) => supplier.id === item.id);
    if (index >= 0) state.suppliers[index] = item; else state.suppliers.push(item);
    event.currentTarget.closest("dialog").close(); saveState();
  });

  byId("supplierServiceForm").addEventListener("submit", (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const item = { id: data.get("id") || crypto.randomUUID(), supplierId: data.get("supplierId"), code: data.get("code").trim(), name: data.get("name").trim(), cost: Number(data.get("cost")), active: true };
    const index = state.supplierServices.findIndex((service) => service.id === item.id);
    if (index >= 0) state.supplierServices[index] = item; else state.supplierServices.push(item);
    event.currentTarget.closest("dialog").close(); saveState();
  });

  byId("supplierEntryForm").addEventListener("submit", async (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const existing = state.supplierEntries.find((entry) => entry.id === data.get("id"));
    const service = supplierServiceById(data.get("supplierServiceId"));
    const now = new Date().toISOString();
    const item = { id: data.get("id") || crypto.randomUUID(), supplierId: data.get("supplierId"), supplierServiceId: data.get("supplierServiceId"), clientId: data.get("clientId") || null, clientServiceEntryId: data.get("clientServiceEntryId") || null, payableId: existing?.payableId || null, date: data.get("date"), description: service?.name || "", reference: data.get("reference").trim(), amount: Number(data.get("amount")), status: data.get("status"), source: existing?.source || (data.get("clientId") ? "Cliente" : "Direto"), notes: data.get("notes").trim(), lastChangedBy: "Administrador", createdAt: existing?.createdAt || now, updatedAt: now };
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
      form.elements.supplierId,
      form.elements.supplierServiceId,
      form.elements.date,
      form.elements.reference,
      form.elements.amount,
      form.elements.status,
      form.elements.notes
    ].filter((field) => field && !field.disabled);
    const index = fields.indexOf(event.target);
    if (index >= 0 && index < fields.length - 1) {
      fields[index + 1].focus();
    } else if (index === fields.length - 1) {
      form.requestSubmit(form.querySelector('button[value="default"]'));
    }
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

  byId("supplierPayableForm").addEventListener("submit", (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const entries = state.supplierEntries.filter((item) => item.supplierId === data.get("supplierId") && !item.payableId && item.status !== "Cancelado" && item.date >= data.get("startDate") && item.date <= data.get("endDate"));
    if (!entries.length) return alert("Não há lançamentos livres neste período.");
    const payableId = crypto.randomUUID();
    const amount = entries.reduce((sum, item) => sum + Number(item.amount), 0);
    state.supplierPayables.push({ id: payableId, supplierId: data.get("supplierId"), startDate: data.get("startDate"), endDate: data.get("endDate"), amount, status: "Aberta", snapshot: { entryCount: entries.length }, createdAt: new Date().toISOString() });
    entries.forEach((item) => { item.payableId = payableId; });
    event.currentTarget.closest("dialog").close(); saveState(); showSupplierTab("payables");
  });

  byId("supplierPaymentForm").addEventListener("submit", (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payable = state.supplierPayables.find((item) => item.id === data.get("payableId"));
    const amount = Number(data.get("amount"));
    if (amount > payableOpen(payable) + 0.001) return alert(`O valor máximo é ${money.format(payableOpen(payable))}.`);
    state.supplierPayments.push({ id: crypto.randomUUID(), supplierId: data.get("supplierId"), payableId: payable.id, date: data.get("date"), amount, method: data.get("method"), note: data.get("note").trim(), createdAt: new Date().toISOString() });
    payable.status = amount >= payableOpen(payable) ? "Paga" : "Parcial";
    event.currentTarget.closest("dialog").close(); saveState();
  });

  byId("supplierAccessForm").addEventListener("submit", async (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    const form = event.currentTarget;
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
          showLinkedNotes: data.get("showLinkedNotes") === "on"
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

  document.addEventListener("change", (event) => {
    if (event.target.matches("#supplierEntryForm select[name=supplierId]")) syncEntryServices(event.target.form);
    if (event.target.matches("#serviceForm input[name=hasSupplierService]")) {
      byId("clientSupplierServiceSection").classList.toggle("hidden", !event.target.checked);
      if (event.target.checked) {
        event.target.form.elements.supplierId.value ||= defaultSupplier()?.id || "";
        syncClientEntryServices();
      } else {
        clientSupplierServiceValues = [];
        renderClientSupplierServices();
      }
    }
    if (event.target.matches("#serviceForm select[name=supplierId]")) syncClientEntryServices();
    if (event.target.matches("#serviceForm select[name=supplierServiceId]")) {
      const service = supplierServiceById(event.target.value);
      event.target.form.elements.supplierAmount.value = service ? Number(service.cost).toFixed(2) : "";
    }
    if (event.target.matches("#supplierEntryForm select[name=supplierServiceId]")) {
      const service = supplierServiceById(event.target.value);
      if (service) event.target.form.elements.amount.value = Number(service.cost).toFixed(2);
    }
  });

  document.addEventListener("click", async (event) => {
    const tab = event.target.closest("[data-supplier-tab]"); if (tab) showSupplierTab(tab.dataset.supplierTab);
    const action = event.target.closest("[data-supplier-action]");
    if (action) ({ supplier: () => openSupplier(), service: () => openSupplierService(), entry: () => openSupplierEntry(), payable: openPayable, access: openAccess }[action.dataset.supplierAction])?.();
    const close = event.target.closest("[data-close-supplier-dialog]"); if (close) close.closest("dialog")?.close();
    const currentWeekButton = event.target.closest("[data-supplier-current-week]");
    if (currentWeekButton) {
      const week = currentOperationalWeek();
      byId("supplierEntryStart").value = week.startDate;
      byId("supplierEntryEnd").value = week.endDate;
      render();
    }
    const copySupplierAccess = event.target.closest("[data-copy-supplier-access]");
    if (copySupplierAccess && generatedSupplierAccessUrl) await copyText(generatedSupplierAccessUrl, "Link do fornecedor");
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
      clientSupplierServiceValues.splice(Number(removeClientSupplierServiceButton.dataset.removeClientSupplierService), 1);
      renderClientSupplierServices();
    }
    const editSupplier = event.target.closest("[data-edit-supplier]"); if (editSupplier) openSupplier(supplierById(editSupplier.dataset.editSupplier));
    const editService = event.target.closest("[data-edit-supplier-service]"); if (editService) openSupplierService(supplierServiceById(editService.dataset.editSupplierService));
    const editEntry = event.target.closest("[data-edit-supplier-entry]"); if (editEntry) openSupplierEntry(state.supplierEntries.find((item) => item.id === editEntry.dataset.editSupplierEntry));
    const entryStatus = event.target.closest("[data-supplier-entry-status]");
    if (entryStatus) {
      const entry = state.supplierEntries.find((item) => item.id === entryStatus.dataset.entryId);
      if (entry?.payableId) alert("Este serviço já está em uma conta a pagar e não pode ter o status alterado.");
      else if (entry && entry.status !== "Cancelado") {
        entry.status = entryStatus.dataset.supplierEntryStatus;
        entry.lastChangedBy = "Administrador";
        entry.updatedAt = new Date().toISOString();
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
      if (pay.dataset.mode === "full") form.elements.amount.value = payableOpen(payable).toFixed(2);
      byId("supplierPaymentDialog").showModal();
    }
    const report = event.target.closest("[data-supplier-report]"); if (report) downloadReport(state.supplierPayables.find((item) => item.id === report.dataset.supplierReport));
    const share = event.target.closest("[data-supplier-share]"); if (share) await shareReport(state.supplierPayables.find((item) => item.id === share.dataset.supplierShare));
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

  ["supplierDashboardFilter", "supplierDashboardStart", "supplierDashboardEnd", "supplierEntrySupplierFilter", "supplierEntryStatusFilter", "supplierEntryStart", "supplierEntryEnd", "supplierEntrySearch", "supplierSearch", "supplierServiceSearch", "supplierPayableSupplierFilter", "supplierPayableStatusFilter"].forEach((id) => {
    byId(id).addEventListener(id.includes("Search") ? "input" : "change", render);
  });

  const week = currentOperationalWeek();
  byId("supplierDashboardStart").value = week.startDate;
  byId("supplierDashboardEnd").value = week.endDate;
  byId("supplierEntryStart").value = week.startDate;
  byId("supplierEntryEnd").value = week.endDate;
  window.supplierModule = {
    render,
    resetClientEntryOptions,
    clientEntrySelection,
    createForClientEntries,
    addClientSupplierService,
    hasClientSupplierServices
  };
  resetClientEntryOptions();
  render();
})();
