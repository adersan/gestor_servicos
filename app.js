const STORAGE_KEY = "gestor-servicos-v1";
const ALERT_MESSAGES_KEY = "gestor-servicos-alert-messages-v1";
const SOUND_ALERTS_KEY = "gestor-servicos-sound-alerts-v1";
const SYSTEM_SETTINGS_KEY = "gestor-servicos-system-settings-v1";
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });

const initialState = {
  priceTables: ["Tabela 01", "Tabela 02", "Tabela 03"],
  clients: [
    { id: crypto.randomUUID(), name: "Rodrigo", phone: "(00) 99999-0001", priceGroup: "Tabela 01" },
    { id: crypto.randomUUID(), name: "Davi", phone: "(00) 99999-0002", priceGroup: "Tabela 02" }
  ],
  catalog: [
    {
      id: crypto.randomUUID(),
      name: "Vistoria",
      prices: { "Tabela 01": 10, "Tabela 02": 20, "Tabela 03": 30 }
    }
  ],
  services: [],
  payments: [],
  paymentMethods: [
    { id: crypto.randomUUID(), type: "PIX", name: "PIX principal", details: "Cadastre sua chave PIX", link: "", active: true },
    { id: crypto.randomUUID(), type: "Dinheiro", name: "Pagamento em dinheiro", details: "Combine a entrega diretamente", link: "", active: true },
    { id: crypto.randomUUID(), type: "Cartão de crédito", name: "Cartão de crédito", details: "Link de pagamento será disponibilizado futuramente", link: "", active: false }
  ],
  billings: [],
  suppliers: [],
  supplierServices: [],
  supplierEntries: [],
  supplierPayables: [],
  supplierPayments: [],
  serviceRequests: []
};

let state = loadState();
let deferredInstallPrompt;
let remoteReady = false;
let serviceReferenceValues = [];
let additionalServiceValues = [];
let entryContinuationResolver = null;
let referenceHistoryResolver = null;
let activeDashboardTab = "services";
let dashboardPeriod = null;
let financePeriod = null;
let financePeriodMode = "week";
let remoteRefreshInProgress = false;
let remoteLoadInProgress = false;
let localStateRevision = 0;
let knownPendingRequestIds = null;
let alertMessages = loadAlertMessages();
let soundAlertsEnabled = localStorage.getItem(SOUND_ALERTS_KEY) === "true";
let alertAudioContext = null;
let currentAdminName = "Administrador";
let systemSettings = loadSystemSettings();

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return initialState;
  const parsed = JSON.parse(stored);
  return {
    ...initialState,
    ...parsed,
    priceTables: parsed.priceTables || initialState.priceTables,
    catalog: parsed.catalog || initialState.catalog,
    paymentMethods: parsed.paymentMethods || initialState.paymentMethods
  };
}

function loadAlertMessages() {
  try {
    return JSON.parse(localStorage.getItem(ALERT_MESSAGES_KEY)) || [];
  } catch {
    return [];
  }
}

function saveAlertMessages() {
  localStorage.setItem(ALERT_MESSAGES_KEY, JSON.stringify(alertMessages));
}

function loadSystemSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SYSTEM_SETTINGS_KEY)) || {};
    return {
      weekStartDay: Number.isInteger(Number(parsed.weekStartDay)) ? Number(parsed.weekStartDay) : 0,
      weekEndDay: Number.isInteger(Number(parsed.weekEndDay)) ? Number(parsed.weekEndDay) : 5
    };
  } catch {
    return { weekStartDay: 0, weekEndDay: 5 };
  }
}

function saveSystemSettings() {
  localStorage.setItem(SYSTEM_SETTINGS_KEY, JSON.stringify(systemSettings));
}

function saveState() {
  localStateRevision += 1;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
  if (remoteReady && window.dataStore) {
    window.dataStore.scheduleSave(state, (error) => {
      console.error("Falha ao salvar no Supabase:", error.code, error.message);
      const detail = error?.message ? `\n\nDetalhe: ${error.message}` : "";
      alert(`Não foi possível sincronizar os dados com o banco.${detail}\n\nOs dados continuam salvos neste aparelho e o sistema tentará novamente na próxima alteração.`);
    });
  }
}

async function persistStateNow() {
  localStateRevision += 1;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
  if (remoteReady && window.dataStore) {
    await (window.dataStore.saveNow?.(state) || window.dataStore.upsertState(state));
  }
}

function showRemoteLoadError(error) {
  const dialog = document.getElementById("remoteLoadDialog");
  const detail = document.getElementById("remoteLoadDetail");
  if (detail) {
    detail.textContent = error?.message
      ? `Detalhe: ${error.message}`
      : "Não foi possível comunicar com o banco agora.";
  }
  if (dialog && !dialog.open) dialog.showModal();
}

function closeRemoteLoadError() {
  const dialog = document.getElementById("remoteLoadDialog");
  if (dialog?.open) dialog.close();
}

async function initializeRemoteState(force = false) {
  if (!window.dataStore || remoteReady || remoteLoadInProgress) return;
  remoteLoadInProgress = true;
  const retryButton = document.querySelector("[data-retry-remote-load]");
  if (retryButton) {
    retryButton.disabled = true;
    retryButton.textContent = force ? "Tentando..." : "Tentar novamente";
  }
  try {
    const remoteState = await window.dataStore.fetchAll();
    const hasRemoteData = remoteState.priceTables.length
      || remoteState.clients.length
      || remoteState.catalog.length;

    if (hasRemoteData) {
      state = remoteState;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } else {
      await window.dataStore.upsertState(state);
    }

    const rolloversMigrated = normalizeBillingRollovers();
    updateBillingStatuses();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    remoteReady = true;
    closeRemoteLoadError();
    knownPendingRequestIds = new Set((state.serviceRequests || []).filter((item) => item.status === "Novo").map((item) => item.id));
    render();
    if (rolloversMigrated) {
      try {
        await window.dataStore.upsertState(state);
      } catch (migrationError) {
        console.error("Falha ao persistir a consolidacao de cobrancas:", migrationError);
      }
    }
  } catch (error) {
    console.error("Falha ao carregar dados do Supabase:", error.code, error.message);
    showRemoteLoadError(error);
  } finally {
    remoteLoadInProgress = false;
    if (retryButton) {
      retryButton.disabled = false;
      retryButton.textContent = "Tentar novamente";
    }
  }
}

async function refreshRemoteState() {
  if (remoteRefreshInProgress || !remoteReady || !window.dataStore || document.querySelector("dialog[open]")) return;
  if (window.dataStore.hasUnsyncedChanges?.() || window.dataStore.hasPendingSave?.()) {
    await window.dataStore.flushSave?.();
    return;
  }
  remoteRefreshInProgress = true;
  const revisionAtStart = localStateRevision;
  try {
    const remoteState = await window.dataStore.fetchAll();
    if (
      revisionAtStart !== localStateRevision
      || window.dataStore.hasUnsyncedChanges?.()
      || window.dataStore.hasPendingSave?.()
    ) return;
    notifyNewClientRequests(remoteState);
    state = remoteState;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    render();
  } catch (error) {
    console.error("Falha ao atualizar dados do Supabase:", error.code, error.message);
  } finally {
    remoteRefreshInProgress = false;
  }
}

function notifyNewClientRequests(nextState) {
  const pending = (nextState.serviceRequests || []).filter((item) => item.status === "Novo");
  const pendingIds = new Set(pending.map((item) => item.id));
  if (!knownPendingRequestIds) {
    knownPendingRequestIds = pendingIds;
    return;
  }
  const newItems = pending.filter((item) => !knownPendingRequestIds.has(item.id));
  knownPendingRequestIds = pendingIds;
  if (newItems.length) {
    showToast(`${newItems.length} novo(s) pedido(s) recebido(s) de cliente.`);
    notifyAttention();
  }
}

function updateSoundAlertButton() {
  const button = document.getElementById("soundAlertButton");
  if (!button) return;
  button.textContent = "";
  button.setAttribute("aria-label", soundAlertsEnabled ? "Desativar som dos alertas" : "Ativar som dos alertas");
  button.classList.toggle("active", soundAlertsEnabled);
  button.setAttribute("aria-pressed", String(soundAlertsEnabled));
  button.title = soundAlertsEnabled ? "Alertas sonoros ativos neste aparelho" : "Ativar alerta sonoro neste aparelho";
}

async function enableAlertAudio() {
  alertAudioContext ||= new (window.AudioContext || window.webkitAudioContext)();
  if (alertAudioContext.state === "suspended") await alertAudioContext.resume();
}

function playAlertTone() {
  if (!soundAlertsEnabled || !("AudioContext" in window || "webkitAudioContext" in window)) return;
  try {
    enableAlertAudio().then(() => {
      const oscillator = alertAudioContext.createOscillator();
      const gain = alertAudioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, alertAudioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, alertAudioContext.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, alertAudioContext.currentTime + 0.45);
      oscillator.connect(gain);
      gain.connect(alertAudioContext.destination);
      oscillator.start();
      oscillator.stop(alertAudioContext.currentTime + 0.5);
    }).catch(() => {});
  } catch {}
}

function notifyAttention() {
  if (navigator.vibrate) navigator.vibrate([180, 80, 180]);
  playAlertTone();
}

function showToast(message) {
  const toast = document.getElementById("appToast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.add("hidden"), 6000);
}

window.persistStateNow = persistStateNow;

function clientById(id) {
  return state.clients.find((client) => client.id === id);
}

function balanceFor(clientId, endDate = null) {
  const allowed = (item) => item.clientId === clientId && (!endDate || item.date <= endDate);
  const debits = state.services.filter((item) => allowed(item) && item.status !== "Cancelado")
    .reduce((sum, item) => sum + item.amount, 0);
  const credits = state.payments.filter(allowed).reduce((sum, item) => sum + item.amount, 0);
  return debits - credits;
}

function availableAdvancePayments(clientId) {
  const today = localDateKey(new Date());
  return state.payments.filter((item) =>
    !item.billingId
    && item.clientId === clientId
    && item.date <= today
  );
}

function serviceStatusLabel(status) {
  return status === "Pronto" ? "Feito" : status;
}

function adminDisplayName() {
  return currentAdminName || "Administrador";
}

function originCancelledNote(item) {
  const note = String(item?.notes || "");
  const primary = item?.isSecondary
    ? state.services.find((service) => service.id === item.primaryEntryId)
    : null;
  const reason = note.match(/cancelad[ao] por:\s*(.+)$/i)?.[1]
    || note.match(/origem cancelada motivo:\s*(.+)$/i)?.[1]
    || item?.cancellationReason
    || primary?.cancellationReason
    || "";
  if (!reason) return "";
  const originName = note.match(/^(.+?) cancelad[ao] por:/i)?.[1]
    || primary?.description
    || "Serviço de origem";
  return `${originName} cancelado por ${reason}`;
}

function deliveredLabel(item) {
  if (!item?.deliveredAt) return "";
  const source = item.deliverySource || "Administrador";
  return `Confirmado pelo ${source}`;
}

function randomDeliveryCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function deliveryConfirmationMessage(item) {
  const client = clientById(item.clientId);
  return `Olá, ${client?.name || ""}. O serviço "${item.description}"${item.reference ? ` (${item.reference})` : ""} foi concluído. Para confirmar o recebimento, responda: RECEBIDO ${item.deliveryCode}`;
}

function serviceAgeHours(item) {
  const startedAt = item.createdAt || `${item.date}T00:00:00`;
  const timestamp = new Date(startedAt).getTime();
  return Number.isFinite(timestamp) ? Math.max(0, (Date.now() - timestamp) / 3600000) : 0;
}

function isOverdueService(item) {
  return item.status === "A fazer" && serviceAgeHours(item) >= 24;
}

function formatServiceAge(item) {
  const hours = Math.floor(serviceAgeHours(item));
  if (hours < 24) return `${hours}h aguardando`;
  const days = Math.floor(hours / 24);
  return `${days} dia${days === 1 ? "" : "s"} aguardando`;
}

function paymentWasAfterBilling(payment, billing) {
  if (payment.billingId !== billing.id) return false;
  const paymentCreated = new Date(payment.createdAt || `${payment.date}T23:59:59`).getTime();
  const billingCreated = new Date(billing.createdAt).getTime();
  return paymentCreated > billingCreated;
}

function billingPaidAmount(billing) {
  return state.payments
    .filter((payment) => billing.calculationVersion >= 2
      ? payment.billingId === billing.id
      : paymentWasAfterBilling(payment, billing))
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
}

function billingPayments(billing) {
  return state.payments.filter((payment) => payment.billingId === billing.id);
}

function billingPaymentSummary(billing) {
  const payments = billingPayments(billing);
  if (!payments.length) return "Nenhum pagamento vinculado";
  return payments.map((payment) => `${formatDate(payment.date)} - ${money.format(payment.amount)}`).join("; ");
}

function paymentAllocationLabel(payment) {
  const billing = state.billings.find((item) => item.id === payment.billingId);
  return billing
    ? `Abateu a cobranca de ${formatDate(billing.startDate)} a ${formatDate(billing.endDate)}`
    : "Credito disponivel para o proximo fechamento";
}

function rawBillingOpenAmount(billing) {
  return Math.max(0, Number(billing.amount) - billingPaidAmount(billing));
}

function billingRolloverTarget(billing) {
  return billing?.rolledIntoBillingId
    ? state.billings.find((item) => item.id === billing.rolledIntoBillingId)
    : null;
}

function consolidatePreviousBillings(billing) {
  const targetAmount = Math.max(0, Number(billing.previousBalance || 0));
  if (targetAmount <= 0.001 || billing.rolledBillingIds?.length) return [];

  let remaining = targetAmount;
  const selected = state.billings
    .filter((item) =>
      item.id !== billing.id
      && item.clientId === billing.clientId
      && item.status !== "Cancelada"
      && !item.rolledIntoBillingId
      && String(item.createdAt || "") < String(billing.createdAt || "")
      && rawBillingOpenAmount(item) > 0.001
    )
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .filter((item) => {
      const openAmount = rawBillingOpenAmount(item);
      if (openAmount > remaining + 0.01) return false;
      remaining -= openAmount;
      return true;
    });

  if (!selected.length) return [];

  const rolledAt = billing.createdAt || new Date().toISOString();
  selected.forEach((item) => {
    item.rolledIntoBillingId = billing.id;
    item.rolledAt = rolledAt;
    item.status = "Consolidada";
    item.statusReason = `Saldo transferido para a cobranca de ${formatDate(billing.startDate)} a ${formatDate(billing.endDate)}`;
  });
  billing.rolledBillingIds = selected.map((item) => item.id);
  billing.rolledBalance = selected.reduce((sum, item) => sum + rawBillingOpenAmount(item), 0);
  return selected;
}

function releaseRolledBillings(billing) {
  const rolledIds = new Set(billing?.rolledBillingIds || []);
  state.billings.forEach((item) => {
    if (item.rolledIntoBillingId === billing?.id || rolledIds.has(item.id)) {
      delete item.rolledIntoBillingId;
      delete item.rolledAt;
      item.status = billingCurrentStatus(item);
      const paid = billingPaidAmount(item);
      item.statusReason = item.status === "Paga"
        ? `Quitada por ${billingPayments(item).length} pagamento(s) vinculado(s)`
        : paid > 0 ? "Pagamento parcial vinculado ao periodo" : "Aguardando pagamento";
    }
  });
  if (billing) {
    billing.rolledBillingIds = [];
    billing.rolledBalance = 0;
  }
}

function normalizeBillingRollovers() {
  let changed = false;
  [...state.billings]
    .filter((billing) => billing.status !== "Cancelada")
    .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")))
    .forEach((billing) => {
      if (billing.rolledBillingIds?.length) {
        billing.rolledBillingIds.forEach((id) => {
          const source = state.billings.find((item) => item.id === id);
          if (source && !source.rolledIntoBillingId) {
            source.rolledIntoBillingId = billing.id;
            changed = true;
          }
        });
      } else {
        if (consolidatePreviousBillings(billing).length) changed = true;
      }
    });
  return changed;
}

function billingOpenAmount(billing) {
  return billing?.rolledIntoBillingId ? 0 : rawBillingOpenAmount(billing);
}

function billingCurrentStatus(billing) {
  if (billing.rolledIntoBillingId) return "Consolidada";
  if (billing.status === "Cancelada") return "Cancelada";
  const paid = billingPaidAmount(billing);
  if (paid <= 0) return "Aberta";
  return billingOpenAmount(billing) <= 0 ? "Paga" : "Parcial";
}

function billingStatusLabel(billing) {
  const status = billingCurrentStatus(billing);
  return status === "Paga" ? "Quitada" : status;
}

function allocateAdvancePayments(billing, availablePayments) {
  let remainingDue = Number(billing.amount || 0);
  const allocatedIds = [];
  let creditGenerated = 0;
  const now = new Date().toISOString();

  availablePayments
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
    .forEach((payment) => {
      const originalAmount = Number(payment.amount || 0);
      const appliedAmount = Math.min(originalAmount, Math.max(0, remainingDue));
      const creditAmount = originalAmount - appliedAmount;
      if (appliedAmount > 0) {
        payment.amount = appliedAmount;
        payment.billingId = billing.id;
        payment.note = payment.note || "Pagamento antecipado aplicado ao fechamento";
        payment.updatedAt = now;
        allocatedIds.push(payment.id);
        remainingDue -= appliedAmount;
      }
      if (creditAmount > 0) {
        const credit = appliedAmount > 0 ? {
          ...payment,
          id: crypto.randomUUID(),
          billingId: null,
          amount: creditAmount,
          createdAt: now,
          updatedAt: now
        } : payment;
        credit.billingId = null;
        credit.note = `Credito de ${money.format(creditAmount)} gerado no fechamento de ${formatDate(billing.startDate)} a ${formatDate(billing.endDate)}${payment.note ? ` - ${payment.note}` : ""}`;
        credit.paymentSource = "Credito de pagamento";
        credit.updatedAt = now;
        if (appliedAmount > 0) state.payments.push(credit);
        creditGenerated += creditAmount;
      }
    });

  billing.paymentIds = allocatedIds;
  billing.paymentsTotal = Number(billing.amount || 0) - Math.max(0, remainingDue);
  billing.creditGenerated = creditGenerated;
  billing.statusReason = remainingDue <= 0
    ? `Quitada por ${allocatedIds.length} pagamento(s) vinculado(s)`
    : allocatedIds.length ? "Pagamento parcial vinculado ao periodo" : "Aguardando pagamento";
}

function billingAgeDays(billing) {
  return Math.max(0, Math.floor((Date.now() - new Date(billing.createdAt).getTime()) / 86400000));
}

function recentDateKeys(days) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - (days - index - 1));
    return date.toISOString().slice(0, 10);
  });
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentOperationalWeek(reference = new Date()) {
  const startDay = Number(systemSettings.weekStartDay ?? 0);
  const endDay = Number(systemSettings.weekEndDay ?? 5);
  const start = new Date(reference);
  start.setHours(12, 0, 0, 0);
  const daysFromStart = (start.getDay() - startDay + 7) % 7;
  start.setDate(start.getDate() - daysFromStart);
  const end = new Date(start);
  const weekLength = (endDay - startDay + 7) % 7;
  end.setDate(start.getDate() + weekLength);
  return { startDate: localDateKey(start), endDate: localDateKey(end) };
}

function monthPeriod(reference = new Date()) {
  const start = new Date(reference.getFullYear(), reference.getMonth(), 1, 12);
  const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 0, 12);
  return { startDate: localDateKey(start), endDate: localDateKey(end) };
}

function previousOperationalWeek(period) {
  const reference = new Date(`${period.startDate}T12:00:00`);
  reference.setDate(reference.getDate() - 1);
  return currentOperationalWeek(reference);
}

function ensureFinancePeriod() {
  financePeriod ||= currentOperationalWeek();
  return financePeriod;
}

function syncFinancePeriodControls() {
  const period = ensureFinancePeriod();
  ["payment", "billing"].forEach((prefix) => {
    const start = document.getElementById(`${prefix}StartFilter`);
    const end = document.getElementById(`${prefix}EndFilter`);
    const label = document.getElementById(`${prefix}PeriodLabel`);
    if (start) start.value = period.startDate;
    if (end) end.value = period.endDate;
    if (label) label.textContent = periodLabel(period);
  });
  document.querySelectorAll("[data-finance-period]").forEach((button) => {
    button.classList.toggle("active", button.dataset.financePeriod === financePeriodMode);
  });
}

function setFinancePeriod(period, mode = "custom") {
  financePeriod = period;
  financePeriodMode = mode;
  syncFinancePeriodControls();
}

function shiftFinancePeriod(direction) {
  const current = ensureFinancePeriod();
  const reference = new Date(`${current.startDate}T12:00:00`);
  if (financePeriodMode === "month") {
    reference.setMonth(reference.getMonth() + direction);
    setFinancePeriod(monthPeriod(reference), "month");
  } else {
    reference.setDate(reference.getDate() + direction * 7);
    setFinancePeriod(currentOperationalWeek(reference), "week");
  }
}

function setFinancePeriodFromInputs(prefix) {
  const start = document.getElementById(`${prefix}StartFilter`).value;
  const end = document.getElementById(`${prefix}EndFilter`).value;
  if (!start || !end || start > end) return;
  setFinancePeriod({ startDate: start, endDate: end }, "custom");
}

function refreshFinanceViews() {
  renderPayments();
  renderBillings();
}

function dateKeysBetween(startDate, endDate, maximum = 31) {
  const result = [];
  const date = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  while (date <= end && result.length < maximum) {
    result.push(localDateKey(date));
    date.setDate(date.getDate() + 1);
  }
  return result;
}

function inPeriod(date, period) {
  return date >= period.startDate && date <= period.endDate;
}

function periodLabel(period) {
  return `${formatDate(period.startDate)} a ${formatDate(period.endDate)}`;
}

function updateBillingStatuses() {
  state.billings.forEach((billing) => {
    if (billing.status === "Cancelada") return;
    billing.status = billingCurrentStatus(billing);
    if (billing.status === "Consolidada") {
      const target = billingRolloverTarget(billing);
      billing.statusReason = target
        ? `Saldo transferido para a cobranca de ${formatDate(target.startDate)} a ${formatDate(target.endDate)}`
        : "Saldo transferido para uma cobranca posterior";
      return;
    }
    if (billing.calculationVersion >= 2) {
      const paid = billingPaidAmount(billing);
      billing.statusReason = billing.status === "Paga"
        ? `Quitada por ${billingPayments(billing).length} pagamento(s) vinculado(s)`
        : paid > 0 ? "Pagamento parcial vinculado ao periodo" : "Aguardando pagamento";
    }
  });
}

function currentBillings() {
  const latestByClient = new Map();
  [...state.billings]
    .filter((billing) => billing.status !== "Cancelada")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .forEach((billing) => {
      if (!latestByClient.has(billing.clientId)) latestByClient.set(billing.clientId, billing);
    });
  return [...latestByClient.values()];
}

function dashboardNotifications() {
  const overdueServices = state.services
    .filter(isOverdueService)
    .sort((a, b) => serviceAgeHours(b) - serviceAgeHours(a));
  const overdueBillings = currentBillings()
    .filter((billing) => billingOpenAmount(billing) > 0 && billingAgeDays(billing) >= 7)
    .sort((a, b) => billingAgeDays(b) - billingAgeDays(a));
  return { overdueServices, overdueBillings };
}

function setMobileMenuOpen(open) {
  document.body.classList.toggle("mobile-menu-open", open);
  const button = document.getElementById("mobileMenuButton");
  if (!button) return;
  button.setAttribute("aria-expanded", String(open));
  button.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
  const icon = button.querySelector("span");
  if (icon) icon.textContent = open ? "×" : "☰";
}

function showView(viewId) {
  setMobileMenuOpen(false);
  document.querySelectorAll(".view, .tab").forEach((element) => element.classList.remove("active"));
  document.getElementById(viewId).classList.add("active");
  const clientViews = ["clients", "catalog", "services", "requests"];
  const financeViews = ["payments", "paymentMethods", "billing"];
  const mainView = clientViews.includes(viewId) ? "services" : financeViews.includes(viewId) ? "payments" : viewId;
  document.querySelector(`[data-view="${mainView}"]`)?.classList.add("active");
  document.querySelectorAll("[data-client-view]").forEach((button) => {
    const target = button.dataset.clientView;
    button.classList.toggle("active", target === viewId);
  });
  document.querySelectorAll(".finance-area-tabs [data-client-view]").forEach((button) => {
    const target = button.dataset.clientView;
    button.classList.toggle("active", target === viewId);
  });
}

function emptyMarkup() {
  return document.getElementById("emptyTemplate").innerHTML;
}

function searchableText(...values) {
  return values.join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function matchesSearch(search, ...values) {
  return !search || searchableText(...values).includes(searchableText(search));
}

function clientOptionLabel(client) {
  return client?.name || "";
}

function catalogOptionLabel(item) {
  return item?.code ? `${item.code} - ${item.name}` : item?.name || "";
}

function catalogPriceForClient(catalogItem, client) {
  return Number(catalogItem?.prices?.[client?.priceGroup] || 0);
}

function itemByExactLabel(items, value, labelBuilder) {
  const normalized = searchableText(value);
  return items.find((item) => searchableText(labelBuilder(item)) === normalized)
    || items.find((item) => searchableText(item.name) === normalized)
    || items.find((item) => item.code && searchableText(item.code) === normalized);
}

function uniqueClientMatch(value) {
  const exact = itemByExactLabel(state.clients, value, clientOptionLabel);
  if (exact) return exact;
  const matches = state.clients.filter((client) => matchesSearch(value, client.name));
  return matches.length === 1 ? matches[0] : null;
}

function formatDate(value) {
  return value ? value.split("-").reverse().join("/") : "-";
}

function renderSelects() {
  const options = state.clients.map((client) => `<option value="${client.id}">${escapeHtml(client.name)}</option>`).join("");
  document.querySelectorAll('select[name="clientId"]').forEach((select) => {
    const current = select.value;
    select.innerHTML = `<option value="">Selecione</option>${options}`;
    select.value = current;
  });
  ["paymentClientFilter", "billingClientFilter"].forEach((id) => {
    const filter = document.getElementById(id);
    const currentFilter = filter.value;
    filter.innerHTML = `<option value="">Todos os clientes</option>${options}`;
    filter.value = currentFilter;
  });

  const clientDatalistOptions = [...state.clients]
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .map((client) => `<option value="${escapeHtml(clientOptionLabel(client))}"></option>`)
    .join("");
  document.getElementById("serviceClientOptions").innerHTML = clientDatalistOptions;
  document.getElementById("serviceClientFilterOptions").innerHTML = clientDatalistOptions;
  document.getElementById("serviceCatalogOptions").innerHTML = [...state.catalog]
    .sort((a, b) => (Number(a.code) || 999999) - (Number(b.code) || 999999)
      || a.name.localeCompare(b.name, "pt-BR"))
    .map((item) => `<option value="${escapeHtml(catalogOptionLabel(item))}"></option>`)
    .join("");

  const priceGroupSelect = document.querySelector('#clientForm select[name="priceGroup"]');
  const selectedPriceGroup = priceGroupSelect.value;
  priceGroupSelect.innerHTML = `<option value="">Selecione</option>${state.priceTables
    .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
    .join("")}`;
  priceGroupSelect.value = selectedPriceGroup;

  const paymentMethodSelect = document.querySelector('#paymentForm select[name="method"]');
  const selectedPaymentMethod = paymentMethodSelect.value;
  paymentMethodSelect.innerHTML = `<option value="">Não informada</option>${state.paymentMethods
    .filter((method) => method.active)
    .map((method) => `<option value="${escapeHtml(method.name)}">${escapeHtml(method.name)}</option>`)
    .join("")}`;
  paymentMethodSelect.value = selectedPaymentMethod;
}

function renderCatalog() {
  const target = document.getElementById("catalogTable");
  const search = document.getElementById("catalogSearch").value.trim();
  const items = state.catalog.filter((item) => matchesSearch(search, item.code, item.name));
  const header = state.priceTables.map((name) => `<th>${escapeHtml(name)}</th>`).join("");
  const rows = items.length ? items
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .map((item) => `
      <tr>
        <td><strong>${item.code ? `${escapeHtml(item.code)} - ` : ""}${escapeHtml(item.name)}</strong></td>
        ${state.priceTables.map((name) => `<td>${money.format(item.prices[name] || 0)}</td>`).join("")}
        <td><div class="row-actions">
          <button class="table-action" data-edit-catalog="${item.id}">Editar</button>
          <button class="table-action danger" data-delete-catalog="${item.id}">Excluir</button>
        </div></td>
      </tr>`)
    .join("") : `<tr><td colspan="${state.priceTables.length + 2}">${emptyMarkup()}</td></tr>`;
  target.innerHTML = `<div class="catalog-table-wrap"><table class="catalog-table">
    <thead><tr><th>Serviço</th>${header}<th>Ações</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function renderPriceTables() {
  const target = document.getElementById("priceTableList");
  const search = document.getElementById("priceTableSearch").value.trim();
  const items = state.priceTables.filter((name) => matchesSearch(search, name));
  target.innerHTML = items.length ? items.map((name) => {
    const clients = state.clients.filter((client) => client.priceGroup === name).length;
    return `<article class="price-table-card">
      <h3>${escapeHtml(name)}</h3>
      <p class="meta">${clients} cliente(s) usando esta tabela</p>
      <div class="card-actions">
        <button class="table-action" data-edit-table="${escapeHtml(name)}">Editar</button>
        <button class="table-action danger" data-delete-table="${escapeHtml(name)}">Excluir</button>
      </div>
    </article>`;
  }).join("") : emptyMarkup();
}

function renderDashboard() {
  const serviceTotal = state.services.filter((item) => item.status !== "Cancelado")
    .reduce((sum, item) => sum + item.amount, 0);
  const paymentTotal = state.payments.reduce((sum, item) => sum + item.amount, 0);
  document.getElementById("totalOpen").textContent = money.format(serviceTotal - paymentTotal);
  document.getElementById("clientCount").textContent = state.clients.length;
  document.getElementById("serviceTotal").textContent = money.format(serviceTotal);
  document.getElementById("paymentTotal").textContent = money.format(paymentTotal);
  const pending = state.services.filter((item) => item.status === "A fazer");
  const overdue = pending.filter(isOverdueService);
  const alertPanel = document.getElementById("serviceAlertPanel");
  alertPanel.classList.toggle("has-alerts", overdue.length > 0);
  alertPanel.innerHTML = `
    <div class="panel-title">
      <div><span class="eyebrow">Alertas operacionais</span><h2>Serviços pendentes</h2></div>
      <button class="table-action" data-open-view="services">Ver lançamentos</button>
    </div>
    <div class="alert-summary">
      <article><span>A fazer</span><strong>${pending.length}</strong></article>
      <article class="${overdue.length ? "alert-danger" : ""}"><span>Acima de 24h</span><strong>${overdue.length}</strong></article>
    </div>
    ${overdue.length ? `<div class="alert-list">${overdue.slice(0, 5).map((item) => `
      <div><strong>${escapeHtml(clientById(item.clientId)?.name || "")}: ${escapeHtml(item.description)}</strong><span>${escapeHtml(item.reference || "Sem referência")} · ${formatServiceAge(item)}</span></div>`).join("")}</div>` : `<p class="meta">Nenhum serviço ultrapassou 24 horas.</p>`}`;

  const billings = currentBillings().map((billing) => ({
    ...billing,
    openAmount: billingOpenAmount(billing),
    ageDays: billingAgeDays(billing),
    currentStatus: billingCurrentStatus(billing)
  }));
  const openBillings = billings.filter((billing) => billing.openAmount > 0);
  const overdueBillings = openBillings.filter((billing) => billing.ageDays >= 7);
  const openTotal = openBillings.reduce((sum, billing) => sum + billing.openAmount, 0);
  const overdueTotal = overdueBillings.reduce((sum, billing) => sum + billing.openAmount, 0);
  const billingAlertPanel = document.getElementById("billingAlertPanel");
  billingAlertPanel.classList.toggle("has-alerts", overdueBillings.length > 0);
  billingAlertPanel.innerHTML = `
    <div class="panel-title">
      <div><span class="eyebrow">Alertas financeiros</span><h2>Cobranças em aberto</h2></div>
      <button class="table-action" data-payment-dashboard-filter="open">Ver pagamentos</button>
    </div>
    <div class="alert-summary finance-alert-summary">
      <article><span>Em aberto</span><strong>${money.format(openTotal)}</strong><small>${openBillings.length} cliente(s)</small></article>
      <article class="${overdueBillings.length ? "alert-danger" : ""}"><span>Há 7 dias ou mais</span><strong>${money.format(overdueTotal)}</strong><small>${overdueBillings.length} cobrança(s)</small></article>
    </div>
    ${overdueBillings.length ? `<div class="alert-list">${overdueBillings.slice(0, 5).map((billing) => `
      <div><strong>${escapeHtml(clientById(billing.clientId)?.name || "")}</strong><span>${money.format(billing.openAmount)} · ${billing.ageDays} dias em aberto</span></div>`).join("")}</div>
      <button class="table-action alert-link" data-payment-dashboard-filter="overdue">Ver todas as atrasadas</button>`
    : `<p class="meta">Nenhuma cobrança está aberta há 7 dias ou mais.</p>`}`;

  const dateKeys = recentDateKeys(7);
  const dailyPayments = dateKeys.map((date) => ({
    date,
    amount: state.payments
      .filter((payment) => payment.date === date)
      .reduce((sum, payment) => sum + Number(payment.amount), 0)
  }));
  const recentTotal = dailyPayments.reduce((sum, day) => sum + day.amount, 0);
  const dailyMaximum = Math.max(...dailyPayments.map((day) => day.amount), 1);
  document.getElementById("recentPaymentTotal").textContent = money.format(recentTotal);
  document.getElementById("paymentChart").innerHTML = dailyPayments.map((day) => {
    const height = day.amount ? Math.max(8, Math.round((day.amount / dailyMaximum) * 100)) : 2;
    const label = new Intl.DateTimeFormat("pt-BR", { weekday: "short" })
      .format(new Date(`${day.date}T12:00:00`))
      .replace(".", "");
    return `<div class="bar-column" title="${formatDate(day.date)}: ${money.format(day.amount)}">
      <span>${day.amount ? money.format(day.amount) : "—"}</span>
      <div class="bar-track"><i style="height:${height}%"></i></div>
      <strong>${label}</strong>
    </div>`;
  }).join("");

  const paidCount = billings.filter((billing) => billing.currentStatus === "Paga").length;
  const partialCount = billings.filter((billing) => billing.currentStatus === "Parcial").length;
  const openCount = billings.filter((billing) => billing.currentStatus === "Aberta").length;
  const billingCount = paidCount + partialCount + openCount;
  const paidDegrees = billingCount ? (paidCount / billingCount) * 360 : 0;
  const partialDegrees = billingCount ? (partialCount / billingCount) * 360 : 0;
  document.getElementById("billingStatusChart").innerHTML = `
    <div class="donut-chart" style="--paid:${paidDegrees}deg;--partial:${paidDegrees + partialDegrees}deg">
      <div><strong>${billingCount}</strong><span>cobranças</span></div>
    </div>
    <div class="chart-legend">
      <button data-payment-dashboard-filter="paid"><i class="legend-paid"></i><span>Pagas</span><strong>${paidCount}</strong></button>
      <button data-payment-dashboard-filter="open"><i class="legend-partial"></i><span>Parciais</span><strong>${partialCount}</strong></button>
      <button data-payment-dashboard-filter="open"><i class="legend-open"></i><span>Em aberto</span><strong>${openCount}</strong></button>
    </div>`;
  const list = document.getElementById("accountList");
  list.innerHTML = state.clients.length ? state.clients.map((client) => {
    const balance = balanceFor(client.id);
    const count = state.services.filter((item) => item.clientId === client.id).length;
    return `<div class="account-row">
      <div><strong>${escapeHtml(client.name)}</strong><span class="meta">${escapeHtml(client.priceGroup)}</span></div>
      <span class="meta">${count} serviço(s)</span>
      <strong class="amount ${balance < 0 ? "negative" : ""}">${money.format(balance)}</strong>
    </div>`;
  }).join("") : emptyMarkup();
}

function renderDashboardV2() {
  dashboardPeriod ||= currentOperationalWeek();
  const week = currentOperationalWeek();
  const period = dashboardPeriod;
  const isOperationalWeek = period.startDate === week.startDate && period.endDate === week.endDate;
  document.getElementById("dashboardStartDate").value = period.startDate;
  document.getElementById("dashboardEndDate").value = period.endDate;
  document.getElementById("dashboardServicesTab").classList.toggle("hidden", activeDashboardTab !== "services");
  document.getElementById("dashboardFinanceTab").classList.toggle("hidden", activeDashboardTab !== "finance");
  document.querySelectorAll("[data-dashboard-week-block]").forEach((element) => {
    element.classList.toggle("hidden", !isOperationalWeek);
  });
  document.querySelectorAll("[data-dashboard-period-block]").forEach((element) => {
    element.classList.toggle("hidden", isOperationalWeek);
  });
  document.querySelectorAll("[data-dashboard-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.dashboardTab === activeDashboardTab);
  });

  const servicesFor = (range) => state.services.filter((item) =>
    item.status !== "Cancelado" && inPeriod(item.date, range));
  // A payment linked to a billing belongs to that billing's operational period.
  // This prevents a late payment from looking like credit in a later week.
  const paymentsAppliedFor = (range) => state.payments.filter((item) => {
    if (!item.billingId) return inPeriod(item.date, range);
    const billing = state.billings.find((entry) => entry.id === item.billingId);
    return Boolean(billing && billing.status !== "Cancelada" && inPeriod(billing.endDate, range));
  });
  const paymentsReceivedFor = (range) => state.payments.filter((item) => inPeriod(item.date, range));
  const billingsFor = (range) => state.billings.filter((item) =>
    item.status !== "Cancelada" && inPeriod(item.endDate, range));
  const serviceMetrics = (range) => {
    const services = servicesFor(range);
    return {
      services,
      pending: services.filter((item) => item.status === "A fazer"),
      done: services.filter((item) => item.status === "Pronto"),
      delivered: services.filter((item) => item.status === "Entregue"),
      total: services.reduce((sum, item) => sum + Number(item.amount), 0)
    };
  };
  const serviceCards = (metrics) => {
    const card = (label, items, className) => `
      <article class="metric-card dashboard-status-card ${className}">
        <span>${label}</span><strong>${items.length}</strong>
        <small>${money.format(items.reduce((sum, item) => sum + Number(item.amount), 0))}</small>
      </article>`;
    return `${card("A fazer", metrics.pending, "metric-pending")}
      ${card("Feitos", metrics.done, "metric-done")}
      ${card("Entregues", metrics.delivered, "metric-delivered")}
      <article class="metric-card metric-main"><span>Total de serviços</span><strong>${metrics.services.length}</strong><small>${money.format(metrics.total)}</small></article>`;
  };

  const weekServices = serviceMetrics(week);
  const periodServices = serviceMetrics(period);
  document.getElementById("serviceWeekLabel").textContent = periodLabel(week);
  document.getElementById("servicePeriodLabel").textContent = periodLabel(period);
  document.getElementById("serviceWeekCards").innerHTML = serviceCards(weekServices);
  document.getElementById("servicePeriodCards").innerHTML = serviceCards(periodServices);

  const statusTotal = periodServices.services.length || 1;
  const pendingDegrees = periodServices.pending.length / statusTotal * 360;
  const doneDegrees = periodServices.done.length / statusTotal * 360;
  document.getElementById("serviceStatusDashboardChart").innerHTML = `
    <div class="donut-chart service-donut" style="--pending:${pendingDegrees}deg;--done:${pendingDegrees + doneDegrees}deg">
      <div><strong>${periodServices.services.length}</strong><span>serviços</span></div>
    </div>
    <div class="chart-legend">
      <button><i class="legend-service-pending"></i><span>A fazer</span><strong>${periodServices.pending.length}</strong></button>
      <button><i class="legend-service-done"></i><span>Feitos</span><strong>${periodServices.done.length}</strong></button>
      <button><i class="legend-service-delivered"></i><span>Entregues</span><strong>${periodServices.delivered.length}</strong></button>
    </div>`;

  const volumeDates = dateKeysBetween(period.startDate, period.endDate, 31);
  const dailyVolumes = volumeDates.map((date) => ({
    date,
    count: periodServices.services.filter((item) => item.date === date).length
  }));
  const volumeMaximum = Math.max(...dailyVolumes.map((item) => item.count), 1);
  document.getElementById("serviceVolumeChart").innerHTML = dailyVolumes.map((item) => `
    <div class="horizontal-bar" title="${formatDate(item.date)}: ${item.count} serviço(s)">
      <span>${item.date.slice(8, 10)}</span>
      <div><i style="width:${item.count ? Math.max(5, item.count / volumeMaximum * 100) : 1}%"></i></div>
      <strong>${item.count}</strong>
    </div>`).join("") || `<p class="meta">Nenhum serviço no período.</p>`;

  const clientVolumes = state.clients.map((client) => {
    const services = periodServices.services.filter((item) => item.clientId === client.id);
    return {
      client,
      count: services.length,
      amount: services.reduce((sum, item) => sum + Number(item.amount), 0)
    };
  }).filter((item) => item.count).sort((a, b) => b.count - a.count || b.amount - a.amount);
  const maximumClientVolume = Math.max(...clientVolumes.map((item) => item.count), 1);
  document.getElementById("serviceClientRanking").innerHTML = clientVolumes.length
    ? clientVolumes.map((item, index) => `
      <article class="ranking-row">
        <span class="ranking-position">${index + 1}</span>
        <div><strong>${escapeHtml(item.client.name)}</strong><div class="ranking-track"><i style="width:${item.count / maximumClientVolume * 100}%"></i></div></div>
        <span>${item.count} serviço(s)</span><strong>${money.format(item.amount)}</strong>
      </article>`).join("")
    : `<p class="meta">Nenhum serviço no período selecionado.</p>`;

  const pending = state.services.filter((item) => item.status === "A fazer");
  const overdue = pending.filter(isOverdueService);
  const serviceAlertPanel = document.getElementById("serviceAlertPanel");
  serviceAlertPanel.classList.toggle("has-alerts", overdue.length > 0);
  serviceAlertPanel.innerHTML = `
    <div class="panel-title"><div><span class="eyebrow">Alertas operacionais</span><h2>Serviços pendentes</h2></div><button class="table-action" data-open-view="services">Ver lançamentos</button></div>
    <div class="alert-summary"><article><span>A fazer</span><strong>${pending.length}</strong></article><article class="${overdue.length ? "alert-danger" : ""}"><span>Acima de 24h</span><strong>${overdue.length}</strong></article></div>
    ${overdue.length ? `<div class="alert-list">${overdue.slice(0, 5).map((item) => `<div><strong>${escapeHtml(clientById(item.clientId)?.name || "")}: ${escapeHtml(item.description)}</strong><span>${escapeHtml(item.reference || "Sem referência")} · ${formatServiceAge(item)}</span></div>`).join("")}</div>` : `<p class="meta">Nenhum serviço ultrapassou 24 horas.</p>`}`;

  const financeMetrics = (range) => {
    const servicesTotal = servicesFor(range).reduce((sum, item) => sum + Number(item.amount), 0);
    const paymentTotal = paymentsReceivedFor(range).reduce((sum, item) => sum + Number(item.amount), 0);
    const appliedPaymentTotal = paymentsAppliedFor(range).reduce((sum, item) => sum + Number(item.amount), 0);
    return {
      servicesTotal,
      paymentTotal,
      appliedPaymentTotal,
      balance: servicesTotal - appliedPaymentTotal,
      billings: billingsFor(range)
    };
  };
  const financeCards = (metrics) => `
    <article class="metric-card metric-main"><span>Saldo do período</span><strong>${money.format(metrics.balance)}</strong><small>Serviços menos baixas deste período</small></article>
    <article class="metric-card"><span>Serviços lançados</span><strong>${money.format(metrics.servicesTotal)}</strong><small>Produção no período</small></article>
    <article class="metric-card"><span>Pagamentos</span><strong>${money.format(metrics.paymentTotal)}</strong><small>Recebimentos no período</small></article>
    <article class="metric-card"><span>Cobranças geradas</span><strong>${metrics.billings.length}</strong><small>Fechamentos no período</small></article>`;
  document.getElementById("financeWeekLabel").textContent = periodLabel(week);
  document.getElementById("financePeriodLabel").textContent = periodLabel(period);
  document.getElementById("financeWeekCards").innerHTML = financeCards(financeMetrics(week));
  document.getElementById("financePeriodCards").innerHTML = financeCards(financeMetrics(period));

  const paymentDates = dateKeysBetween(period.startDate, period.endDate, 31);
  const dailyPayments = paymentDates.map((date) => ({
    date,
    amount: paymentsReceivedFor(period).filter((payment) => payment.date === date)
      .reduce((sum, payment) => sum + Number(payment.amount), 0)
  }));
  const recentTotal = dailyPayments.reduce((sum, item) => sum + item.amount, 0);
  const paymentMaximum = Math.max(...dailyPayments.map((item) => item.amount), 1);
  document.getElementById("recentPaymentTotal").textContent = money.format(recentTotal);
  document.getElementById("paymentChart").style.setProperty("--bar-count", String(Math.max(dailyPayments.length, 1)));
  document.getElementById("paymentChart").innerHTML = dailyPayments.map((item) => {
    const height = item.amount ? Math.max(8, item.amount / paymentMaximum * 100) : 2;
    return `<div class="bar-column" title="${formatDate(item.date)}: ${money.format(item.amount)}"><span>${item.amount ? money.format(item.amount) : "—"}</span><div class="bar-track"><i style="height:${height}%"></i></div><strong>${item.date.slice(8, 10)}</strong></div>`;
  }).join("");

  const periodBillings = billingsFor(period).map((billing) => ({
    ...billing,
    currentStatus: billingCurrentStatus(billing),
    openAmount: billingOpenAmount(billing)
  }));
  const paidCount = periodBillings.filter((item) => item.currentStatus === "Paga").length;
  const partialCount = periodBillings.filter((item) => item.currentStatus === "Parcial").length;
  const openCount = periodBillings.filter((item) => item.currentStatus === "Aberta").length;
  const billingCount = paidCount + partialCount + openCount || 1;
  const paidDegrees = paidCount / billingCount * 360;
  const partialDegrees = partialCount / billingCount * 360;
  document.getElementById("billingStatusChart").innerHTML = `
    <div class="donut-chart" style="--paid:${paidDegrees}deg;--partial:${paidDegrees + partialDegrees}deg"><div><strong>${periodBillings.length}</strong><span>cobranças</span></div></div>
    <div class="chart-legend"><button data-payment-dashboard-filter="paid"><i class="legend-paid"></i><span>Pagas</span><strong>${paidCount}</strong></button><button data-payment-dashboard-filter="open"><i class="legend-partial"></i><span>Parciais</span><strong>${partialCount}</strong></button><button data-payment-dashboard-filter="open"><i class="legend-open"></i><span>Em aberto</span><strong>${openCount}</strong></button></div>`;

  const openBillings = currentBillings().map((billing) => ({ ...billing, openAmount: billingOpenAmount(billing), ageDays: billingAgeDays(billing) }))
    .filter((billing) => billing.openAmount > 0);
  const overdueBillings = openBillings.filter((billing) => billing.ageDays >= 7);
  const billingAlertPanel = document.getElementById("billingAlertPanel");
  billingAlertPanel.classList.toggle("has-alerts", overdueBillings.length > 0);
  billingAlertPanel.innerHTML = `
    <div class="panel-title"><div><span class="eyebrow">Alertas financeiros</span><h2>Cobranças em aberto</h2></div><button class="table-action" data-payment-dashboard-filter="open">Ver pagamentos</button></div>
    <div class="alert-summary finance-alert-summary"><article><span>Em aberto</span><strong>${money.format(openBillings.reduce((sum, item) => sum + item.openAmount, 0))}</strong><small>${openBillings.length} cobrança(s)</small></article><article class="${overdueBillings.length ? "alert-danger" : ""}"><span>Há 7 dias ou mais</span><strong>${money.format(overdueBillings.reduce((sum, item) => sum + item.openAmount, 0))}</strong><small>${overdueBillings.length} cobrança(s)</small></article></div>`;

  const periodAccounts = state.clients.map((client) => {
    const serviceAmount = periodServices.services.filter((item) => item.clientId === client.id)
      .reduce((sum, item) => sum + Number(item.amount), 0);
    const paymentAmount = paymentsAppliedFor(period).filter((item) => item.clientId === client.id)
      .reduce((sum, item) => sum + Number(item.amount), 0);
    return { client, serviceAmount, paymentAmount, balance: serviceAmount - paymentAmount };
  }).filter((item) => item.serviceAmount || item.paymentAmount).sort((a, b) => b.balance - a.balance);
  document.getElementById("accountList").innerHTML = periodAccounts.length ? periodAccounts.map((item) => `
    <div class="account-row"><div><strong>${escapeHtml(item.client.name)}</strong><span class="meta">${escapeHtml(item.client.priceGroup)}</span></div><span class="meta">${money.format(item.serviceAmount)} / abatido ${money.format(item.paymentAmount)}</span><strong class="amount ${item.balance < 0 ? "negative" : ""}">${money.format(item.balance)}</strong></div>`).join("") : emptyMarkup();
}

function alertKey(item) {
  return `${item.type}:${item.id}`;
}

function activeAlertItems() {
  const { overdueServices, overdueBillings } = dashboardNotifications();
  const pendingRequests = (state.serviceRequests || []).filter((item) => item.status === "Novo");
  return [
    ...overdueServices.map((service) => ({
      id: service.id,
      type: "service",
      title: `${clientById(service.clientId)?.name || "Cliente"}: ${service.description}`,
      detail: `${formatServiceAge(service)} - ${service.reference || "Sem referencia"}`
    })),
    ...overdueBillings.map((billing) => ({
      id: billing.id,
      type: "billing",
      title: `Cobranca de ${clientById(billing.clientId)?.name || "Cliente"}`,
      detail: `${money.format(billingOpenAmount(billing))} - ${billingAgeDays(billing)} dias em aberto`
    })),
    ...pendingRequests.slice(0, 20).map((request) => ({
      id: request.id,
      type: "request",
      title: `Pedido de ${clientById(request.clientId)?.name || "Cliente"}`,
      detail: `${request.references?.length || 0} referencia(s) - ${request.serviceName || "Servico"}`
    }))
  ];
}

function archivedAlertByKey(key) {
  return alertMessages.find((item) => item.key === key);
}

function archiveAlert(item) {
  const key = alertKey(item);
  if (!archivedAlertByKey(key)) {
    alertMessages.unshift({
      key,
      type: item.type,
      title: item.title,
      detail: item.detail,
      archivedAt: new Date().toISOString()
    });
    saveAlertMessages();
  }
}

function renderNotifications() {
  const alerts = activeAlertItems();
  const visibleAlerts = alerts.filter((item) => !archivedAlertByKey(alertKey(item)));
  const alertCount = visibleAlerts.length;
  const today = new Date().toISOString().slice(0, 10);
  const receivedToday = state.payments
    .filter((payment) => payment.date === today)
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const openTotal = currentBillings()
    .reduce((sum, billing) => sum + billingOpenAmount(billing), 0);
  const count = document.getElementById("notificationCount");
  count.textContent = alertCount > 99 ? "99+" : String(alertCount);
  count.classList.toggle("hidden", alertCount === 0);
  document.getElementById("notificationButton").classList.toggle("has-alerts", alertCount > 0);
  document.getElementById("notificationDailySummary").innerHTML = `
    <article><span>Recebido hoje</span><strong>${money.format(receivedToday)}</strong></article>
    <article><span>Total em aberto</span><strong>${money.format(openTotal)}</strong></article>`;

  document.getElementById("notificationList").innerHTML = visibleAlerts.length ? visibleAlerts.map((item) => `
    <article class="notification-item notification-${item.type}">
      <i></i>
      <span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small></span>
      <div class="notification-actions">
        <button class="table-action" data-notification-target="${item.type}">Ver</button>
        <button class="table-action" data-read-alert="${escapeHtml(alertKey(item))}">Marcar como lida</button>
      </div>
    </article>`).join("") : `
    <div class="notification-empty">
      <strong>Tudo em dia.</strong>
      <span>Nao ha alertas pendentes.</span>
    </div>`;

  const archivedMessages = alertMessages.filter((item) => !item.deletedAt);
  document.getElementById("notificationArchive").innerHTML = archivedMessages.length ? archivedMessages.slice(0, 30).map((item) => `
    <article class="notification-archive-item">
      <span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)} - ${new Date(item.archivedAt).toLocaleString("pt-BR")}</small></span>
      <button class="table-action danger" data-delete-alert-message="${escapeHtml(item.key)}">Excluir</button>
    </article>`).join("") : `
    <div class="notification-empty"><strong>Sem mensagens arquivadas.</strong></div>`;
}

function renderClients() {
  const target = document.getElementById("clientList");
  const search = document.getElementById("clientSearch").value.trim();
  const items = state.clients.filter((client) =>
    matchesSearch(search, client.name, client.phone, client.priceGroup));
  target.innerHTML = items.length ? items.map((client) => `
    <article class="client-card">
      <h3>${escapeHtml(client.name)}</h3>
      <p class="meta">${escapeHtml(client.phone)}</p>
      <span class="badge">${escapeHtml(client.priceGroup)}</span>
      <div class="access-box">Saldo atual: ${money.format(balanceFor(client.id))}</div>
      <div class="card-actions">
        <button class="table-action" data-edit-client="${client.id}">Editar</button>
        <button class="table-action danger" data-delete-client="${client.id}">Excluir</button>
      </div>
    </article>`).join("") : emptyMarkup();
}

function renderServices() {
  const clientFilter = document.getElementById("serviceClientFilter").value;
  const clientNameFilter = document.getElementById("serviceClientNameFilter").value.trim();
  const statusFilter = document.getElementById("serviceStatusFilter").value;
  const startDate = document.getElementById("serviceStartDate").value;
  const endDate = document.getElementById("serviceEndDate").value;
  const search = document.getElementById("serviceSearch").value.trim();
  const searchAcrossHistory = Boolean(search) && state.services.some((item) =>
    matchesSearch(search, item.reference));
  document.getElementById("serviceEntryPeriodLabel").textContent = searchAcrossHistory
    ? "Busca por referencia em todo o historico"
    : startDate && endDate
    ? `${formatDate(startDate)} a ${formatDate(endDate)}`
    : "Todos os períodos";
  const items = state.services
    .filter((item) => !clientFilter || item.clientId === clientFilter)
    .filter((item) => !clientNameFilter || matchesSearch(clientNameFilter, clientById(item.clientId)?.name))
    .filter((item) => !statusFilter || item.status === statusFilter)
    .filter((item) => searchAcrossHistory || !startDate || item.date >= startDate)
    .filter((item) => searchAcrossHistory || !endDate || item.date <= endDate)
    .filter((item) => matchesSearch(
      search,
      item.description,
      item.reference,
      clientById(item.clientId)?.name,
      serviceStatusLabel(item.status)
    ))
    .sort((a, b) => {
      const statusOrder = { "A fazer": 0, Pronto: 1, Entregue: 2, Cancelado: 3 };
      const statusDifference = (statusOrder[a.status] ?? 4) - (statusOrder[b.status] ?? 4);
      return statusDifference || b.date.localeCompare(a.date)
        || String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    });
  document.getElementById("serviceList").innerHTML = items.length ? items.map((item) => `
    <article class="timeline-item ${isOverdueService(item) ? "service-overdue" : ""} ${item.isSecondary ? "secondary-service" : ""}">
      <time>${dateFormat.format(new Date(`${item.date}T00:00:00Z`))}</time>
      <div>
        <h3 class="service-card-description">${escapeHtml(item.description)}</h3>
        <p class="service-card-reference">${escapeHtml(item.reference || "Sem referência")}</p>
        <p class="meta service-card-context">${escapeHtml(clientById(item.clientId)?.name || "")}</p>
        ${originCancelledNote(item) ? `<span class="origin-cancelled-label">${escapeHtml(originCancelledNote(item))}</span>` : ""}
        <span class="status status-${item.status.toLowerCase().replace(" ", "-")}">${escapeHtml(serviceStatusLabel(item.status))}</span>${item.isSecondary ? `<span class="secondary-service-label">Serviço complementar</span>` : ""}${isOverdueService(item) ? `<span class="overdue-label">${formatServiceAge(item)}</span>` : ""}${item.confirmationRequestedAt && item.status === "Pronto" ? `<span class="confirmation-label">Confirmação solicitada</span>` : ""}${item.deliveredAt ? `<span class="delivered-label">${escapeHtml(deliveredLabel(item))}</span>` : ""}${item.status === "Cancelado" ? `<p class="cancellation-reason"><strong>Motivo:</strong> ${escapeHtml(item.cancellationReason || "Não informado")}${item.cancellationOriginalAmount !== null && item.cancellationOriginalAmount !== undefined ? ` · Valor anterior: ${money.format(item.cancellationOriginalAmount)}` : ""}</p>` : ""}
      </div>
      <strong>${money.format(item.amount)}</strong>
      <div class="service-actions">
        <div class="status-actions">
          ${item.status === "A fazer" ? `<button class="table-action success" data-service-status="Pronto" data-entry-id="${item.id}">Marcar feito</button>` : ""}
          ${item.status === "Pronto" ? `<button class="table-action" data-request-delivery="${item.id}">Solicitar confirmação</button>` : ""}
          ${item.status === "Pronto" ? `<button class="table-action success" data-service-status="Entregue" data-entry-id="${item.id}">Marcar entregue</button>` : ""}
        </div>
        <button class="mobile-service-more" type="button" data-toggle-service-actions="${item.id}" aria-expanded="false">Mais opcoes</button>
        <div class="row-actions">
          ${item.status !== "Cancelado" ? `<button class="table-action" data-edit-entry="${item.id}">Editar</button><button class="table-action danger" data-cancel-entry="${item.id}">Cancelar</button>` : ""}
          <button class="table-action danger" data-delete-entry="${item.id}">Excluir</button>
        </div>
      </div>
    </article>`).join("") : emptyMarkup();
}

function renderServiceRequests() {
  const requests = state.serviceRequests || [];
  const search = document.getElementById("requestSearch")?.value.trim() || "";
  const status = document.getElementById("requestStatusFilter")?.value || "Novo";
  const filtered = requests
    .filter((item) => !status || item.status === status)
    .filter((item) => matchesSearch(
      search,
      clientById(item.clientId)?.name,
      item.serviceName,
      item.requestedBy,
      item.notes,
      ...(item.references || [])
    ))
    .sort((a, b) => {
      const statusOrder = { Novo: 0, Importado: 1, Cancelado: 2 };
      return (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9)
        || String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    });
  const pending = requests.filter((item) => item.status === "Novo");
  const imported = requests.filter((item) => item.status === "Importado");
  const totalReferences = pending.reduce((sum, item) => sum + (item.references?.length || 0), 0);
  const pendingAmount = pending.reduce((sum, item) => sum + Number(item.amount || 0) * Math.max(1, item.references?.length || 1), 0);
  document.getElementById("requestSummary").innerHTML = `
    <article class="metric-card request-card-new"><span>Pedidos novos</span><strong>${pending.length}</strong><small>${totalReferences} referência(s)</small></article>
    <article class="metric-card request-card-value"><span>Valor estimado</span><strong>${money.format(pendingAmount)}</strong><small>Pedidos ainda não importados</small></article>
    <article class="metric-card request-card-imported"><span>Importados</span><strong>${imported.length}</strong><small>Já viraram lançamento</small></article>
    <article class="metric-card metric-main"><span>Total recebido</span><strong>${requests.length}</strong><small>Histórico de pedidos</small></article>`;
  document.getElementById("requestList").innerHTML = filtered.length ? filtered.map((request) => {
    const references = request.references || [];
    return `<article class="request-card request-${String(request.status || "Novo").toLowerCase()}">
      <div class="request-card-head">
        <div><span class="eyebrow">${formatDate(request.requestedDate)}</span><h3>${escapeHtml(clientById(request.clientId)?.name || "Cliente")}</h3></div>
        <span class="request-status">${escapeHtml(request.status || "Novo")}</span>
      </div>
      <strong class="request-service-name">${escapeHtml(request.serviceName || "Serviço")}</strong>
      <div class="request-reference-list">${references.length ? references.map((reference) => `<span>${escapeHtml(reference)}</span>`).join("") : `<span>Sem referência</span>`}</div>
      <p class="meta">Solicitante: ${escapeHtml(request.requestedBy || "Não informado")}</p>
      ${request.notes ? `<p class="request-notes">${escapeHtml(request.notes)}</p>` : ""}
      <p class="meta">Valor unitário: <strong>${money.format(Number(request.amount || 0))}</strong></p>
      <div class="card-actions">
        ${request.status === "Novo"
    ? `<button class="table-action success" data-import-client-request="${request.id}">Importar para lan\u00E7amento</button><button class="table-action danger" data-cancel-client-request="${request.id}">Cancelar pedido</button>`
    : `<button class="table-action danger" data-delete-client-request="${request.id}">Excluir do historico</button>`}
      </div>
    </article>`;
  }).join("") : emptyMarkup();
}

function renderPayments() {
  const period = ensureFinancePeriod();
  const clientFilter = document.getElementById("paymentClientFilter").value;
  const statusFilter = document.getElementById("paymentStatusFilter").value;
  const startFilter = document.getElementById("paymentStartFilter").value;
  const endFilter = document.getElementById("paymentEndFilter").value;
  const search = document.getElementById("paymentSearch").value.trim();
  const billings = state.billings
    .filter((billing) => billing.status !== "Cancelada")
    .map((billing) => ({
      ...billing,
      currentStatus: billingCurrentStatus(billing),
      paidAmount: billingPaidAmount(billing),
      openAmount: billingOpenAmount(billing),
      ageDays: billingAgeDays(billing)
    }))
    .filter((billing) => !clientFilter || billing.clientId === clientFilter)
    .filter((billing) => !startFilter || billing.endDate >= startFilter)
    .filter((billing) => !endFilter || billing.endDate <= endFilter)
    .filter((billing) => {
      if (!statusFilter) return true;
      if (statusFilter === "open") return billing.openAmount > 0 && billing.currentStatus !== "Cancelada";
      if (statusFilter === "overdue") return billing.openAmount > 0 && billing.ageDays >= 7;
      if (statusFilter === "paid") return billing.currentStatus === "Paga";
      return true;
    })
    .filter((billing) => matchesSearch(
      search,
      clientById(billing.clientId)?.name,
      billing.currentStatus,
      billing.identifier
    ))
    .sort((a, b) => b.endDate.localeCompare(a.endDate));

  const allActiveBillings = state.billings.filter((billing) => billing.status !== "Cancelada");
  const totalOpen = allActiveBillings.reduce((sum, billing) => sum + billingOpenAmount(billing), 0);
  const receivedTotal = state.payments
    .filter((payment) => inPeriod(payment.date, period))
    .reduce((sum, payment) => sum + Number(payment.amount), 0);

  const previousWeek = previousOperationalWeek(period);
  const previousWeekOpen = allActiveBillings
    .filter((billing) => inPeriod(billing.endDate, previousWeek))
    .reduce((sum, billing) => sum + billingOpenAmount(billing), 0);
  document.getElementById("paymentSummary").innerHTML = `
    <article class="metric-card finance-open-card ${previousWeekOpen > 0 ? "has-open" : ""}"><span>Em aberto da semana anterior</span><strong>${money.format(previousWeekOpen)}</strong><small>${periodLabel(previousWeek)}</small></article>
    <article class="metric-card finance-open-card ${totalOpen > 0 ? "has-open" : ""}"><span>Debito total em aberto</span><strong>${money.format(totalOpen)}</strong><small>${allActiveBillings.filter((billing) => billingOpenAmount(billing) > 0).length} cobranca(s)</small></article>
    <article class="metric-card finance-received-card"><span>Recebido no periodo</span><strong>${money.format(receivedTotal)}</strong><small>${periodLabel(period)}</small></article>`;

  document.getElementById("openBillingList").innerHTML = billings.length ? billings.map((billing) => `
    <article class="receivable-card ${billing.ageDays >= 7 && billing.openAmount > 0 ? "receivable-overdue" : ""}">
      <div class="receivable-heading">
        <div><span class="eyebrow">${formatDate(billing.startDate)} a ${formatDate(billing.endDate)}</span><h3>${escapeHtml(clientById(billing.clientId)?.name || "")}</h3></div>
        <span class="billing-status billing-${billing.currentStatus.toLowerCase()}">${billing.currentStatus}</span>
      </div>
      <strong class="mobile-finance-balance">${money.format(billing.openAmount)}</strong>
      <button class="mobile-finance-more" type="button" data-toggle-finance-card aria-expanded="false">Ver detalhes</button>
      <div class="mobile-finance-details">
      <div class="receivable-values">
        <span>Valor original<strong>${money.format(billing.amount)}</strong></span>
        <span>Pagamentos vinculados<strong>${money.format(billing.paidAmount)}</strong></span>
        <span>Saldo em aberto<strong>${money.format(billing.openAmount)}</strong></span>
      </div>
      <p class="meta"><strong>Motivo:</strong> ${escapeHtml(billing.statusReason || (billing.currentStatus === "Paga" ? "Quitada pelos pagamentos vinculados" : "Aguardando pagamento"))}</p>
      <p class="meta"><strong>Pagamentos:</strong> ${escapeHtml(billingPaymentSummary(billing))}</p>
      ${billing.openAmount > 0 && billing.currentStatus !== "Cancelada" ? `
        <div class="receivable-actions">
          <button class="table-action" data-pay-billing="${billing.id}" data-payment-mode="partial">Baixa parcial</button>
          <button class="table-action success" data-pay-billing="${billing.id}" data-payment-mode="full">Quitar ${money.format(billing.openAmount)}</button>
        </div>` : ""}
      ${billing.ageDays >= 7 && billing.openAmount > 0 ? `<p class="overdue-message">Cobrança aberta há ${billing.ageDays} dias.</p>` : ""}
      </div>
    </article>`).join("") : emptyMarkup();

  const items = state.payments
    .filter((item) => !clientFilter || item.clientId === clientFilter)
    .filter((item) => !startFilter || item.date >= startFilter)
    .filter((item) => !endFilter || item.date <= endFilter)
    .filter((item) => matchesSearch(search, clientById(item.clientId)?.name, item.note))
    .sort((a, b) => b.date.localeCompare(a.date));
  document.getElementById("paymentList").innerHTML = items.length ? items.map((item) => `
    <article class="timeline-item ${item.billingId ? "payment-applied" : ""}">
      <time>${dateFormat.format(new Date(`${item.date}T00:00:00Z`))}</time>
      <div><h3>${escapeHtml(clientById(item.clientId)?.name || "")}</h3><p class="meta">${escapeHtml(item.note || "Pagamento registrado")}</p><span class="payment-origin">${escapeHtml(item.method || "Forma não informada")} · ${escapeHtml(item.paymentSource || "Manual")}</span><p class="payment-allocation ${item.billingId ? "" : "credit"}">${escapeHtml(paymentAllocationLabel(item))}</p></div>
      <strong>${money.format(item.amount)}</strong>
      <div class="row-actions">${item.billingId ? `<span class="applied-badge">Abatido</span>` : `<button class="table-action" data-edit-payment="${item.id}">Editar</button>`}<button class="table-action danger" data-delete-payment="${item.id}">Excluir</button></div>
    </article>`).join("") : emptyMarkup();
}

function renderPaymentMethods() {
  const target = document.getElementById("paymentMethodList");
  const search = document.getElementById("paymentMethodSearch").value.trim();
  const statusFilter = document.getElementById("paymentMethodStatusFilter").value;
  const items = state.paymentMethods
    .filter((method) => !statusFilter || (statusFilter === "active" ? method.active : !method.active))
    .filter((method) => matchesSearch(search, method.type, method.name, method.details, method.link));
  target.innerHTML = items.length ? items.map((method) => `
    <article class="payment-method-card">
      <span class="method-type">${escapeHtml(method.type)}</span>
      <h3>${escapeHtml(method.name)}</h3>
      <p class="meta">${escapeHtml(method.details || "Sem instruções cadastradas")}</p>
      ${method.link ? `<p class="meta">${escapeHtml(method.link)}</p>` : ""}
      <span class="badge">${method.active ? "Ativa" : "Inativa"}</span>
      <div class="card-actions">
        <button class="table-action" data-edit-method="${method.id}">Editar</button>
        <button class="table-action danger" data-delete-method="${method.id}">Excluir</button>
      </div>
    </article>`).join("") : emptyMarkup();
}

function renderBillings() {
  ensureFinancePeriod();
  const clientFilter = document.getElementById("billingClientFilter").value;
  const statusFilter = document.getElementById("billingStatusFilter").value;
  const startFilter = document.getElementById("billingStartFilter").value;
  const endFilter = document.getElementById("billingEndFilter").value;
  const search = document.getElementById("billingSearch").value.trim();
  const accessBillingByClient = new Map();
  state.billings
    .filter((billing) => billing.status !== "Cancelada")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .forEach((billing) => accessBillingByClient.set(billing.clientId, billing.id));
  const items = state.billings
    .filter((item) => !clientFilter || item.clientId === clientFilter)
    .filter((item) => !startFilter || item.endDate >= startFilter)
    .filter((item) => !endFilter || item.endDate <= endFilter)
    .filter((item) => {
      const status = billingCurrentStatus(item);
      if (statusFilter === "paid") return status === "Paga";
      if (statusFilter === "open") return status === "Aberta" || status === "Parcial";
      return true;
    })
    .filter((item) => matchesSearch(
      search,
      clientById(item.clientId)?.name,
      item.identifier,
      item.status,
      item.startDate,
      item.endDate
    ))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  document.getElementById("billingList").innerHTML = items.length ? items.map((item) => `
    <article class="billing-card ${billingCurrentStatus(item) === "Paga" ? "billing-paid" : ""} ${billingCurrentStatus(item) === "Consolidada" ? "billing-consolidated" : ""}">
      <span class="eyebrow">${item.startDate.split("-").reverse().join("/")} a ${item.endDate.split("-").reverse().join("/")}</span>
      <h3>${escapeHtml(clientById(item.clientId)?.name || "")}</h3>
      <p class="meta"><span class="billing-status billing-${billingCurrentStatus(item).toLowerCase()}">${billingStatusLabel(item)}</span> · Saldo em aberto</p>
      <strong class="hero-value" style="font-size:30px">${money.format(billingOpenAmount(item))}</strong>
      <button class="mobile-finance-more" type="button" data-toggle-finance-card aria-expanded="false">Ver detalhes</button>
      <div class="mobile-finance-details">
      <p class="meta"><strong>${escapeHtml(item.statusReason || (billingCurrentStatus(item) === "Paga" ? "Quitada pelos pagamentos vinculados" : "Aguardando pagamento"))}</strong></p>
      <p class="meta">Pagamentos: ${escapeHtml(billingPaymentSummary(item))}</p>
      ${billingRolloverTarget(item) ? `<p class="billing-rollover-note">Saldo incorporado na cobranca de ${formatDate(billingRolloverTarget(item).startDate)} a ${formatDate(billingRolloverTarget(item).endDate)}.</p>` : ""}
      ${Number(item.creditGenerated || 0) > 0 ? `<p class="payment-allocation credit">Credito gerado para a proxima cobranca: <strong>${money.format(item.creditGenerated)}</strong></p>` : ""}
      <p class="billing-history">${item.sendHistory?.length
        ? `Último envio: ${new Date(item.sendHistory[item.sendHistory.length - 1].sentAt).toLocaleString("pt-BR")}`
        : "Ainda não enviada pelo sistema"}</p>
      <p class="meta">Histórico no portal: <strong>${item.historyEnabled ? "Liberado" : "Bloqueado"}</strong></p>
      <div class="access-box">${item.identifier
        ? `<div class="access-data">
            <span><small>ID</small><strong>${escapeHtml(item.identifier)}</strong></span>
            <button type="button" data-copy-access="identifier" data-billing-id="${item.id}">Copiar ID</button>
          </div>
          ${item.password
            ? `<div class="access-data">
                <span><small>Senha</small><strong>${escapeHtml(item.password)}</strong></span>
                <button type="button" data-copy-access="password" data-billing-id="${item.id}">Copiar senha</button>
              </div>`
            : `<span class="access-note">Senha exibida somente ao gerar o acesso.</span>`}`
        : "Acesso do cliente ainda não gerado."}</div>
      <div class="card-actions">
        <button class="table-action" data-view-report="${item.id}">Ver relatório</button>
        <button class="table-action whatsapp-action" data-share-whatsapp="${item.id}">WhatsApp</button>
        <button class="table-action" data-share-report="${item.id}">Compartilhar relatório</button>
        ${billingOpenAmount(item) > 0 && item.status !== "Cancelada" ? `<button class="table-action" data-pay-billing="${item.id}" data-payment-mode="partial">Pagar parcialmente</button><button class="table-action success" data-pay-billing="${item.id}" data-payment-mode="full">Quitar</button>` : ""}
        <button class="table-action" data-renew-access="${item.id}">Gerar novo acesso</button>
        ${item.identifier && accessBillingByClient.get(item.clientId) === item.id
          ? `<button class="table-action" data-toggle-history="${item.id}">${item.historyEnabled ? "Bloquear histórico" : "Liberar histórico"}</button>`
          : ""}
        ${billingCurrentStatus(item) === "Aberta" ? `<button class="table-action danger" data-cancel-billing="${item.id}">Cancelar</button>` : ""}
        <button class="table-action danger" data-delete-billing="${item.id}">Excluir</button>
      </div>
      </div>
    </article>`).join("") : emptyMarkup();
}

async function copyText(value, label) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const field = document.createElement("textarea");
    field.value = value;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    document.execCommand("copy");
    field.remove();
  }
  alert(`${label} copiado.`);
}

function render() {
  normalizeBillingRollovers();
  updateBillingStatuses();
  const serviceStartDate = document.getElementById("serviceStartDate");
  const serviceEndDate = document.getElementById("serviceEndDate");
  if (serviceStartDate && serviceEndDate && !serviceStartDate.value && !serviceEndDate.value) {
    const week = currentOperationalWeek();
    serviceStartDate.value = week.startDate;
    serviceEndDate.value = week.endDate;
  }
  ensureFinancePeriod();
  syncFinancePeriodControls();
  renderSelects();
  renderSystemSettings();
  renderDashboardV2();
  renderNotifications();
  renderClients();
  renderPriceTables();
  renderCatalog();
  renderServices();
  renderServiceRequests();
  renderPayments();
  renderPaymentMethods();
  renderBillings();
  window.supplierModule?.render();
}

function renderSystemSettings() {
  const startSelect = document.getElementById("weekStartDay");
  const endSelect = document.getElementById("weekEndDay");
  if (!startSelect || !endSelect) return;
  startSelect.value = String(systemSettings.weekStartDay ?? 0);
  endSelect.value = String(systemSettings.weekEndDay ?? 5);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[character]);
}

function setDefaultDates() {
  const today = new Date().toISOString().slice(0, 10);
  document.querySelectorAll('input[type="date"]').forEach((input) => {
    if (!input.value) input.value = today;
  });
}

function renderBillingPaymentMethods(targetId = "billingPaymentMethods") {
  const target = document.getElementById(targetId);
  const activeMethods = state.paymentMethods.filter((method) => method.active);
  target.innerHTML = activeMethods.length ? activeMethods.map((method) => `
    <label class="checkbox-label">
      <input type="checkbox" name="paymentMethodId" value="${method.id}" checked>
      ${escapeHtml(method.name)} (${escapeHtml(method.type)})
    </label>`).join("") : `<p class="meta">Cadastre uma forma de pagamento ativa.</p>`;
}

function updateSuggestedPrice() {
  const form = document.getElementById("serviceForm");
  const client = clientById(form.elements.clientId.value);
  const catalogItem = state.catalog.find((item) => item.id === form.elements.catalogId.value);
  const hint = document.getElementById("suggestedPrice");
  if (!client || !catalogItem) {
    hint.textContent = "Selecione o cliente e o serviço para preencher o valor.";
    return;
  }
  const suggested = Number(catalogItem.prices[client.priceGroup] || 0);
  form.elements.amount.value = suggested.toFixed(2);
  hint.textContent = `${client.priceGroup}: ${money.format(suggested)}. Você pode editar este valor sem alterar a tabela.`;
}

function renderReferenceList() {
  document.getElementById("referenceList").innerHTML = serviceReferenceValues.map((reference, index) => `
    <span class="reference-chip">
      ${escapeHtml(reference)}
      <button type="button" data-remove-reference="${index}" aria-label="Remover ${escapeHtml(reference)}">×</button>
    </span>`).join("");
}

function addCurrentReference() {
  const input = document.querySelector('#serviceForm textarea[name="reference"]');
  const references = input.value
    .split(/\r?\n/)
    .map((reference) => reference.trim().toUpperCase())
    .filter(Boolean);
  if (!references.length) return false;
  references.forEach((reference) => {
    if (!serviceReferenceValues.includes(reference)) serviceReferenceValues.push(reference);
  });
  input.value = "";
  renderReferenceList();
  input.focus();
  return true;
}

function normalizeServiceReference(reference) {
  return String(reference || "").trim().replace(/\s+/g, " ").toUpperCase();
}

function historicalReferenceMatches({ entryId, references }) {
  const referenceSet = new Set(references.map(normalizeServiceReference).filter(Boolean));
  if (!referenceSet.size) return [];
  const currentEntry = state.services.find((item) => item.id === entryId);
  return state.services
    .filter((item) =>
      item.id !== entryId
      && (!currentEntry?.serviceGroupId || item.serviceGroupId !== currentEntry.serviceGroupId)
      && referenceSet.has(normalizeServiceReference(item.reference))
    )
    .sort((a, b) =>
      String(b.date || "").localeCompare(String(a.date || ""))
      || String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
    );
}

function historicalReferenceDialogMarkup(matches) {
  return matches.map((item) => {
    const client = clientById(item.clientId);
    return `<article class="reference-history-item">
      <div class="reference-history-item-heading">
        <strong>${escapeHtml(item.reference || "Sem referência")}</strong>
        <span>${escapeHtml(serviceStatusLabel(item.status))}</span>
      </div>
      <h3>${escapeHtml(item.description || "Serviço não informado")}</h3>
      <dl>
        <div><dt>Data</dt><dd>${escapeHtml(formatDate(item.date))}</dd></div>
        <div><dt>Cliente</dt><dd>${escapeHtml(client?.name || "Não informado")}</dd></div>
      </dl>
    </article>`;
  }).join("\n");
}

function settleReferenceHistoryDialog(confirmed) {
  const resolver = referenceHistoryResolver;
  referenceHistoryResolver = null;
  const dialog = document.getElementById("referenceHistoryDialog");
  if (dialog.open) dialog.close();
  if (resolver) resolver(confirmed);
}

function confirmHistoricalReferenceReuse(matches) {
  const references = new Set(matches.map((item) => normalizeServiceReference(item.reference)));
  document.getElementById("referenceHistorySummary").innerHTML = `
    <strong>${references.size} referência(s) encontrada(s)</strong>
    <span>${matches.length} lançamento(s) no histórico</span>`;
  document.getElementById("referenceHistoryList").innerHTML = historicalReferenceDialogMarkup(matches);
  const dialog = document.getElementById("referenceHistoryDialog");
  return new Promise((resolve) => {
    referenceHistoryResolver = resolve;
    dialog.showModal();
    setTimeout(() => document.getElementById("referenceHistoryCancel").focus(), 0);
  });
}

function renderAdditionalServiceList() {
  document.getElementById("additionalServiceList").innerHTML = additionalServiceValues.map((service, index) => `
    <div class="additional-service-item">
      <span>${escapeHtml(catalogOptionLabel(state.catalog.find((item) => item.id === service.catalogId)))}</span>
      <strong>${money.format(service.amount)}</strong>
      <button type="button" data-remove-additional-service="${index}" aria-label="Remover serviço complementar">×</button>
    </div>`).join("");
}

function syncAdditionalCatalogSelection() {
  const form = document.getElementById("serviceForm");
  const catalogItem = itemByExactLabel(
    state.catalog,
    form.elements.additionalCatalogSearch.value,
    catalogOptionLabel
  );
  form.elements.additionalCatalogId.value = catalogItem?.id || "";
  const client = clientById(form.elements.clientId.value);
  const suggested = client && catalogItem
    ? Number(catalogItem.prices[client.priceGroup] || 0)
    : 0;
  form.elements.additionalAmount.value = catalogItem ? suggested.toFixed(2) : "";
  document.getElementById("additionalSuggestedPrice").textContent = catalogItem && client
    ? `${client.priceGroup}: ${money.format(suggested)}. Você pode editar este valor.`
    : "Escolha um serviço complementar.";
}

function addAdditionalService() {
  const form = document.getElementById("serviceForm");
  syncAdditionalCatalogSelection();
  const catalogId = form.elements.additionalCatalogId.value;
  const amount = Number(form.elements.additionalAmount.value);
  if (!catalogId) {
    alert("Selecione um serviço complementar válido.");
    form.elements.additionalCatalogSearch.focus();
    return false;
  }
  if (catalogId === form.elements.catalogId.value) {
    alert("O serviço complementar deve ser diferente do serviço principal.");
    return false;
  }
  if (additionalServiceValues.some((item) => item.catalogId === catalogId)) {
    alert("Este serviço complementar já foi adicionado.");
    return false;
  }
  additionalServiceValues.push({ catalogId, amount });
  form.elements.additionalCatalogId.value = "";
  form.elements.additionalCatalogSearch.value = "";
  form.elements.additionalAmount.value = "";
  document.getElementById("additionalSuggestedPrice").textContent = "Escolha outro serviço complementar ou salve o lançamento.";
  renderAdditionalServiceList();
  form.elements.additionalCatalogSearch.focus();
  return true;
}

function toggleAdditionalServices() {
  const form = document.getElementById("serviceForm");
  const enabled = form.elements.hasAdditionalServices.checked;
  document.getElementById("additionalServicesSection").classList.toggle("hidden", !enabled);
  if (!enabled) {
    additionalServiceValues = [];
    form.elements.additionalCatalogId.value = "";
    form.elements.additionalCatalogSearch.value = "";
    form.elements.additionalAmount.value = "";
    renderAdditionalServiceList();
  }
}

function syncServiceClientSelection() {
  const form = document.getElementById("serviceForm");
  const previousClientId = form.elements.clientId.value;
  const client = itemByExactLabel(state.clients, form.elements.clientSearch.value, clientOptionLabel);
  form.elements.clientId.value = client?.id || "";
  if (form.elements.clientId.value !== previousClientId) updateSuggestedPrice();
}

function setServiceCatalogError(message = "") {
  const form = document.getElementById("serviceForm");
  const field = form.elements.catalogSearch;
  const error = document.getElementById("serviceCatalogError");
  const invalid = Boolean(message);
  field.setCustomValidity(message);
  field.setAttribute("aria-invalid", String(invalid));
  document.getElementById("serviceCatalogField").classList.toggle("field-invalid", invalid);
  error.textContent = message;
  error.classList.toggle("hidden", !invalid);
}

function syncServiceCatalogSelection() {
  const form = document.getElementById("serviceForm");
  const previousCatalogId = form.elements.catalogId.value;
  const catalogItem = itemByExactLabel(state.catalog, form.elements.catalogSearch.value, catalogOptionLabel);
  form.elements.catalogId.value = catalogItem?.id || "";
  if (catalogItem) setServiceCatalogError();
  if (form.elements.catalogId.value !== previousCatalogId) updateSuggestedPrice();
}

function syncServiceClientFilter() {
  const searchInput = document.getElementById("serviceClientNameFilter");
  const client = uniqueClientMatch(searchInput.value);
  document.getElementById("serviceClientFilter").value = client?.id || "";
  renderServices();
}

function syncTrackingClientSelection() {
  const form = document.getElementById("trackingForm");
  const client = itemByExactLabel(state.clients, form.elements.clientSearch.value, clientOptionLabel)
    || uniqueClientMatch(form.elements.clientSearch.value);
  form.elements.clientId.value = client?.id || "";
}

function openTrackingForm() {
  const form = document.getElementById("trackingForm");
  form.reset();
  const preferredClient = uniqueClientMatch(document.getElementById("serviceClientNameFilter").value);
  form.elements.clientId.value = preferredClient?.id || "";
  form.elements.clientSearch.value = clientOptionLabel(preferredClient);
  const week = currentOperationalWeek();
  form.elements.startDate.value = week.startDate;
  form.elements.endDate.value = week.endDate;
  form.elements.validDays.value = "30";
  document.getElementById("trackingDialog").showModal();
  setTimeout(() => (preferredClient ? form.elements.startDate : form.elements.clientSearch).focus(), 0);
}

function renderCatalogPriceFields(item = null) {
  document.getElementById("catalogPriceFields").innerHTML = state.priceTables.map((name) => `
    <label>${escapeHtml(name)}
      <input type="number" min="0" step="0.01" required data-price-table="${escapeHtml(name)}" value="${item ? Number(item.prices[name] || 0).toFixed(2) : ""}">
    </label>`).join("");
}

function openClientForm(client = null) {
  const form = document.getElementById("clientForm");
  form.reset();
  form.elements.clientId.value = client?.id || "";
  form.elements.name.value = client?.name || "";
  form.elements.phone.value = client?.phone || "";
  form.elements.priceGroup.value = client?.priceGroup || "";
  document.getElementById("clientDialogTitle").textContent = client ? "Editar cliente" : "Novo cliente";
  document.getElementById("clientDialog").showModal();
}

function openCatalogForm(item = null) {
  const form = document.getElementById("catalogForm");
  form.reset();
  form.elements.catalogId.value = item?.id || "";
  form.elements.code.value = item?.code || "";
  form.elements.name.value = item?.name || "";
  renderCatalogPriceFields(item);
  document.getElementById("catalogDialogTitle").textContent = item ? "Editar serviço" : "Novo serviço";
  document.getElementById("catalogDialog").showModal();
}

function cancellationGroup(entry) {
  if (!entry?.serviceGroupId) return [entry].filter(Boolean);
  return state.services.filter((item) =>
    item.serviceGroupId === entry.serviceGroupId
    && item.reference === entry.reference
  );
}

function applyServiceStatus(entry, status, changedAt = new Date().toISOString()) {
  const targets = entry.isSecondary ? [entry] : cancellationGroup(entry).filter((item) => item.status !== "Cancelado");
  targets.forEach((item) => {
    item.status = status;
    if (item.status === "Pronto" && !item.deliveryCode) item.deliveryCode = randomDeliveryCode();
    if (item.status === "Entregue") {
      item.deliveredAt = changedAt;
      item.deliverySource = adminDisplayName();
    } else {
      item.deliveredAt = null;
      item.deliverySource = "";
    }
    item.updatedAt = changedAt;
  });
}

function openServiceCancellation(entry) {
  if (!entry) return;
  if (entry.billingId) {
    alert("Este serviço já está em uma cobrança. Cancele a cobrança primeiro para alterar o lançamento.");
    return;
  }
  const form = document.getElementById("cancelServiceForm");
  form.reset();
  form.elements.entryId.value = entry.id;
  const group = cancellationGroup(entry);
  const complementary = group.filter((item) => item.id !== entry.id && item.isSecondary && item.status !== "Cancelado");
  const linkedEntryIds = new Set(group.map((item) => item.id));
  const supplierEntries = state.supplierEntries.filter((item) =>
    linkedEntryIds.has(item.clientServiceEntryId)
    && item.status !== "Cancelado"
    && !item.payableId
  );
  document.getElementById("cancelServiceDescription").textContent =
    `${entry.description} · ${entry.reference || "Sem referência"} · ${clientById(entry.clientId)?.name || ""}`;
  document.getElementById("cancelComplementaryOption").classList.toggle("hidden", !complementary.length || entry.isSecondary);
  document.getElementById("cancelSupplierOption").classList.toggle("hidden", !supplierEntries.length);
  document.getElementById("cancelServiceDialog").showModal();
  setTimeout(() => form.elements.reason.focus(), 0);
}

function openEntryForm(item = null, preferredClientId = "", request = null) {
  const form = document.getElementById("serviceForm");
  form.reset();
  setServiceCatalogError();
  serviceReferenceValues = [];
  additionalServiceValues = [];
  form.elements.entryId.value = item?.id || "";
  form.elements.sourceRequestId.value = request?.id || "";
  form.elements.clientId.value = request?.clientId || item?.clientId || preferredClientId || "";
  form.elements.clientSearch.value = clientOptionLabel(clientById(form.elements.clientId.value));
  form.elements.date.value = request?.requestedDate || item?.date || new Date().toISOString().slice(0, 10);
  form.elements.catalogId.value = request?.catalogId || item?.catalogId || "";
  form.elements.catalogSearch.value = catalogOptionLabel(
    state.catalog.find((catalogItem) => catalogItem.id === form.elements.catalogId.value)
  );
  form.elements.reference.value = request?.references?.length ? request.references.join("\n") : item?.reference || "";
  form.elements.amount.value = request ? Number(request.amount || 0).toFixed(2) : item ? Number(item.amount).toFixed(2) : "";
  form.elements.status.value = item?.status || "A fazer";
  form.elements.hasAdditionalServices.checked = false;
  form.elements.hasAdditionalServices.disabled = Boolean(item);
  document.getElementById("additionalServicesSection").classList.add("hidden");
  const importHint = document.getElementById("serviceImportHint");
  importHint.classList.toggle("hidden", !request);
  importHint.innerHTML = request ? `
    <strong>Pedido importado do cliente</strong>
    <span>${escapeHtml(request.references?.length || 0)} referência(s) · Solicitante: ${escapeHtml(request.requestedBy || "Não informado")}</span>
    ${request.notes ? `<small>${escapeHtml(request.notes)}</small>` : ""}` : "";
  window.supplierModule?.resetClientEntryOptions(Boolean(item));
  document.getElementById("serviceDialogTitle").textContent = item ? "Editar lançamento" : request ? "Importar pedido" : "Novo lançamento";
  document.getElementById("suggestedPrice").textContent = item
    ? "O valor pode ser alterado somente neste lançamento."
    : request ? "Valor sugerido pelo pedido. Você pode ajustar antes de salvar." : "Selecione o cliente e o serviço para preencher o valor.";
  renderReferenceList();
  renderAdditionalServiceList();
  document.getElementById("serviceDialog").showModal();
  setTimeout(() => form.elements.clientSearch.focus(), 0);
}

function importClientRequest(requestId) {
  const request = (state.serviceRequests || []).find((item) => item.id === requestId);
  if (!request || request.status !== "Novo") {
    alert("Este pedido não está mais disponível para importação.");
    return;
  }
  showView("services");
  openEntryForm(null, request.clientId, request);
}

function choosePendingRequestForForm() {
  const form = document.getElementById("serviceForm");
  syncServiceClientSelection();
  const clientId = form.elements.clientId.value;
  const requests = (state.serviceRequests || []).filter((item) =>
    item.status === "Novo" && (!clientId || item.clientId === clientId)
  );
  if (!requests.length) {
    alert(clientId ? "Não há pedidos pendentes para este cliente." : "Não há pedidos pendentes.");
    return;
  }
  if (requests.length === 1) {
    importClientRequest(requests[0].id);
    return;
  }
  const options = requests.slice(0, 9).map((request, index) =>
    `${index + 1}) ${clientById(request.clientId)?.name || "Cliente"} - ${request.serviceName} - ${(request.references || []).join(", ")}`
  ).join("\n");
  const selected = Number(prompt(`Qual pedido deseja importar?\n\n${options}`));
  if (!selected || !requests[selected - 1]) return;
  importClientRequest(requests[selected - 1].id);
}

function openPaymentForm(item = null, billing = null, mode = "partial") {
  const form = document.getElementById("paymentForm");
  form.reset();
  form.elements.paymentId.value = item?.id || "";
  form.elements.billingId.value = item?.billingId || billing?.id || "";
  form.elements.clientId.value = item?.clientId || billing?.clientId || "";
  form.elements.date.value = item?.date || new Date().toISOString().slice(0, 10);
  form.elements.amount.value = item
    ? Number(item.amount).toFixed(2)
    : billing && mode === "full" ? billingOpenAmount(billing).toFixed(2) : "";
  form.elements.method.value = item?.method || "";
  form.elements.note.value = item?.note || "";
  const hint = document.getElementById("paymentBillingHint");
  if (billing) {
    hint.textContent = `Cobrança de ${formatDate(billing.startDate)} a ${formatDate(billing.endDate)}. Saldo atual: ${money.format(billingOpenAmount(billing))}.`;
    hint.classList.remove("hidden");
  } else {
    hint.textContent = "";
    hint.classList.add("hidden");
  }
  document.getElementById("paymentDialogTitle").textContent = item ? "Editar pagamento" : "Registrar pagamento";
  document.getElementById("paymentDialog").showModal();
}

function openPaymentMethodForm(method = null) {
  const form = document.getElementById("paymentMethodForm");
  form.reset();
  form.elements.methodId.value = method?.id || "";
  form.elements.type.value = method?.type || "PIX";
  form.elements.name.value = method?.name || "";
  form.elements.details.value = method?.details || "";
  form.elements.link.value = method?.link || "";
  form.elements.active.checked = method?.active ?? true;
  document.getElementById("paymentMethodDialogTitle").textContent = method ? "Editar forma de pagamento" : "Nova forma de pagamento";
  document.getElementById("paymentMethodDialog").showModal();
}

function billingDetails(billing) {
  const services = state.services.filter((item) =>
    item.billingId === billing.id || (
      !item.billingId && item.clientId === billing.clientId
      && item.date >= billing.startDate && item.date <= billing.endDate
    ));
  const payments = state.payments.filter((item) =>
    item.billingId === billing.id || (
      !item.billingId && item.clientId === billing.clientId
      && item.date >= billing.startDate && item.date <= billing.endDate
    ));
  const serviceTotal = billing.servicesTotal ?? services.reduce((sum, item) => sum + item.amount, 0);
  const paymentTotal = billing.paymentsTotal ?? payments.reduce((sum, item) => sum + item.amount, 0);
  const previousBalance = billing.previousBalance ?? billing.amount - serviceTotal + paymentTotal;
  return { services, payments, serviceTotal, paymentTotal, previousBalance };
}

function pdfSafeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function billingReportFileName(billing) {
  const client = clientById(billing.clientId);
  const name = String(client?.name || "cliente")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `relatorio-${name || "cliente"}-${billing.endDate}.pdf`;
}

function createBillingReportPdf(billing) {
  const client = clientById(billing.clientId);
  const details = billingDetails(billing);
  const laterPayments = state.payments.filter((payment) => paymentWasAfterBilling(payment, billing));
  const selectedMethodIds = billing.paymentMethodIds || [];
  const methods = billing.paymentMethods?.length
    ? billing.paymentMethods
    : state.paymentMethods.filter((method) =>
      selectedMethodIds.length ? selectedMethodIds.includes(method.id) : method.active);
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 42;
  const pages = [];
  let commands = [];
  let y = 800;
  const colors = {
    green: "0.086 0.31 0.263",
    blue: "0.176 0.447 0.769",
    payment: "0.094 0.525 0.294",
    orange: "0.812 0.424 0.071",
    gray: "0.455 0.506 0.49",
    dark: "0.12 0.18 0.16"
  };

  function addPage() {
    if (commands.length) pages.push(commands.join("\n"));
    commands = [
      `${colors.green} rg 0 790 ${pageWidth} 52 re f`,
      "1 1 1 rg BT /F2 17 Tf 42 812 Td (Gestor de Servicos) Tj ET"
    ];
    y = 766;
  }

  function text(value, x, size = 10, color = colors.dark, bold = false) {
    commands.push(`${color} rg BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${pdfSafeText(value)}) Tj ET`);
  }

  function line() {
    commands.push(`0.86 0.86 0.83 RG ${margin} ${y - 7} m ${pageWidth - margin} ${y - 7} l S`);
  }

  function ensureSpace(height = 28) {
    if (y - height < 44) addPage();
  }

  function heading(value) {
    ensureSpace(38);
    y -= 12;
    text(value, margin, 13, colors.green, true);
    y -= 12;
    line();
    y -= 18;
  }

  addPage();
  text("Relatorio de cobranca", margin, 9, colors.gray, true);
  y -= 25;
  text(client?.name || "Cliente", margin, 22, colors.dark, true);
  y -= 19;
  text(
    `Periodo: ${billing.startDate.split("-").reverse().join("/")} a ${billing.endDate.split("-").reverse().join("/")}`,
    margin,
    10,
    colors.gray
  );
  y -= 34;

  const cards = [
    ["Saldo anterior", details.previousBalance, colors.gray],
    ["Servicos", details.serviceTotal, colors.blue],
    ["Pagamentos", details.paymentTotal, colors.payment],
    ["Total em aberto", billingOpenAmount(billing), colors.orange]
  ];
  cards.forEach(([label, amount, color], index) => {
    const x = margin + index * 128;
    commands.push(`${color} rg ${x} ${y - 36} 116 58 re f`);
    commands.push(`1 1 1 rg BT /F1 8 Tf ${x + 9} ${y + 5} Td (${pdfSafeText(label)}) Tj ET`);
    commands.push(`1 1 1 rg BT /F2 12 Tf ${x + 9} ${y - 17} Td (${pdfSafeText(money.format(Number(amount)))}) Tj ET`);
  });
  y -= 72;

  heading("Servicos do periodo");
  if (!details.services.length) {
    text("Nenhum servico neste fechamento.", margin);
    y -= 22;
  } else {
    const columnWidth = 510;
    ensureSpace(28);
    commands.push(`0.91 0.94 0.93 rg ${margin} ${y - 15} ${columnWidth} 22 re f`);
    commands.push(`${colors.dark} rg BT /F2 7 Tf ${margin + 6} ${y - 2} Td (Data) Tj ET`);
    commands.push(`${colors.dark} rg BT /F2 7 Tf ${margin + 70} ${y - 2} Td (Servico) Tj ET`);
    commands.push(`${colors.dark} rg BT /F2 7 Tf ${margin + 360} ${y - 2} Td (Referencia) Tj ET`);
    commands.push(`${colors.dark} rg BT /F2 7 Tf ${margin + 455} ${y - 2} Td (Valor) Tj ET`);
    y -= 27;
    for (const item of details.services) {
      ensureSpace(27);
      const rowY = y;
      const description = String(item.description || "").slice(0, 55);
      const reference = String(item.reference || "-").slice(0, 18);
      commands.push(`0.97 0.98 0.97 rg ${margin} ${rowY - 16} ${columnWidth} 23 re f`);
      commands.push(`${colors.gray} rg BT /F1 6.5 Tf ${margin + 5} ${rowY - 3} Td (${pdfSafeText(item.date.split("-").reverse().join("/"))}) Tj ET`);
      commands.push(`${colors.dark} rg BT /F1 7 Tf ${margin + 70} ${rowY - 3} Td (${pdfSafeText(description)}) Tj ET`);
      commands.push(`${colors.gray} rg BT /F1 6.5 Tf ${margin + 360} ${rowY - 3} Td (${pdfSafeText(reference)}) Tj ET`);
      commands.push(`${colors.blue} rg BT /F2 7 Tf ${margin + 447} ${rowY - 3} Td (${pdfSafeText(money.format(Number(item.amount)))}) Tj ET`);
      y -= 27;
    }
  }

  heading("Pagamentos");
  const reportPayments = [...details.payments, ...laterPayments.filter((payment) =>
    !details.payments.some((item) => item.id === payment.id))];
  if (!reportPayments.length) {
    text("Nenhum pagamento registrado.", margin);
    y -= 22;
  } else {
    reportPayments.forEach((item) => {
      ensureSpace(32);
      text(item.date.split("-").reverse().join("/"), margin, 9, colors.gray);
      text(item.method || item.note || "-", 145, 9, colors.dark);
      text(money.format(Number(item.amount)), 462, 9, colors.payment, true);
      y -= 17;
      line();
      y -= 8;
    });
  }

  heading("Formas de pagamento");
  if (!methods.length) {
    text("Consulte as formas de pagamento com o responsavel.", margin);
  } else {
    methods.forEach((method) => {
      ensureSpace(44);
      text(`${method.name} (${method.type})`, margin, 10, colors.green, true);
      y -= 15;
      text(method.details || method.link || "-", margin, 9, colors.dark);
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

function downloadBillingReport(billing, blob = createBillingReportPdf(billing)) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = billingReportFileName(billing);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function shareBillingReport(billing) {
  const client = clientById(billing.clientId);
  const blob = createBillingReportPdf(billing);
  const file = new File([blob], billingReportFileName(billing), { type: "application/pdf" });
  const shareData = {
    title: `Relatorio de cobranca - ${client?.name || "Cliente"}`,
    text: `Segue o relatorio de cobranca de ${billing.startDate.split("-").reverse().join("/")} a ${billing.endDate.split("-").reverse().join("/")}.`,
    files: [file]
  };

  const supportsFileShare = typeof navigator.share === "function"
    && typeof navigator.canShare === "function"
    && navigator.canShare({ files: [file] });
  if (supportsFileShare) {
    try {
      await navigator.share(shareData);
      return "PDF compartilhado";
    } catch (error) {
      if (error?.name === "AbortError") return "";
    }
  }

  downloadBillingReport(billing, blob);
  alert(
    "Este navegador não permite anexar o PDF automaticamente.\n\n"
    + "O relatório foi baixado. Abra o WhatsApp e anexe o arquivo PDF salvo."
  );
  return "PDF salvo";
}

function whatsappBillingMessage(billing, automaticAccessUrl) {
  const client = clientById(billing.clientId);
  const selectedMethodIds = billing.paymentMethodIds || [];
  const billingMethods = billing.paymentMethods?.length
    ? billing.paymentMethods
    : state.paymentMethods.filter((method) =>
      selectedMethodIds.length ? selectedMethodIds.includes(method.id) : method.active);
  const methods = billingMethods.length
    ? billingMethods
      .map((method) => `${method.name}: ${method.details || method.link || "Consulte as instruções no relatório"}`)
      .join("\n")
    : "Consulte as formas de pagamento no relatório.";
  return `Olá, ${client?.name || ""}!\n\nSua cobrança de ${formatDate(billing.startDate)} a ${formatDate(billing.endDate)} foi gerada.\n\nTotal em aberto: ${money.format(billingOpenAmount(billing))}\n\nFormas de pagamento:\n${methods}\n\nAcesse sua cobrança sem precisar digitar senha:\n${automaticAccessUrl}`;
}

async function issueClientMagicLink(billing) {
  const { data } = await window.supabaseClient.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Sua sessão administrativa expirou.");
  const response = await fetch("/.netlify/functions/issue-client-magic-link", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({ clientId: billing.clientId, billingId: billing.id })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Não foi possível gerar o link automático.");
  return `${location.origin}/cliente.html?access=${encodeURIComponent(result.accessCode)}`;
}

async function shareBillingByWhatsApp(billing) {
  const client = clientById(billing.clientId);
  const phone = whatsappPhone(client);
  const automaticAccessUrl = await issueClientMagicLink(billing);
  const text = whatsappBillingMessage(billing, automaticAccessUrl);
  const query = `${phone ? `phone=${phone}&` : ""}text=${encodeURIComponent(text)}`;
  const link = document.createElement("a");
  link.href = `https://api.whatsapp.com/send?${query}`;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
  return "WhatsApp";
}

function openBillingReport(billingId) {
  const billing = state.billings.find((item) => item.id === billingId);
  const client = clientById(billing.clientId);
  const details = billingDetails(billing);
  const maxValue = Math.max(details.serviceTotal, details.paymentTotal, Math.abs(details.previousBalance), 1);
  const selectedMethodIds = billing.paymentMethodIds || [];
  const methods = billing.paymentMethods?.length
    ? billing.paymentMethods
    : state.paymentMethods.filter((method) =>
      selectedMethodIds.length ? selectedMethodIds.includes(method.id) : method.active);
  const laterPayments = state.payments.filter((payment) => paymentWasAfterBilling(payment, billing));
  function serviceTable(items) {
    const rows = items.map((item) => `<tr>
      <td>${item.date.split("-").reverse().join("/")}</td>
      <td title="${escapeHtml(item.description)}">${escapeHtml(item.description)}</td>
      <td title="${escapeHtml(item.reference || "-")}">${escapeHtml(item.reference || "-")}</td>
      <td>${money.format(item.amount)}</td>
    </tr>`).join("");
    return `<table class="report-service-table">
      <thead><tr><th>Data</th><th>Serviço</th><th>Ref</th><th>Valor</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="4">-</td></tr>`}</tbody>
    </table>`;
  }
  const serviceRows = details.services.length
    ? serviceTable(details.services)
    : `<p class="meta">Nenhum serviço neste período.</p>`;
  const methodRows = methods.length ? methods.map((method) => `
    <div class="payment-option">
      <strong>${escapeHtml(method.name)} (${escapeHtml(method.type)})</strong>
      <span>${escapeHtml(method.details || "")}</span>
      ${method.link ? `<br><a href="${escapeHtml(method.link)}" target="_blank">Abrir link de pagamento</a>` : ""}
    </div>`).join("") : `<p class="meta">Nenhuma forma de pagamento ativa.</p>`;

  document.getElementById("reportContent").innerHTML = `<section class="report">
    <div class="report-actions">
      <button class="primary" data-print-report>Imprimir / Salvar PDF</button>
      <button class="secondary whatsapp-action" data-share-whatsapp="${billing.id}">WhatsApp</button>
      <button class="secondary" data-share-report="${billing.id}">Compartilhar relatório</button>
      <button class="secondary" data-close-report>Cancelar</button>
      <button class="icon-button" data-close-report>×</button>
    </div>
    <header class="report-header">
      <div><span class="eyebrow">Relatório de cobrança</span><h2>${escapeHtml(client?.name || "")}</h2><p class="meta">${billing.startDate.split("-").reverse().join("/")} a ${billing.endDate.split("-").reverse().join("/")}</p></div>
      <div><span class="meta">${billingCurrentStatus(billing)}</span><strong class="hero-value" style="font-size:36px">${money.format(billingOpenAmount(billing))}</strong></div>
    </header>
    <div class="report-summary">
      <article><span class="meta">Saldo anterior</span><strong>${money.format(details.previousBalance)}</strong></article>
      <article><span class="meta">Serviços</span><strong>${money.format(details.serviceTotal)}</strong></article>
      <article><span class="meta">Pagamentos</span><strong>${money.format(details.paymentTotal)}</strong></article>
      <article><span class="meta">Baixas após cobrança</span><strong>${money.format(laterPayments.reduce((sum, item) => sum + Number(item.amount), 0))}</strong></article>
    </div>
    <h3>Resumo gráfico</h3>
    <div class="chart">
      <div class="chart-row"><span>Saldo anterior</span><div class="chart-track"><div class="chart-bar" style="width:${Math.abs(details.previousBalance) / maxValue * 100}%"></div></div><strong>${money.format(details.previousBalance)}</strong></div>
      <div class="chart-row"><span>Serviços</span><div class="chart-track"><div class="chart-bar" style="width:${details.serviceTotal / maxValue * 100}%"></div></div><strong>${money.format(details.serviceTotal)}</strong></div>
      <div class="chart-row"><span>Pagamentos</span><div class="chart-track"><div class="chart-bar credit" style="width:${details.paymentTotal / maxValue * 100}%"></div></div><strong>${money.format(details.paymentTotal)}</strong></div>
    </div>
    <h3>Serviços do período</h3>
    <div class="report-service-grid">${serviceRows}</div>
    <h3>Formas de pagamento</h3>
    <div class="payment-options">${methodRows}</div>
  </section>`;
  document.getElementById("reportDialog").showModal();
}

function whatsappPhone(client) {
  const digits = String(client?.phone || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
}

async function issueClientAccess(billing) {
  const { data } = await window.supabaseClient.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Sua sessão administrativa expirou.");

  const response = await fetch("/.netlify/functions/issue-client-access", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      clientId: billing.clientId,
      billingId: billing.id,
      historyEnabled: Boolean(billing.historyEnabled)
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Não foi possível gerar o acesso do cliente.");
  return result;
}

async function updateClientHistoryAccess(billing, enabled) {
  const { data } = await window.supabaseClient.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Sua sessão administrativa expirou.");

  const response = await fetch("/.netlify/functions/update-client-history-access", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      clientId: billing.clientId,
      billingId: billing.id,
      enabled
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Não foi possível alterar o acesso ao histórico.");
  return result;
}

async function cancelClientAccess(billing) {
  const { data } = await window.supabaseClient.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Sua sessão administrativa expirou.");

  const response = await fetch("/.netlify/functions/cancel-client-access", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ billingId: billing.id })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) {
    throw new Error(result.error || "Não foi possível cancelar o acesso do cliente.");
  }
  return result;
}

function apiBrasilQrCode(result) {
  const candidate = result?.qrcode
    || result?.qrCode
    || result?.data?.qrcode
    || result?.data?.qrCode
    || "";
  if (typeof candidate !== "string" || !candidate.trim()) return "";
  if (/^data:image\//i.test(candidate) || /^https?:\/\//i.test(candidate)) return candidate;
  return `data:image/png;base64,${candidate.replace(/\s/g, "")}`;
}

async function startApiBrasilWhatsApp({ number, forceClearCache }) {
  const { data } = await window.supabaseClient.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Sua sessão administrativa expirou.");

  const response = await fetch("/.netlify/functions/apibrasil-whatsapp-start-background", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      qrcode: true,
      number: number || undefined,
      forceClearCache
    })
  });
  const result = await response.json().catch(() => ({ accepted: response.ok }));
  if (!response.ok) throw new Error(result.error || "Não foi possível iniciar o WhatsApp.");
  return result;
}

async function apiBrasilWhatsAppStatus() {
  const { data } = await window.supabaseClient.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Sua sessão administrativa expirou.");
  const response = await fetch("/.netlify/functions/apibrasil-whatsapp-status", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Não foi possível consultar o WhatsApp.");
  return result;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function pollApiBrasilWhatsApp(onUpdate) {
  const terminalStatuses = new Set([
    "inChat", "isLogged", "qrReadSuccess", "autocloseCalled", "browserClose",
    "desconnectedMobile", "phoneNotConnected", "qrReadError", "qrReadFail",
    "serverClose", "APIBRASIL_TIMEOUT", "APIBRASIL_NETWORK_ERROR", "error"
  ]);
  for (let attempt = 0; attempt < 45; attempt += 1) {
    await wait(3000);
    const result = await apiBrasilWhatsAppStatus();
    onUpdate(result);
    const isErrorStatus = /^(HTTP_\d+|APIBRASIL_|error$)/i.test(result.status || "");
    if (result.qr_code || terminalStatuses.has(result.status) || isErrorStatus) {
      if (isErrorStatus) {
        throw new Error(result.message || `A APIBrasil retornou ${result.status}.`);
      }
      return result;
    }
  }
  throw new Error("A APIBrasil ainda está processando. Aguarde um pouco e tente consultar novamente.");
}

document.addEventListener("click", async (event) => {
  const tab = event.target.closest("[data-view]");
  const clientTab = event.target.closest("[data-client-view]");
  const opener = event.target.closest("[data-open-view]");
  const dialogButton = event.target.closest("[data-dialog]");
  const dashboardTab = event.target.closest("[data-dashboard-tab]");
  const dashboardPeriodButton = event.target.closest("[data-dashboard-period]");
  const dashboardMonthButton = event.target.closest("[data-dashboard-month]");
  const soundAlertButton = event.target.closest("#soundAlertButton, #settingsSoundShortcut");
  const clientServiceScrollButton = event.target.closest("[data-scroll-client-services]");
  const retryRemoteLoadButton = event.target.closest("[data-retry-remote-load]");
  const closeRemoteLoadButton = event.target.closest("[data-close-remote-load]");
  if (retryRemoteLoadButton) {
    await initializeRemoteState(true);
    return;
  }
  if (closeRemoteLoadButton) {
    closeRemoteLoadError();
    return;
  }
  if (soundAlertButton) {
    soundAlertsEnabled = !soundAlertsEnabled;
    localStorage.setItem(SOUND_ALERTS_KEY, String(soundAlertsEnabled));
    if (soundAlertsEnabled) {
      await enableAlertAudio().catch(() => {});
      notifyAttention();
      showToast("Alertas sonoros ativados neste aparelho.");
    } else {
      showToast("Alertas sonoros desativados neste aparelho.");
    }
    updateSoundAlertButton();
    return;
  }
  if (clientServiceScrollButton) {
    const target = document.getElementById(clientServiceScrollButton.dataset.scrollClientServices);
    document.querySelectorAll("[data-scroll-client-services]").forEach((button) => {
      button.classList.toggle("active", button.dataset.scrollClientServices === clientServiceScrollButton.dataset.scrollClientServices);
    });
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  if (dashboardTab) {
    activeDashboardTab = dashboardTab.dataset.dashboardTab;
    renderDashboardV2();
  }
  if (clientTab) {
    showView(clientTab.dataset.clientView);
    return;
  }
  if (dashboardPeriodButton) {
    dashboardPeriod = dashboardPeriodButton.dataset.dashboardPeriod === "week"
      ? currentOperationalWeek()
      : monthPeriod();
    document.querySelectorAll("[data-dashboard-period]").forEach((button) => {
      button.classList.toggle("active", button === dashboardPeriodButton);
    });
    renderDashboardV2();
  }
  if (dashboardMonthButton) {
    const reference = new Date(`${dashboardPeriod?.startDate || localDateKey(new Date())}T12:00:00`);
    reference.setDate(1);
    reference.setMonth(reference.getMonth() + Number(dashboardMonthButton.dataset.dashboardMonth));
    dashboardPeriod = monthPeriod(reference);
    document.querySelectorAll("[data-dashboard-period]").forEach((button) => {
      button.classList.toggle("active", button.dataset.dashboardPeriod === "month");
    });
    renderDashboardV2();
  }
  if (tab) showView(tab.dataset.view);
  if (opener) showView(opener.dataset.openView);
  const paymentDashboardFilter = event.target.closest("[data-payment-dashboard-filter]");
  const importRequestButton = event.target.closest("[data-import-client-request]");
  const cancelRequestButton = event.target.closest("[data-cancel-client-request]");
  const deleteRequestButton = event.target.closest("[data-delete-client-request]");
  const importRequestFromDialog = event.target.closest("[data-import-request-button]");
  if (importRequestButton) {
    importClientRequest(importRequestButton.dataset.importClientRequest);
    return;
  }
  if (deleteRequestButton) {
    const requestId = deleteRequestButton.dataset.deleteClientRequest;
    if (confirm("Excluir este pedido do historico?")) {
      state.serviceRequests = (state.serviceRequests || []).filter((item) => item.id !== requestId);
      try {
        const result = await window.dataStore?.deleteClientServiceRequest?.(requestId);
        if (result?.error) throw result.error;
      } catch (error) {
        console.error(error);
        alert("O pedido saiu desta tela, mas nao foi possivel excluir no banco agora.");
      }
      saveState();
    }
    return;
  }
  if (cancelRequestButton) {
    const request = (state.serviceRequests || []).find((item) => item.id === cancelRequestButton.dataset.cancelClientRequest);
    if (request && confirm("Cancelar este pedido recebido do cliente?")) {
      request.status = "Cancelado";
      request.updatedAt = new Date().toISOString();
      try {
        await window.dataStore?.updateClientServiceRequest?.(request.id, {
          status: "Cancelado",
          updated_at: request.updatedAt
        });
      } catch (error) {
        console.error(error);
        alert("O pedido foi cancelado nesta tela, mas nao foi possivel atualizar no banco agora.");
      }
      saveState();
    }
    return;
  }
  if (importRequestFromDialog) {
    choosePendingRequestForForm();
    return;
  }
  if (paymentDashboardFilter) {
    document.getElementById("paymentStatusFilter").value = paymentDashboardFilter.dataset.paymentDashboardFilter;
    showView("payments");
    renderPayments();
  }
  if (event.target.closest("#notificationButton")) {
    renderNotifications();
    document.getElementById("notificationDialog").showModal();
  }
  const notificationTarget = event.target.closest("[data-notification-target]");
  const readAlertButton = event.target.closest("[data-read-alert]");
  const deleteAlertMessageButton = event.target.closest("[data-delete-alert-message]");
  if (readAlertButton) {
    const item = activeAlertItems().find((alert) => alertKey(alert) === readAlertButton.dataset.readAlert);
    if (item) archiveAlert(item);
    renderNotifications();
    return;
  }
  if (deleteAlertMessageButton) {
    const message = alertMessages.find((item) => item.key === deleteAlertMessageButton.dataset.deleteAlertMessage);
    if (message) message.deletedAt = new Date().toISOString();
    saveAlertMessages();
    renderNotifications();
    return;
  }
  if (notificationTarget) {
    document.getElementById("notificationDialog").close();
    if (notificationTarget.dataset.notificationTarget === "service") {
      document.getElementById("serviceStatusFilter").value = "A fazer";
      showView("services");
      renderServices();
    } else if (notificationTarget.dataset.notificationTarget === "request") {
      document.getElementById("requestStatusFilter").value = "Novo";
      showView("requests");
      renderServiceRequests();
    } else {
      document.getElementById("paymentStatusFilter").value = "overdue";
      showView("payments");
      renderPayments();
    }
  }
  if (dialogButton) {
    if (dialogButton.dataset.dialog === "trackingDialog") {
      openTrackingForm();
      return;
    }
    if (dialogButton.dataset.dialog === "clientDialog") openClientForm();
    else if (dialogButton.dataset.dialog === "catalogDialog") openCatalogForm();
    else if (dialogButton.dataset.dialog === "serviceDialog") {
      const preferredClient = uniqueClientMatch(document.getElementById("serviceClientNameFilter").value);
      openEntryForm(null, preferredClient?.id || "");
    }
    else if (dialogButton.dataset.dialog === "paymentDialog") openPaymentForm();
    else if (dialogButton.dataset.dialog === "paymentMethodDialog") openPaymentMethodForm();
    else if (dialogButton.dataset.dialog === "priceTableDialog") {
      const form = document.getElementById("priceTableForm");
      form.reset();
      document.getElementById("priceTableDialogTitle").textContent = "Nova tabela";
      document.getElementById("priceTableDialog").showModal();
    }
    else {
      setDefaultDates();
      if (dialogButton.dataset.dialog === "billingDialog") renderBillingPaymentMethods();
      if (dialogButton.dataset.dialog === "billingBatchDialog") {
        renderBillingPaymentMethods("billingBatchPaymentMethods");
        const batchForm = document.getElementById("billingBatchForm");
        const week = currentOperationalWeek();
        batchForm.elements.startDate.value = week.startDate;
        batchForm.elements.endDate.value = week.endDate;
      }
      document.getElementById(dialogButton.dataset.dialog).showModal();
    }
  }
  const closeDialogButton = event.target.closest("[data-close-dialog]");
  if (closeDialogButton) closeDialogButton.closest("dialog")?.close();
  const removeReferenceButton = event.target.closest("[data-remove-reference]");
  if (removeReferenceButton) {
    serviceReferenceValues.splice(Number(removeReferenceButton.dataset.removeReference), 1);
    renderReferenceList();
  }
  const removeAdditionalServiceButton = event.target.closest("[data-remove-additional-service]");
  if (removeAdditionalServiceButton) {
    additionalServiceValues.splice(Number(removeAdditionalServiceButton.dataset.removeAdditionalService), 1);
    renderAdditionalServiceList();
  }
  const continuationButton = event.target.closest("[data-entry-next]");
  if (continuationButton && entryContinuationResolver) {
    const resolve = entryContinuationResolver;
    entryContinuationResolver = null;
    document.getElementById("continueEntryDialog").close();
    resolve(continuationButton.dataset.entryNext);
  }

  const editClient = event.target.closest("[data-edit-client]");
  if (editClient) openClientForm(clientById(editClient.dataset.editClient));
  const deleteClient = event.target.closest("[data-delete-client]");
  if (deleteClient) {
    const id = deleteClient.dataset.deleteClient;
    const linked = state.services.some((item) => item.clientId === id)
      || state.payments.some((item) => item.clientId === id)
      || state.billings.some((item) => item.clientId === id);
    if (linked) alert("Este cliente possui movimentações e não pode ser excluído.");
    else if (confirm("Excluir este cliente?")) {
      state.clients = state.clients.filter((client) => client.id !== id);
      saveState();
    }
  }

  const editTable = event.target.closest("[data-edit-table]");
  if (editTable) {
    const form = document.getElementById("priceTableForm");
    form.reset();
    form.elements.originalName.value = editTable.dataset.editTable;
    form.elements.name.value = editTable.dataset.editTable;
    document.getElementById("priceTableDialogTitle").textContent = "Editar tabela";
    document.getElementById("priceTableDialog").showModal();
  }
  const deleteTable = event.target.closest("[data-delete-table]");
  if (deleteTable) {
    const name = deleteTable.dataset.deleteTable;
    if (state.clients.some((client) => client.priceGroup === name)) {
      alert("Esta tabela está vinculada a clientes e não pode ser excluída.");
    } else if (confirm(`Excluir a ${name}?`)) {
      state.priceTables = state.priceTables.filter((table) => table !== name);
      state.catalog.forEach((item) => delete item.prices[name]);
      saveState();
    }
  }

  const editCatalog = event.target.closest("[data-edit-catalog]");
  if (editCatalog) openCatalogForm(state.catalog.find((item) => item.id === editCatalog.dataset.editCatalog));
  const deleteCatalog = event.target.closest("[data-delete-catalog]");
  if (deleteCatalog) {
    const id = deleteCatalog.dataset.deleteCatalog;
    if (state.services.some((item) => item.catalogId === id)) {
      alert("Este serviço já possui lançamentos e não pode ser excluído.");
    } else if (confirm("Excluir este serviço?")) {
      state.catalog = state.catalog.filter((item) => item.id !== id);
      saveState();
    }
  }

  const editEntry = event.target.closest("[data-edit-entry]");
  if (editEntry) openEntryForm(state.services.find((item) => item.id === editEntry.dataset.editEntry));
  const cancelEntry = event.target.closest("[data-cancel-entry]");
  if (cancelEntry) openServiceCancellation(state.services.find((item) => item.id === cancelEntry.dataset.cancelEntry));
  const serviceStatusButton = event.target.closest("[data-service-status]");
  if (serviceStatusButton) {
    const entry = state.services.find((item) => item.id === serviceStatusButton.dataset.entryId);
    if (entry) {
      applyServiceStatus(entry, serviceStatusButton.dataset.serviceStatus);
      saveState();
    }
  }
  const requestDeliveryButton = event.target.closest("[data-request-delivery]");
  if (requestDeliveryButton) {
    const entry = state.services.find((item) => item.id === requestDeliveryButton.dataset.requestDelivery);
    if (entry) {
      if (!entry.deliveryCode) entry.deliveryCode = randomDeliveryCode();
      entry.confirmationRequestedAt = new Date().toISOString();
      entry.updatedAt = entry.confirmationRequestedAt;
      try {
        await navigator.clipboard.writeText(deliveryConfirmationMessage(entry));
        alert("Mensagem de confirmação copiada para enviar no WhatsApp.");
      } catch {
        alert(deliveryConfirmationMessage(entry));
      }
      saveState();
    }
  }
  const deleteEntry = event.target.closest("[data-delete-entry]");
  if (deleteEntry && confirm("Excluir este lançamento?")) {
    const entryId = deleteEntry.dataset.deleteEntry;
    state.supplierEntries.forEach((item) => {
      if (item.clientServiceEntryId === entryId) item.clientServiceEntryId = null;
    });
    state.services = state.services.filter((item) => item.id !== entryId);
    saveState();
  }

  const editPayment = event.target.closest("[data-edit-payment]");
  if (editPayment) {
    const payment = state.payments.find((item) => item.id === editPayment.dataset.editPayment);
    if (payment?.billingId) alert("Este pagamento ja foi abatido em uma cobranca e nao pode mais ser editado.");
    else if (payment) openPaymentForm(payment);
  }
  const payBillingButton = event.target.closest("[data-pay-billing]");
  if (payBillingButton) {
    const billing = state.billings.find((item) => item.id === payBillingButton.dataset.payBilling);
    if (billing) openPaymentForm(null, billing, payBillingButton.dataset.paymentMode);
  }
  const deletePayment = event.target.closest("[data-delete-payment]");
  if (deletePayment && confirm("Excluir este pagamento?")) {
    state.payments = state.payments.filter((item) => item.id !== deletePayment.dataset.deletePayment);
    updateBillingStatuses();
    saveState();
  }

  const editMethod = event.target.closest("[data-edit-method]");
  if (editMethod) openPaymentMethodForm(state.paymentMethods.find((method) => method.id === editMethod.dataset.editMethod));
  const deleteMethod = event.target.closest("[data-delete-method]");
  if (deleteMethod && confirm("Excluir esta forma de pagamento?")) {
    state.paymentMethods = state.paymentMethods.filter((method) => method.id !== deleteMethod.dataset.deleteMethod);
    saveState();
  }

  const reportButton = event.target.closest("[data-view-report]");
  if (reportButton) openBillingReport(reportButton.dataset.viewReport);
  const copyAccessButton = event.target.closest("[data-copy-access]");
  if (copyAccessButton) {
    const billing = state.billings.find((item) => item.id === copyAccessButton.dataset.billingId);
    const isPassword = copyAccessButton.dataset.copyAccess === "password";
    const value = isPassword ? billing?.password : billing?.identifier;
    if (value) await copyText(value, isPassword ? "Senha" : "Identificador");
  }
  const renewAccessButton = event.target.closest("[data-renew-access]");
  if (renewAccessButton) {
    const billing = state.billings.find((item) => item.id === renewAccessButton.dataset.renewAccess);
    renewAccessButton.disabled = true;
    renewAccessButton.textContent = "Gerando...";
    try {
      const credentials = await issueClientAccess(billing);
      billing.identifier = credentials.identifier;
      billing.password = credentials.password;
      await window.dataStore.upsertState(state);
      render();
      alert(`Novo acesso gerado.\n\nIdentificador: ${billing.identifier}\nSenha: ${billing.password}\n\nO acesso anterior foi invalidado.`);
    } catch (error) {
      console.error(error);
      alert(error.message);
      renewAccessButton.disabled = false;
      renewAccessButton.textContent = "Gerar novo acesso";
    }
  }
  const toggleHistoryButton = event.target.closest("[data-toggle-history]");
  if (toggleHistoryButton) {
    const billing = state.billings.find((item) => item.id === toggleHistoryButton.dataset.toggleHistory);
    if (billing) {
      const enabled = !billing.historyEnabled;
      toggleHistoryButton.disabled = true;
      try {
        await updateClientHistoryAccess(billing, enabled);
        billing.historyEnabled = enabled;
        await window.dataStore.upsertState(state);
        render();
        alert(enabled
          ? "Histórico liberado para este acesso."
          : "Histórico bloqueado imediatamente.");
      } catch (error) {
        console.error(error);
        alert(error.message);
        toggleHistoryButton.disabled = false;
      }
    }
  }
  const cancelBillingButton = event.target.closest("[data-cancel-billing]");
  if (cancelBillingButton) {
    const billing = state.billings.find((item) => item.id === cancelBillingButton.dataset.cancelBilling);
    if (billing && billingPaidAmount(billing) > 0) {
      alert("Esta cobrança possui pagamento posterior e não pode ser cancelada.");
    } else if (billing && confirm("Cancelar esta cobrança e liberar os lançamentos para um novo fechamento?")) {
      try {
        await cancelClientAccess(billing);
        releaseRolledBillings(billing);
        billing.status = "Cancelada";
        billing.active = false;
        state.services.forEach((item) => {
          if (item.billingId === billing.id) item.billingId = null;
        });
        state.payments.forEach((item) => {
          if (item.billingId === billing.id && !paymentWasAfterBilling(item, billing)) item.billingId = null;
        });
        saveState();
      } catch (error) {
        console.error(error);
        alert(error.message);
      }
    }
  }
  const deleteBillingButton = event.target.closest("[data-delete-billing]");
  if (deleteBillingButton) {
    const billing = state.billings.find((item) => item.id === deleteBillingButton.dataset.deleteBilling);
    const hasLaterBilling = billing && state.billings.some((item) =>
      item.clientId === billing.clientId
      && item.id !== billing.id
      && item.createdAt > billing.createdAt
    );
    if (hasLaterBilling) {
      alert("Esta cobrança não pode ser excluída porque já existe uma cobrança mais recente para o cliente.");
    } else if (billing && confirm(
      "Excluir definitivamente esta cobrança?\n\n"
      + "Os serviços e pagamentos continuarão registrados e ficarão disponíveis para um novo fechamento."
    )) {
      deleteBillingButton.disabled = true;
      try {
        await cancelClientAccess(billing);
        releaseRolledBillings(billing);
        state.services.forEach((item) => {
          if (item.billingId === billing.id) item.billingId = null;
        });
        state.payments.forEach((item) => {
          if (item.billingId === billing.id) item.billingId = null;
        });
        state.billings = state.billings.filter((item) => item.id !== billing.id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        if (remoteReady && window.dataStore) await window.dataStore.upsertState(state);
        render();
        alert("Cobrança excluída. Os lançamentos foram liberados para um novo fechamento.");
      } catch (error) {
        console.error(error);
        alert(error.message || "Não foi possível excluir a cobrança.");
        deleteBillingButton.disabled = false;
      }
    }
  }
  if (event.target.closest("[data-close-report]")) document.getElementById("reportDialog").close();
  if (event.target.closest("[data-print-report]")) window.print();
  const whatsappButton = event.target.closest("[data-share-whatsapp]");
  if (whatsappButton) {
    const billing = state.billings.find((item) => item.id === whatsappButton.dataset.shareWhatsapp);
    if (billing) {
      try {
        whatsappButton.disabled = true;
        whatsappButton.textContent = "Gerando link...";
        const mode = await shareBillingByWhatsApp(billing);
        billing.sendHistory ||= [];
        billing.sendHistory.push({ sentAt: new Date().toISOString(), channel: "WhatsApp", mode });
        saveState();
      } catch (error) {
        console.error(error);
        alert(error.message || "Não foi possível abrir o WhatsApp.");
      } finally {
        whatsappButton.disabled = false;
        whatsappButton.textContent = "WhatsApp";
      }
    }
  }
  const shareReportButton = event.target.closest("[data-share-report]");
  if (shareReportButton) {
    const billing = state.billings.find((item) => item.id === shareReportButton.dataset.shareReport);
    if (billing) {
      try {
        const mode = await shareBillingReport(billing);
        if (!mode) return;
        billing.sendHistory ||= [];
        billing.sendHistory.push({ sentAt: new Date().toISOString(), channel: "Relatório", mode });
        saveState();
      } catch (error) {
        console.error(error);
        alert("Não foi possível compartilhar o relatório.");
      }
    }
  }
});

document.getElementById("clientForm").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const client = {
    id: data.get("clientId") || crypto.randomUUID(),
    name: data.get("name"),
    phone: data.get("phone"),
    priceGroup: data.get("priceGroup")
  };
  const index = state.clients.findIndex((item) => item.id === client.id);
  if (index >= 0) state.clients[index] = client;
  else state.clients.push(client);
  event.currentTarget.reset();
  event.currentTarget.closest("dialog").close();
  saveState();
});

document.getElementById("priceTableForm").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const originalName = data.get("originalName");
  const name = data.get("name").trim();
  if (state.priceTables.some((table) => table === name && table !== originalName)) {
    alert("Já existe uma tabela com este nome.");
    return;
  }
  if (originalName) {
    state.priceTables = state.priceTables.map((table) => table === originalName ? name : table);
    state.clients = state.clients.map((client) => client.priceGroup === originalName ? { ...client, priceGroup: name } : client);
    state.catalog = state.catalog.map((item) => {
      const prices = { ...item.prices, [name]: item.prices[originalName] || 0 };
      if (name !== originalName) delete prices[originalName];
      return { ...item, prices };
    });
  } else {
    state.priceTables.push(name);
    state.catalog = state.catalog.map((item) => ({ ...item, prices: { ...item.prices, [name]: 0 } }));
  }
  event.currentTarget.reset();
  event.currentTarget.closest("dialog").close();
  saveState();
});

document.getElementById("catalogForm").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const code = String(data.get("code") || "").trim();
  if (code && state.catalog.some((catalogItem) =>
    catalogItem.code === code && catalogItem.id !== data.get("catalogId"))) {
    alert("Este código já está sendo usado por outro serviço.");
    return;
  }
  const item = {
    id: data.get("catalogId") || crypto.randomUUID(),
    code,
    name: data.get("name"),
    prices: Object.fromEntries([...event.currentTarget.querySelectorAll("[data-price-table]")]
      .map((input) => [input.dataset.priceTable, Number(input.value)]))
  };
  const existingIndex = state.catalog.findIndex((catalogItem) => catalogItem.id === item.id);
  if (existingIndex >= 0) state.catalog[existingIndex] = item;
  else state.catalog.push(item);
  event.currentTarget.reset();
  event.currentTarget.closest("dialog").close();
  saveState();
});

function askEntryContinuation() {
  document.getElementById("continueEntryDialog").showModal();
  return new Promise((resolve) => {
    entryContinuationResolver = resolve;
  });
}

document.getElementById("serviceForm").addEventListener("submit", async (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const form = event.currentTarget;
  syncServiceClientSelection();
  syncServiceCatalogSelection();
  if (!form.elements.clientId.value) {
    alert("Selecione um cliente válido da lista.");
    form.elements.clientSearch.focus();
    return;
  }
  if (!form.elements.catalogId.value) {
    setServiceCatalogError("O serviço é obrigatório. Escolha uma opção válida pelo código ou nome.");
    form.elements.catalogSearch.focus();
    return;
  }
  setServiceCatalogError();
  const data = new FormData(form);
  const catalogItem = state.catalog.find((item) => item.id === data.get("catalogId"));
  const existingEntry = state.services.find((item) => item.id === data.get("entryId"));
  const sourceRequest = (state.serviceRequests || []).find((item) => item.id === data.get("sourceRequestId"));
  const now = new Date().toISOString();
  const typedReferences = String(data.get("reference") || "")
    .split(/\r?\n/)
    .map((reference) => reference.trim().toUpperCase())
    .filter(Boolean);
  const references = existingEntry
    ? [typedReferences.join(" ")]
    : [...new Set([...serviceReferenceValues, ...typedReferences])];
  const entryReferences = references.length ? references : [""];
  const supplierSelection = window.supplierModule?.clientEntrySelection();
  if (supplierSelection?.error) {
    alert(supplierSelection.error);
    supplierSelection.field?.focus();
    return;
  }
  if (form.elements.hasAdditionalServices.checked && !additionalServiceValues.length) {
    alert("Adicione pelo menos um serviço complementar ou desmarque a opção.");
    form.elements.additionalCatalogSearch.focus();
    return;
  }
  if (additionalServiceValues.some((service) => service.catalogId === data.get("catalogId"))) {
    alert("O serviço principal também está na lista de complementares. Remova-o ou escolha outro serviço.");
    return;
  }
  const serviceDefinitions = [
    {
      catalogId: data.get("catalogId"),
      description: catalogItem.name,
      amount: Number(data.get("amount")),
      isSecondary: Boolean(existingEntry?.isSecondary)
    },
    ...additionalServiceValues.map((service) => {
      const additionalCatalog = state.catalog.find((item) => item.id === service.catalogId);
      return {
        catalogId: service.catalogId,
        description: additionalCatalog.name,
        amount: Number(service.amount),
        isSecondary: true
      };
    })
  ];
  const duplicates = historicalReferenceMatches({
    entryId: existingEntry?.id || "",
    references: entryReferences
  });
  if (duplicates.length) {
    const shouldContinue = await confirmHistoricalReferenceReuse(duplicates);
    if (!shouldContinue) return;
  }
  const createdEntries = [];
  entryReferences.forEach((reference, referenceIndex) => {
    const serviceGroupId = existingEntry?.serviceGroupId || crypto.randomUUID();
    const primaryEntryId = existingEntry && referenceIndex === 0
      ? existingEntry.id
      : crypto.randomUUID();
    serviceDefinitions.forEach((service, serviceIndex) => {
      const isPrimary = serviceIndex === 0;
      const entry = {
        id: isPrimary ? primaryEntryId : crypto.randomUUID(),
        clientId: data.get("clientId"),
        catalogId: service.catalogId,
        date: data.get("date"),
        description: service.description,
        reference,
        amount: service.amount,
        status: data.get("status"),
        serviceGroupId,
        primaryEntryId: existingEntry
          ? existingEntry.primaryEntryId || ""
          : isPrimary ? "" : primaryEntryId,
        isSecondary: service.isSecondary,
        deliveryCode: isPrimary && existingEntry?.deliveryCode
          ? existingEntry.deliveryCode
          : randomDeliveryCode(),
        confirmationRequestedAt: isPrimary ? existingEntry?.confirmationRequestedAt || null : null,
        deliveredAt: data.get("status") === "Entregue"
          ? (isPrimary ? existingEntry?.deliveredAt : null) || now
          : null,
        deliverySource: data.get("status") === "Entregue"
          ? (isPrimary ? existingEntry?.deliverySource : "") || adminDisplayName()
          : "",
        createdAt: isPrimary ? existingEntry?.createdAt || now : now,
        updatedAt: now
      };
      const index = state.services.findIndex((item) => item.id === entry.id);
      if (index >= 0) state.services[index] = entry;
      else state.services.push(entry);
      createdEntries.push(entry);
    });
  });
  const savedClientId = data.get("clientId");
  if (sourceRequest && !existingEntry) {
    sourceRequest.status = "Importado";
    sourceRequest.importedEntryIds = createdEntries.map((entry) => entry.id);
    sourceRequest.importedAt = now;
    sourceRequest.updatedAt = now;
  }
  form.reset();
  form.closest("dialog").close();
  if (!existingEntry) {
    window.supplierModule?.createForClientEntries(createdEntries, supplierSelection);
  }
  try {
    if (sourceRequest && !existingEntry) {
      await window.dataStore?.updateClientServiceRequest?.(sourceRequest.id, {
        status: "Importado",
        imported_entry_ids: sourceRequest.importedEntryIds,
        imported_at: sourceRequest.importedAt,
        updated_at: sourceRequest.updatedAt
      });
    }
    await persistStateNow();
    render();
  } catch (error) {
    console.error("Falha ao sincronizar o lançamento:", error);
    alert("O lançamento ficou salvo neste aparelho, mas a sincronização online falhou. O sistema tentará novamente.");
    saveState();
  }
  if (existingEntry) return;

  const next = await askEntryContinuation();
  if (next === "same") openEntryForm(null, savedClientId);
  if (next === "other") openEntryForm();
});

document.getElementById("cancelServiceForm").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const entry = state.services.find((item) => item.id === data.get("entryId"));
  if (!entry) return;
  const reason = String(data.get("reason") || "").trim();
  if (!reason) return;
  const group = cancellationGroup(entry);
  const targets = [entry];
  if (data.get("cancelComplementary") === "on" && !entry.isSecondary) {
    targets.push(...group.filter((item) => item.id !== entry.id && item.isSecondary));
  }
  const targetIds = new Set(targets.map((item) => item.id));
  const now = new Date().toISOString();
  targets.forEach((item) => {
    if (item.status === "Cancelado") return;
    item.cancellationOriginalAmount = Number(item.amount);
    item.cancellationReason = reason;
    item.amount = 0;
    item.status = "Cancelado";
    item.updatedAt = now;
  });
  if (!entry.isSecondary && data.get("cancelComplementary") !== "on") {
    const activeComplementaryIds = new Set(group
      .filter((item) => item.id !== entry.id && item.isSecondary && item.status !== "Cancelado")
      .map((item) => item.id));
    group
      .filter((item) => activeComplementaryIds.has(item.id))
      .forEach((item) => {
        item.status = "Entregue";
        item.notes = `${entry.description || "Servi\u00E7o de origem"} cancelado por: ${reason}`;
        item.deliveredAt = item.deliveredAt || now;
        item.deliverySource = item.deliverySource || adminDisplayName();
        item.updatedAt = now;
      });
    state.supplierEntries
      .filter((item) => activeComplementaryIds.has(item.clientServiceEntryId) && item.status !== "Cancelado")
      .forEach((item) => {
        item.notes = `${entry.description || "Servi\u00E7o de origem"} cancelado por: ${reason}`;
        item.lastChangedBy = adminDisplayName();
        item.updatedAt = now;
      });
  }
  if (data.get("cancelSupplier") === "on") {
    state.supplierEntries
      .filter((item) => targetIds.has(item.clientServiceEntryId) && !item.payableId)
      .forEach((item) => {
        if (item.status === "Cancelado") return;
        item.cancellationOriginalAmount = Number(item.amount);
        item.cancellationReason = reason;
        item.amount = 0;
        item.status = "Cancelado";
        item.updatedAt = now;
      });
  }
  event.currentTarget.closest("dialog").close();
  saveState();
});

document.getElementById("paymentForm").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const existingPayment = state.payments.find((item) => item.id === data.get("paymentId"));
  const now = new Date().toISOString();
  const billingId = data.get("billingId") || existingPayment?.billingId || null;
  const amount = Number(data.get("amount"));
  const linkedBilling = state.billings.find((item) => item.id === billingId);
  if (linkedBilling) {
    if (data.get("clientId") !== linkedBilling.clientId) {
      alert("O cliente do pagamento deve ser o mesmo da cobrança.");
      return;
    }
    const available = billingOpenAmount(linkedBilling) + Number(existingPayment?.amount || 0);
    if (amount > available + 0.001) {
      alert(`O valor máximo para esta cobrança é ${money.format(available)}.`);
      return;
    }
  }
  const payment = {
    id: data.get("paymentId") || crypto.randomUUID(),
    clientId: data.get("clientId"),
    billingId,
    date: data.get("date"),
    amount,
    method: data.get("method"),
    note: data.get("note"),
    externalPaymentId: existingPayment?.externalPaymentId || "",
    paymentSource: existingPayment?.paymentSource || "Manual",
    createdAt: existingPayment?.createdAt || now,
    updatedAt: now
  };
  const index = state.payments.findIndex((item) => item.id === payment.id);
  if (index >= 0) state.payments[index] = payment;
  else state.payments.push(payment);
  updateBillingStatuses();
  event.currentTarget.reset();
  event.currentTarget.closest("dialog").close();
  saveState();
});

document.getElementById("paymentMethodForm").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const method = {
    id: data.get("methodId") || crypto.randomUUID(),
    type: data.get("type"),
    name: data.get("name"),
    details: data.get("details"),
    link: data.get("link"),
    active: data.get("active") === "on"
  };
  const index = state.paymentMethods.findIndex((item) => item.id === method.id);
  if (index >= 0) state.paymentMethods[index] = method;
  else state.paymentMethods.push(method);
  event.currentTarget.reset();
  event.currentTarget.closest("dialog").close();
  saveState();
});

document.getElementById("trackingForm").addEventListener("submit", async (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const form = event.currentTarget;
  syncTrackingClientSelection();
  if (!form.elements.clientId.value) {
    alert("Selecione um cliente válido da lista.");
    form.elements.clientSearch.focus();
    return;
  }
  if (form.elements.endDate.value < form.elements.startDate.value) {
    alert("A data final deve ser igual ou posterior à data inicial.");
    return;
  }

  const button = event.submitter;
  button.disabled = true;
  button.textContent = "Gerando link...";
  try {
    const { data } = await window.supabaseClient.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) throw new Error("Sua sessão administrativa expirou.");
    const response = await fetch("/.netlify/functions/issue-service-tracking-link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        clientId: form.elements.clientId.value,
        startDate: form.elements.startDate.value,
        endDate: form.elements.endDate.value,
        validDays: Number(form.elements.validDays.value),
        allowRequests: form.elements.allowRequests.checked,
        showAmounts: form.elements.showAmounts.checked
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Não foi possível gerar o link.");
    const client = clientById(form.elements.clientId.value);
    const url = `${location.origin}/acompanhamento.html?access=${encodeURIComponent(result.accessCode)}`;
    const requestText = form.elements.allowRequests.checked
      ? "\n\nNeste link voc\u00EA tamb\u00E9m pode enviar novos pedidos."
      : "";
    const text = `Ol\u00E1, ${client?.name || ""}!\n\nAcompanhe seus servi\u00E7os de ${formatDate(form.elements.startDate.value)} a ${formatDate(form.elements.endDate.value)} pelo link abaixo:\n\n${url}${requestText}\n\nEste acesso \u00E9 somente para consulta dos servi\u00E7os.`;
    const phone = whatsappPhone(client);
    const query = `${phone ? `phone=${phone}&` : ""}text=${encodeURIComponent(text)}`;
    const link = document.createElement("a");
    link.href = `https://api.whatsapp.com/send?${query}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
    form.closest("dialog").close();
  } catch (error) {
    console.error(error);
    alert(error.message);
  } finally {
    button.disabled = false;
    button.textContent = "Gerar e compartilhar";
  }
});

document.getElementById("billingForm").addEventListener("submit", async (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const form = event.currentTarget;
  const dialog = form.closest("dialog");
  const submitButton = event.submitter;
  const data = new FormData(form);
  const clientId = data.get("clientId");
  const startDate = data.get("startDate");
  const endDate = data.get("endDate");
  const billingId = crypto.randomUUID();
  const paymentMethodIds = data.getAll("paymentMethodId");
  if (!paymentMethodIds.length) {
    alert("Selecione pelo menos uma forma de pagamento.");
    return;
  }
  const services = state.services.filter((item) =>
    !item.billingId && item.status !== "Cancelado"
    && item.clientId === clientId && item.date >= startDate && item.date <= endDate);
  const payments = availableAdvancePayments(clientId);
  const paymentsBeforeBilling = typeof structuredClone === "function"
    ? structuredClone(state.payments)
    : JSON.parse(JSON.stringify(state.payments));
  const servicesTotal = services.reduce((sum, item) => sum + item.amount, 0);
  const paymentsTotal = payments.reduce((sum, item) => sum + item.amount, 0);
  const paymentsAfterPeriod = payments
    .filter((item) => item.date > endDate)
    .reduce((sum, item) => sum + item.amount, 0);
  const rawBalance = balanceFor(clientId, endDate) - paymentsAfterPeriod;
  const amount = Math.max(0, rawBalance + paymentsTotal);
  const pendingServices = services.filter((item) => item.status === "A fazer");
  if (pendingServices.length) {
    const names = pendingServices.slice(0, 5)
      .map((item) => `• ${item.description}${item.reference ? ` (${item.reference})` : ""}`)
      .join("\n");
    const confirmed = confirm(
      `Existem ${pendingServices.length} serviço(s) ainda marcados como "A fazer":\n\n${names}\n\nOK: gerar a cobrança mesmo assim.\nCancelar: voltar e atualizar os status.`
    );
    if (!confirmed) return;
  }

  const billing = {
    id: billingId,
    clientId,
    startDate,
    endDate,
    amount,
    previousBalance: amount - servicesTotal,
    servicesTotal,
    paymentsTotal: 0,
    paymentIds: [],
    creditGenerated: 0,
    statusReason: "Aguardando pagamento",
    calculationVersion: 2,
    identifier: "",
    password: "",
    status: "Aberta",
    active: true,
    paymentMethodIds,
    paymentMethods: state.paymentMethods
      .filter((method) => paymentMethodIds.includes(method.id))
      .map((method) => ({ ...method })),
    historyEnabled: data.get("historyEnabled") === "on",
    sendHistory: [],
    createdAt: new Date().toISOString()
  };
  state.billings.push(billing);

  submitButton.disabled = true;
  submitButton.textContent = "Gerando acesso...";
  let persisted = false;
  try {
    await (window.dataStore.saveNow?.(state) || window.dataStore.upsertState(state));
    const credentials = await issueClientAccess(billing);
    billing.identifier = credentials.identifier;
    billing.password = credentials.password;
    allocateAdvancePayments(billing, payments);
    consolidatePreviousBillings(billing);
    billing.status = billingCurrentStatus(billing);
    services.forEach((item) => { item.billingId = billingId; });
    await (window.dataStore.saveNow?.(state) || window.dataStore.upsertState(state));
    persisted = true;
    form.reset();
    dialog.close();
    render();
    alert(`Cobrança criada.\n\nIdentificador: ${billing.identifier}\nSenha: ${billing.password}\n\nA senha será exibida somente agora. O relatório compartilhado não inclui esses dados.`);
  } catch (error) {
    console.error(error);
    if (!persisted) {
      releaseRolledBillings(billing);
      state.billings = state.billings.filter((item) => item.id !== billingId);
      services.forEach((item) => { item.billingId = null; });
      state.payments = paymentsBeforeBilling;
      try {
        await (window.dataStore.saveNow?.(state) || window.dataStore.upsertState(state));
      } catch (rollbackError) {
        console.error("Falha ao desfazer a cobrança incompleta:", rollbackError);
      }
    }
    alert(error.message);
    render();
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Fechar período";
  }
});

document.getElementById("billingBatchForm").addEventListener("submit", async (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const form = event.currentTarget;
  const dialog = form.closest("dialog");
  const submitButton = event.submitter;
  const data = new FormData(form);
  const startDate = data.get("startDate");
  const endDate = data.get("endDate");
  const paymentMethodIds = data.getAll("paymentMethodId");
  if (!paymentMethodIds.length) {
    alert("Selecione pelo menos uma forma de pagamento.");
    return;
  }

  const eligibleServices = state.services.filter((item) =>
    !item.billingId && item.status !== "Cancelado"
    && item.date >= startDate && item.date <= endDate
  );
  const clientIds = [...new Set(eligibleServices.map((item) => item.clientId))];
  if (!clientIds.length) {
    alert("Nenhum cliente possui servicos pendentes de cobranca neste periodo.");
    return;
  }
  const pendingCount = eligibleServices.filter((item) => item.status === "A fazer").length;
  const warning = pendingCount ? `\n\nAtencao: ${pendingCount} servico(s) ainda estao marcados como A fazer.` : "";
  if (!confirm(`Gerar ${clientIds.length} cobranca(s), uma para cada cliente com servicos no periodo?${warning}`)) return;

  const stateBeforeBatch = typeof structuredClone === "function"
    ? structuredClone(state)
    : JSON.parse(JSON.stringify(state));
  const selectedMethods = state.paymentMethods
    .filter((method) => paymentMethodIds.includes(method.id))
    .map((method) => ({ ...method }));
  const drafts = clientIds.map((clientId, index) => {
    const services = eligibleServices.filter((item) => item.clientId === clientId);
    const payments = availableAdvancePayments(clientId);
    const servicesTotal = services.reduce((sum, item) => sum + Number(item.amount), 0);
    const paymentsTotal = payments.reduce((sum, item) => sum + Number(item.amount), 0);
    const paymentsAfterPeriod = payments
      .filter((item) => item.date > endDate)
      .reduce((sum, item) => sum + Number(item.amount), 0);
    const rawBalance = balanceFor(clientId, endDate) - paymentsAfterPeriod;
    const amount = Math.max(0, rawBalance + paymentsTotal);
    const billing = {
      id: crypto.randomUUID(), clientId, startDate, endDate, amount,
      previousBalance: amount - servicesTotal, servicesTotal, paymentsTotal: 0,
      paymentIds: [], creditGenerated: 0, statusReason: "Aguardando pagamento",
      calculationVersion: 2, identifier: "", password: "", status: "Aberta", active: true,
      paymentMethodIds, paymentMethods: selectedMethods.map((method) => ({ ...method })),
      historyEnabled: data.get("historyEnabled") === "on", sendHistory: [],
      createdAt: new Date(Date.now() + index).toISOString()
    };
    return { billing, services, payments };
  });

  submitButton.disabled = true;
  submitButton.textContent = "Criando cobrancas...";
  try {
    state.billings.push(...drafts.map((draft) => draft.billing));
    await (window.dataStore.saveNow?.(state) || window.dataStore.upsertState(state));

    const failures = [];
    for (const draft of drafts) {
      try {
        const credentials = await issueClientAccess(draft.billing);
        draft.billing.identifier = credentials.identifier;
        draft.billing.password = credentials.password;
        allocateAdvancePayments(draft.billing, draft.payments);
        consolidatePreviousBillings(draft.billing);
        draft.billing.status = billingCurrentStatus(draft.billing);
        draft.services.forEach((item) => { item.billingId = draft.billing.id; });
      } catch (error) {
        failures.push(`${clientById(draft.billing.clientId)?.name || "Cliente"}: ${error.message}`);
        state.billings = state.billings.filter((item) => item.id !== draft.billing.id);
      }
    }
    await (window.dataStore.saveNow?.(state) || window.dataStore.upsertState(state));
    form.reset();
    dialog.close();
    render();
    const successCount = drafts.length - failures.length;
    alert(`${successCount} cobranca(s) gerada(s) com sucesso.${failures.length ? `\n\nFalhas:\n${failures.join("\n")}` : ""}`);
  } catch (error) {
    console.error(error);
    state = stateBeforeBatch;
    try {
      await (window.dataStore.saveNow?.(state) || window.dataStore.upsertState(state));
    } catch (rollbackError) {
      console.error("Falha ao desfazer o fechamento em lote:", rollbackError);
    }
    render();
    alert(`Nao foi possivel concluir o fechamento em lote. ${error.message}`);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Gerar para todos";
  }
});

document.getElementById("whatsappForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = event.submitter;
  const data = new FormData(form);
  const resultBox = document.getElementById("whatsappConnectionResult");
  const status = document.getElementById("whatsappConnectionStatus");
  const message = document.getElementById("whatsappConnectionMessage");
  const qrCode = document.getElementById("whatsappQrCode");

  button.disabled = true;
  button.textContent = "Conectando...";
  resultBox.classList.remove("hidden");
  status.textContent = "Iniciando sessão";
  message.textContent = "Aguarde a resposta da APIBrasil.";
  qrCode.classList.add("hidden");
  qrCode.removeAttribute("src");

  try {
    await startApiBrasilWhatsApp({
      number: String(data.get("number") || "").replace(/\D/g, ""),
      forceClearCache: data.get("forceClearCache") === "on"
    });
    await pollApiBrasilWhatsApp((result) => {
      const qrCodeSource = apiBrasilQrCode({
        qrcode: result.qr_code
      });
      status.textContent = result.status || "Processando";
      message.textContent = result.message || "Aguardando atualização da APIBrasil.";
      if (qrCodeSource) {
        qrCode.src = qrCodeSource;
        qrCode.classList.remove("hidden");
      }
    });
  } catch (error) {
    console.error(error);
    status.textContent = "Falha ao conectar";
    message.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = "Iniciar sessão";
  }
});

[
  ["clientSearch", "input", renderClients],
  ["priceTableSearch", "input", renderPriceTables],
  ["catalogSearch", "input", renderCatalog],
  ["serviceClientNameFilter", "input", syncServiceClientFilter],
  ["serviceStatusFilter", "change", renderServices],
  ["serviceStartDate", "change", renderServices],
  ["serviceEndDate", "change", renderServices],
  ["serviceSearch", "input", renderServices],
  ["requestSearch", "input", renderServiceRequests],
  ["requestStatusFilter", "change", renderServiceRequests],
  ["paymentClientFilter", "change", renderPayments],
  ["paymentStatusFilter", "change", renderPayments],
  ["paymentStartFilter", "change", () => { setFinancePeriodFromInputs("payment"); refreshFinanceViews(); }],
  ["paymentEndFilter", "change", () => { setFinancePeriodFromInputs("payment"); refreshFinanceViews(); }],
  ["paymentSearch", "input", renderPayments],
  ["paymentMethodStatusFilter", "change", renderPaymentMethods],
  ["paymentMethodSearch", "input", renderPaymentMethods],
  ["billingClientFilter", "change", renderBillings],
  ["billingStatusFilter", "change", renderBillings],
  ["billingStartFilter", "change", () => { setFinancePeriodFromInputs("billing"); refreshFinanceViews(); }],
  ["billingEndFilter", "change", () => { setFinancePeriodFromInputs("billing"); refreshFinanceViews(); }],
  ["billingSearch", "input", renderBillings]
].forEach(([id, eventName, handler]) => {
  document.getElementById(id).addEventListener(eventName, handler);
});
document.addEventListener("click", (event) => {
  const periodButton = event.target.closest("[data-finance-period]");
  const shiftButton = event.target.closest("[data-finance-shift]");
  if (!periodButton && !shiftButton) return;
  if (periodButton) {
    const mode = periodButton.dataset.financePeriod;
    setFinancePeriod(mode === "month" ? monthPeriod() : currentOperationalWeek(), mode);
  } else {
    shiftFinancePeriod(Number(shiftButton.dataset.financeShift));
  }
  refreshFinanceViews();
});
document.addEventListener("click", (event) => {
  const filterButton = event.target.closest("[data-toggle-service-filters]");
  const actionButton = event.target.closest("[data-toggle-service-actions]");
  if (filterButton) {
    const section = document.getElementById("services");
    const expanded = !section.classList.contains("mobile-filters-open");
    section.classList.toggle("mobile-filters-open", expanded);
    filterButton.setAttribute("aria-expanded", String(expanded));
    const label = filterButton.querySelector("strong");
    if (label) label.textContent = expanded ? "Ocultar" : "Mostrar";
    return;
  }
  if (actionButton) {
    const card = actionButton.closest(".timeline-item");
    const expanded = !card.classList.contains("mobile-actions-open");
    card.classList.toggle("mobile-actions-open", expanded);
    actionButton.setAttribute("aria-expanded", String(expanded));
    actionButton.textContent = expanded ? "Ocultar opcoes" : "Mais opcoes";
  }
});
document.addEventListener("click", (event) => {
  const filterButton = event.target.closest("[data-toggle-finance-filters]");
  const detailButton = event.target.closest("[data-toggle-finance-card]");
  if (filterButton) {
    const section = document.getElementById(filterButton.dataset.toggleFinanceFilters);
    const expanded = !section.classList.contains("mobile-filters-open");
    section.classList.toggle("mobile-filters-open", expanded);
    filterButton.setAttribute("aria-expanded", String(expanded));
    const label = filterButton.querySelector("strong");
    if (label) label.textContent = expanded ? "Ocultar" : "Mostrar";
    return;
  }
  if (detailButton) {
    const card = detailButton.closest(".receivable-card, .billing-card");
    const expanded = !card.classList.contains("mobile-finance-expanded");
    card.classList.toggle("mobile-finance-expanded", expanded);
    detailButton.setAttribute("aria-expanded", String(expanded));
    detailButton.textContent = expanded ? "Ocultar detalhes" : "Ver detalhes";
  }
});
document.addEventListener("click", (event) => {
  const currentWeekButton = event.target.closest("[data-service-current-week]");
  if (!currentWeekButton) return;
  const week = currentOperationalWeek();
  document.getElementById("serviceStartDate").value = week.startDate;
  document.getElementById("serviceEndDate").value = week.endDate;
  renderServices();
});
document.querySelector('#serviceForm input[name="clientSearch"]').addEventListener("input", syncServiceClientSelection);
document.querySelector('#serviceForm input[name="clientSearch"]').addEventListener("change", syncServiceClientSelection);
document.querySelector('#serviceForm input[name="catalogSearch"]').addEventListener("input", () => setServiceCatalogError());
document.querySelector('#serviceForm input[name="catalogSearch"]').addEventListener("input", syncServiceCatalogSelection);
document.querySelector('#serviceForm input[name="catalogSearch"]').addEventListener("change", syncServiceCatalogSelection);
document.querySelector('#serviceForm input[name="catalogSearch"]').addEventListener("blur", (event) => {
  syncServiceCatalogSelection();
  if (!event.target.closest("form").elements.catalogId.value) {
    setServiceCatalogError("O serviço é obrigatório. Escolha uma opção válida da lista.");
  }
});
document.querySelector('#serviceForm input[name="catalogSearch"]').addEventListener("invalid", (event) => {
  event.preventDefault();
  setServiceCatalogError("O serviço é obrigatório. Digite o código ou nome e escolha uma opção da lista.");
  event.target.focus();
});
document.querySelector('#trackingForm input[name="clientSearch"]').addEventListener("input", syncTrackingClientSelection);
document.querySelector('#trackingForm input[name="clientSearch"]').addEventListener("change", syncTrackingClientSelection);
["dashboardStartDate", "dashboardEndDate"].forEach((id) => {
  document.getElementById(id).addEventListener("change", () => {
    const startDate = document.getElementById("dashboardStartDate").value;
    const endDate = document.getElementById("dashboardEndDate").value;
    if (!startDate || !endDate || endDate < startDate) return;
    dashboardPeriod = { startDate, endDate };
    document.querySelectorAll("[data-dashboard-period]").forEach((button) => button.classList.remove("active"));
    renderDashboardV2();
  });
});
["weekStartDay", "weekEndDay"].forEach((id) => {
  document.getElementById(id)?.addEventListener("change", () => {
    systemSettings = {
      weekStartDay: Number(document.getElementById("weekStartDay").value),
      weekEndDay: Number(document.getElementById("weekEndDay").value)
    };
    saveSystemSettings();
    dashboardPeriod = currentOperationalWeek();
    document.querySelectorAll("[data-dashboard-period]").forEach((button) => {
      button.classList.toggle("active", button.dataset.dashboardPeriod === "week");
    });
    renderDashboardV2();
    showToast("Periodo padrao atualizado.");
  });
});
document.getElementById("addReferenceButton").addEventListener("click", addCurrentReference);
document.querySelector('#serviceForm input[name="hasAdditionalServices"]').addEventListener("change", toggleAdditionalServices);
document.querySelector('#serviceForm input[name="additionalCatalogSearch"]').addEventListener("input", syncAdditionalCatalogSelection);
document.querySelector('#serviceForm input[name="additionalCatalogSearch"]').addEventListener("change", syncAdditionalCatalogSelection);
document.getElementById("addAdditionalServiceButton").addEventListener("click", addAdditionalService);
document.querySelector("[data-cancel-service-entry]").addEventListener("click", () => {
  serviceReferenceValues = [];
  additionalServiceValues = [];
  document.getElementById("serviceForm").reset();
  document.getElementById("additionalServicesSection").classList.add("hidden");
  window.supplierModule?.resetClientEntryOptions();
  document.getElementById("serviceDialog").close();
});
document.getElementById("referenceHistoryCancel").addEventListener("click", () => settleReferenceHistoryDialog(false));
document.getElementById("referenceHistoryClose").addEventListener("click", () => settleReferenceHistoryDialog(false));
document.getElementById("referenceHistoryConfirm").addEventListener("click", () => settleReferenceHistoryDialog(true));
document.getElementById("referenceHistoryDialog").addEventListener("cancel", (event) => {
  event.preventDefault();
  settleReferenceHistoryDialog(false);
});
document.getElementById("referenceHistoryDialog").addEventListener("close", () => {
  if (!referenceHistoryResolver) return;
  const resolver = referenceHistoryResolver;
  referenceHistoryResolver = null;
  resolver(false);
});
document.getElementById("continueEntryDialog").addEventListener("cancel", (event) => {
  event.preventDefault();
  if (!entryContinuationResolver) return;
  const resolve = entryContinuationResolver;
  entryContinuationResolver = null;
  event.currentTarget.close();
  resolve("close");
});

document.getElementById("serviceForm").addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey || event.target.tagName === "BUTTON") return;
  const form = event.currentTarget;
  const supplierEnabled = form.elements.hasSupplierService.checked
    && !form.elements.hasSupplierService.disabled;
  const additionalEnabled = form.elements.hasAdditionalServices.checked
    && !form.elements.hasAdditionalServices.disabled;

  function focusNextFrom(target) {
    const fields = [
      form.elements.clientSearch,
      form.elements.date,
      form.elements.catalogSearch,
      form.elements.reference,
      form.elements.amount,
      form.elements.hasAdditionalServices,
      ...(additionalEnabled ? [
        form.elements.additionalCatalogSearch,
        form.elements.additionalAmount
      ] : []),
      form.elements.hasSupplierService,
      ...(supplierEnabled ? [
        form.elements.supplierId,
        form.elements.supplierServiceId,
        form.elements.supplierAmount
      ] : []),
      form.elements.status
    ].filter((field) => field && !field.disabled);
    const index = fields.indexOf(target);
    if (index >= 0 && index < fields.length - 1) {
      fields[index + 1].focus();
      return true;
    }
    if (index === fields.length - 1) {
      form.requestSubmit(form.querySelector('button[value="default"]'));
      return true;
    }
    return false;
  }

  if (event.target.name === "hasAdditionalServices") {
    event.preventDefault();
    if (additionalEnabled) form.elements.additionalCatalogSearch.focus();
    else form.elements.hasSupplierService.focus();
    return;
  }
  if (event.target.name === "hasSupplierService") {
    event.preventDefault();
    if (supplierEnabled) form.elements.supplierId.focus();
    else form.elements.status.focus();
    return;
  }
  if (event.target.name === "supplierServiceId") {
    event.preventDefault();
    if (!event.target.value && window.supplierModule?.hasClientSupplierServices()) {
      form.elements.status.focus();
      return;
    }
    form.elements.supplierAmount.focus();
    return;
  }
  if (event.target.name === "supplierAmount") {
    event.preventDefault();
    const added = window.supplierModule?.addClientSupplierService();
    if (!added) return;
    return;
  }
  if (event.target.name === "additionalCatalogSearch") {
    event.preventDefault();
    if (!event.target.value.trim() && additionalServiceValues.length) {
      form.elements.hasSupplierService.focus();
      return;
    }
    syncAdditionalCatalogSelection();
    form.elements.additionalAmount.focus();
    return;
  }
  if (event.target.name === "additionalAmount") {
    event.preventDefault();
    addAdditionalService();
    return;
  }
  if (event.target.name === "reference") {
    event.preventDefault();
    if (event.target.value.trim()) {
      addCurrentReference();
      return;
    }
    form.elements.amount.focus();
    return;
  }
  event.preventDefault();
  if (event.target.name === "clientSearch") syncServiceClientSelection();
  if (event.target.name === "catalogSearch") syncServiceCatalogSelection();
  focusNextFrom(event.target);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey || event.target.tagName === "BUTTON") return;
  const form = event.target.closest("dialog form");
  if (!form || form.id === "serviceForm" || form.id === "supplierEntryForm") return;
  if (event.target.tagName === "TEXTAREA") {
    event.preventDefault();
  }
  const fields = Array.from(form.querySelectorAll("input, select, textarea, button"))
    .filter((field) => !field.disabled && field.type !== "hidden" && field.offsetParent !== null);
  const index = fields.indexOf(event.target);
  if (index < 0) return;
  event.preventDefault();
  const next = fields.slice(index + 1).find((field) => field.tagName !== "BUTTON" || field.type === "submit" || field.value === "default");
  if (next && next.tagName !== "BUTTON") next.focus();
  else {
    const submitButton = form.querySelector('button[value="default"], button[type="submit"]');
    if (submitButton) form.requestSubmit(submitButton);
  }
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  document.getElementById("installButton").classList.remove("hidden");
  document.getElementById("mobileInstallButton")?.classList.remove("hidden");
});

document.getElementById("installButton").addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  document.getElementById("installButton").classList.add("hidden");
  document.getElementById("mobileInstallButton")?.classList.add("hidden");
});

document.getElementById("mobileMenuButton")?.addEventListener("click", () => {
  setMobileMenuOpen(!document.body.classList.contains("mobile-menu-open"));
});
document.getElementById("mobileLogoutButton")?.addEventListener("click", () => {
  document.getElementById("logoutButton")?.click();
});
document.getElementById("mobileInstallButton")?.addEventListener("click", () => {
  document.getElementById("installButton")?.click();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setMobileMenuOpen(false);
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js?v=74").then((registration) => registration.update());
}
updateSoundAlertButton();
render();
window.addEventListener("app-authenticated", (event) => {
  const user = event.detail?.user;
  currentAdminName = user?.user_metadata?.name
    || user?.user_metadata?.full_name
    || user?.email?.split("@")[0]
    || "Administrador";
  initializeRemoteState();
});
window.addEventListener("focus", refreshRemoteState);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") refreshRemoteState();
  else window.dataStore?.flushSave?.();
});
setInterval(refreshRemoteState, 8000);
