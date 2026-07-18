const STORAGE_KEY = "gestor-servicos-v1";
const ALERT_MESSAGES_KEY = "gestor-servicos-alert-messages-v1";
const SOUND_ALERTS_KEY = "gestor-servicos-sound-alerts-v1";
const SYSTEM_SETTINGS_KEY = "gestor-servicos-system-settings-v1";
const APP_THEMES = ["verde", "azul", "grafite", "dark", "bluedark"];
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
  clientRequesters: [],
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
let billingOverdueOnly = false;
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
      weekEndDay: Number.isInteger(Number(parsed.weekEndDay)) ? Number(parsed.weekEndDay) : 5,
      askEntryContinuation: parsed.askEntryContinuation !== false,
      offerSupplierShare: parsed.offerSupplierShare !== false,
      theme: APP_THEMES.includes(parsed.theme) ? parsed.theme : "verde"
    };
  } catch {
    return { weekStartDay: 0, weekEndDay: 5, askEntryContinuation: true, offerSupplierShare: true, theme: "verde" };
  }
}

function saveSystemSettings() {
  localStorage.setItem(SYSTEM_SETTINGS_KEY, JSON.stringify(systemSettings));
}

function applyTheme() {
  const theme = systemSettings.theme || "verde";
  if (theme === "verde") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  document.querySelectorAll("[data-theme-option]").forEach((button) => {
    button.classList.toggle("active", button.dataset.themeOption === theme);
  });
}

function saveState() {
  localStateRevision += 1;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
  if (remoteReady && window.dataStore) {
    window.dataStore.scheduleSave(state, (error) => {
      console.error("Falha ao salvar no Supabase:", error.code, error.message);
      const detail = error?.message ? `\n\nDetalhe: ${error.message}` : "";
      showAppAlert(`Não foi possível sincronizar os dados com o banco.${detail}\n\nOs dados continuam salvos neste aparelho e o sistema tentará novamente na próxima alteração.`, { type: "error" });
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
    applyNotificationDeepLink();
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

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

async function pushAuthHeaders() {
  const { data } = await window.supabaseClient.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Sua sessão administrativa expirou.");
  return { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` };
}

function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function updatePushToggleButton() {
  const button = document.getElementById("settingsPushToggle");
  const status = document.getElementById("settingsPushStatus");
  if (!button) return;
  if (!pushSupported()) {
    button.disabled = true;
    button.textContent = "Notificações push não suportadas neste navegador";
    if (status) status.textContent = "";
    return;
  }
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  button.disabled = false;
  if (subscription) {
    button.textContent = "Desativar notificações push neste aparelho";
    if (status) status.textContent = "Ativas neste aparelho.";
  } else {
    button.textContent = "Ativar notificações push neste aparelho";
    if (status) status.textContent = "";
  }
}

async function enablePushNotifications() {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    showAppAlert("Permissão de notificação não concedida.", { type: "warning" });
    return;
  }
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(window.APP_CONFIG.vapidPublicKey)
  });
  const headers = await pushAuthHeaders();
  const response = await fetch("/.netlify/functions/push-subscribe", {
    method: "POST",
    headers,
    body: JSON.stringify({ ...subscription.toJSON(), deviceLabel: navigator.userAgent.slice(0, 120) })
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || "Não foi possível ativar as notificações push.");
  }
  showAppAlert("Notificações push ativadas neste aparelho.", { type: "success" });
}

async function disablePushNotifications() {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  try {
    const headers = await pushAuthHeaders();
    await fetch("/.netlify/functions/push-unsubscribe", { method: "POST", headers, body: JSON.stringify({ endpoint }) });
  } catch {
    /* segue mesmo se a limpeza no servidor falhar; a inscricao local ja foi cancelada */
  }
  showAppAlert("Notificações push desativadas neste aparelho.", { type: "success" });
}

function showToast(message) {
  const toast = document.getElementById("appToast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.add("hidden"), 6000);
}

const APP_ALERT_KIND = {
  success: { title: "Sucesso" },
  error: { title: "Erro" },
  warning: { title: "Atenção" },
  info: { title: "Aviso" }
};

function showAppAlert(message, opts = {}) {
  return new Promise((resolve) => {
    const toast = document.getElementById("appAlertDialog");
    if (!toast) { window.alert(message); resolve(); return; }
    const type = APP_ALERT_KIND[opts.type] ? opts.type : "success";
    const kind = APP_ALERT_KIND[type];
    clearTimeout(showAppAlert.hideTimer);
    clearTimeout(showAppAlert.doneTimer);
    toast.classList.remove("app-alert-success", "app-alert-error", "app-alert-warning", "app-alert-info");
    toast.classList.add(`app-alert-${type}`);
    document.getElementById("appAlertTitle").textContent = opts.title || kind.title;
    document.getElementById("appAlertMessage").textContent = message;
    toast.classList.remove("hidden");
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(showAppAlert.hideTimer);
      clearTimeout(showAppAlert.doneTimer);
      toast.removeEventListener("click", finish);
      toast.classList.remove("visible");
      showAppAlert.doneTimer = setTimeout(() => toast.classList.add("hidden"), 250);
      resolve();
    };
    toast.addEventListener("click", finish);
    requestAnimationFrame(() => toast.classList.add("visible"));
    const duration = Math.min(8000, Math.max(2200, 2200 + String(message || "").length * 35));
    showAppAlert.hideTimer = setTimeout(finish, duration);
  });
}
window.showAppAlert = showAppAlert;

function showAppConfirm(message, opts = {}) {
  return new Promise((resolve) => {
    const dialog = document.getElementById("appConfirmDialog");
    if (!dialog) { resolve(window.confirm(message)); return; }
    document.getElementById("appConfirmTitle").textContent = opts.title || "Confirmar ação";
    document.getElementById("appConfirmMessage").textContent = message;
    const okBtn = document.getElementById("appConfirmOkBtn");
    const cancelBtn = document.getElementById("appConfirmCancelBtn");
    okBtn.textContent = opts.confirmText || "Confirmar";
    cancelBtn.textContent = opts.cancelText || "Cancelar";
    okBtn.className = opts.danger ? "danger-button" : "primary";
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      dialog.removeEventListener("close", onClose);
      dialog.removeEventListener("click", onBackdropClick);
      if (dialog.open) dialog.close();
      resolve(result);
    };
    const onOk = () => finish(true);
    const onCancel = () => finish(false);
    const onClose = () => finish(false);
    const onBackdropClick = (event) => { if (event.target === dialog) finish(false); };
    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
    dialog.addEventListener("close", onClose);
    dialog.addEventListener("click", onBackdropClick);
    dialog.showModal();
  });
}
window.showAppConfirm = showAppConfirm;

window.persistStateNow = persistStateNow;

function clientById(id) {
  return state.clients.find((client) => client.id === id);
}

function normalizeRequesterName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

function requestersForClient(clientId) {
  return (state.clientRequesters || [])
    .filter((item) => item.clientId === clientId && item.active !== false)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

function requesterExists(clientId, name) {
  const normalized = normalizeRequesterName(name);
  return Boolean(normalized && requestersForClient(clientId).some((item) => item.normalizedName === normalized));
}

function addClientRequester(clientId, name) {
  const cleanName = String(name || "").trim().replace(/\s+/g, " ");
  const normalizedName = normalizeRequesterName(cleanName);
  if (!clientId || !normalizedName) return { ok: false, message: "Informe o solicitante." };
  if (requesterExists(clientId, cleanName)) return { ok: false, message: "Este solicitante ja esta cadastrado para este cliente." };
  state.clientRequesters ||= [];
  state.clientRequesters.push({
    id: crypto.randomUUID(),
    clientId,
    name: cleanName,
    normalizedName,
    active: true
  });
  return { ok: true, name: cleanName };
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

function serviceStatusDates(item) {
  const parts = [];
  if (item?.createdAt) parts.push(`Lançado em ${new Date(item.createdAt).toLocaleString("pt-BR")}`);
  if (item?.doneAt) parts.push(`Feito em ${new Date(item.doneAt).toLocaleString("pt-BR")}`);
  if (item?.deliveredAt) parts.push(`Entregue em ${new Date(item.deliveredAt).toLocaleString("pt-BR")}`);
  return parts.join(" · ");
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

function paymentIsCredit(payment) {
  return !payment.billingId && payment.paymentSource === "Credito de pagamento";
}

function paymentAllocationState(payment) {
  if (!payment.billingId) return paymentIsCredit(payment) ? "credit" : "loose";
  const billing = state.billings.find((item) => item.id === payment.billingId);
  if (!billing) return "loose";
  return billingCurrentStatus(billing) === "Paga" ? "linked-paid" : "linked-open";
}

function paymentAllocationLabel(payment) {
  const allocationState = paymentAllocationState(payment);
  if (allocationState === "credit") return "Crédito disponível para o próximo fechamento";
  if (allocationState === "loose") return "Pagamento parcial, ainda sem cobrança vinculada";
  const billing = state.billings.find((item) => item.id === payment.billingId);
  const numberSuffix = billing?.billingNumber ? ` #${billing.billingNumber}` : "";
  return allocationState === "linked-paid"
    ? `Quitação da cobrança${numberSuffix}`
    : `Vinculado à cobrança${numberSuffix} (parcial)`;
}

function paymentLinkedBadgeLabel(payment) {
  const allocationState = paymentAllocationState(payment);
  return allocationState === "linked-paid" ? "Quitação" : "Vinculado";
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

function nextBillingNumber() {
  const highest = state.billings.reduce((max, item) => Math.max(max, Number(item.billingNumber) || 0), 0);
  return highest + 1;
}

function billingNumberLabel(billing) {
  return billing?.billingNumber ? `Cobrança #${billing.billingNumber}` : "";
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

const BILLING_FREQUENCY_LABELS = { semanal: "Semanal", quinzenal: "Quinzenal", mensal: "Mensal" };

function billingFrequencyLabel(frequency) {
  return BILLING_FREQUENCY_LABELS[frequency] || BILLING_FREQUENCY_LABELS.semanal;
}

function daysPastBillingPeriod(billing) {
  const end = new Date(`${billing.endDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - end.getTime()) / 86400000);
}

function isBillingOverdue(billing) {
  return billingOpenAmount(billing) > 0 && daysPastBillingPeriod(billing) > 0;
}

function billingCardStatusClass(billing) {
  const status = billingCurrentStatus(billing);
  if (status === "Consolidada") return "billing-consolidated";
  if (status === "Cancelada") return "";
  if (status === "Paga") return "billing-paid";
  if (isBillingOverdue(billing)) return "billing-overdue-card";
  return "billing-pending";
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
  ["payment", "billing", "financeSummary", "supplierPayable"].forEach((prefix) => {
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
  renderFinanceSummary();
  window.supplierModule?.render();
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
    .filter(isBillingOverdue)
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
  document.querySelectorAll(".view, .tab, .mobile-bottom-nav-button").forEach((element) => element.classList.remove("active"));
  document.getElementById(viewId).classList.add("active");
  const clientViews = ["clients", "catalog", "services", "requests"];
  const financeViews = ["payments", "paymentMethods", "billing", "financeSummary"];
  const mainView = clientViews.includes(viewId) ? "services" : financeViews.includes(viewId) ? "payments" : viewId;
  document.querySelectorAll(`[data-view="${mainView}"]`).forEach((element) => element.classList.add("active"));
  document.querySelectorAll("[data-client-view]").forEach((button) => {
    const target = button.dataset.clientView;
    button.classList.toggle("active", target === viewId);
  });
  document.querySelectorAll(".finance-area-tabs [data-client-view]").forEach((button) => {
    const target = button.dataset.clientView;
    button.classList.toggle("active", target === viewId);
  });
}

function applyNotificationDeepLink() {
  const target = location.hash.replace(/^#/, "");
  if (!target || !document.getElementById(target)) return;
  showView(target);
  history.replaceState(null, "", location.pathname + location.search);
}

function emptyMarkup() {
  return document.getElementById("emptyTemplate").innerHTML;
}

function searchableText(...values) {
  return values.join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
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
  const clientDatalistOptions = [...state.clients]
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .map((client) => `<option value="${escapeHtml(clientOptionLabel(client))}"></option>`)
    .join("");
  document.getElementById("serviceClientOptions").innerHTML = clientDatalistOptions;
  document.getElementById("serviceClientFilterOptions").innerHTML = clientDatalistOptions;
  updateServiceRequesterOptions();
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

function updateServiceRequesterOptions() {
  const form = document.getElementById("serviceForm");
  const datalist = document.getElementById("serviceRequesterOptions");
  if (!form || !datalist) return;
  const clientId = form.elements.clientId.value;
  datalist.innerHTML = requestersForClient(clientId)
    .map((item) => `<option value="${escapeHtml(item.name)}"></option>`)
    .join("");
}

function toggleServiceRequesterSection() {
  const form = document.getElementById("serviceForm");
  const enabled = Boolean(form.elements.hasRequester?.checked);
  document.getElementById("serviceRequesterSection")?.classList.toggle("hidden", !enabled);
  if (!enabled) form.elements.requestedBy.value = "";
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
  const pending = state.services.filter((item) => item.status === "A fazer" && !item.isSecondary);
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
    overdueDays: daysPastBillingPeriod(billing),
    currentStatus: billingCurrentStatus(billing)
  }));
  const openBillings = billings.filter((billing) => billing.openAmount > 0);
  const overdueBillings = openBillings.filter(isBillingOverdue);
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
      <article class="${overdueBillings.length ? "alert-danger" : ""}"><span>Em atraso</span><strong>${money.format(overdueTotal)}</strong><small>${overdueBillings.length} cobrança(s)</small></article>
    </div>
    ${overdueBillings.length ? `<div class="alert-list">${overdueBillings.slice(0, 5).map((billing) => `
      <div><strong>${escapeHtml(clientById(billing.clientId)?.name || "")}</strong><span>${money.format(billing.openAmount)} · ${billing.overdueDays} dia(s) de atraso</span></div>`).join("")}</div>
      <button class="table-action alert-link" data-payment-dashboard-filter="overdue">Ver todas as atrasadas</button>`
    : `<p class="meta">Nenhuma cobrança está em atraso.</p>`}`;

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
    const count = state.services.filter((item) => item.clientId === client.id && !item.isSecondary).length;
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
  document.getElementById("dashboardServicesCards").classList.toggle("hidden", activeDashboardTab !== "services");
  document.getElementById("dashboardServicesCharts").classList.toggle("hidden", activeDashboardTab !== "services");
  document.getElementById("dashboardFinanceCards").classList.toggle("hidden", activeDashboardTab !== "finance");
  document.getElementById("dashboardFinanceCharts").classList.toggle("hidden", activeDashboardTab !== "finance");
  document.getElementById("dashboardFinanceSummary").classList.toggle("hidden", activeDashboardTab !== "finance");
  document.getElementById("dashboardSuppliersPanel").classList.toggle("hidden", activeDashboardTab !== "suppliers");
  document.querySelector(".dashboard-period-controls").classList.toggle("hidden", activeDashboardTab === "suppliers");
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
  const supplierEntriesFor = (range) => state.supplierEntries.filter((item) =>
    item.status !== "Cancelado" && inPeriod(item.date, range));
  const serviceMetrics = (range) => {
    const services = servicesFor(range);
    const primaryServices = services.filter((item) => !item.isSecondary);
    const supplierEntries = supplierEntriesFor(range);
    return {
      services,
      primaryServices,
      supplierEntries,
      pending: primaryServices.filter((item) => item.status === "A fazer"),
      done: primaryServices.filter((item) => item.status === "Pronto"),
      delivered: primaryServices.filter((item) => item.status === "Entregue"),
      primaryTotal: primaryServices.reduce((sum, item) => sum + Number(item.amount), 0),
      supplierTotal: supplierEntries.reduce((sum, item) => sum + Number(item.amount), 0),
      total: services.reduce((sum, item) => sum + Number(item.amount), 0)
    };
  };
  const serviceCards = (metrics) => {
    const card = (label, items, className, statusValue) => `
      <article class="metric-card dashboard-status-card ${className}" data-service-status-shortcut="${statusValue}" role="button" tabindex="0" title="Ver estes lançamentos">
        <span>${label}</span><strong>${items.length}</strong>
        <small>${money.format(items.reduce((sum, item) => sum + Number(item.amount), 0))}</small>
      </article>`;
    return `${card("A fazer", metrics.pending, "metric-pending", "A fazer")}
      ${card("Feitos", metrics.done, "metric-done", "Pronto")}
      ${card("Entregues", metrics.delivered, "metric-delivered", "Entregue")}
      <article class="metric-card metric-supplier" data-open-view="suppliers" role="button" tabindex="0" title="Ver fornecedores"><span>Serviços Fornecedores</span><strong>${metrics.supplierEntries.length}</strong><small>${money.format(metrics.supplierTotal)}</small></article>
      <article class="metric-card metric-main" data-service-status-shortcut="" role="button" tabindex="0" title="Ver lançamentos"><span>Total de serviços</span><strong>${metrics.primaryServices.length}</strong><small>${money.format(metrics.primaryTotal)}</small></article>`;
  };

  const weekServices = serviceMetrics(week);
  const periodServices = serviceMetrics(period);
  document.getElementById("serviceWeekLabel").textContent = periodLabel(week);
  document.getElementById("servicePeriodLabel").textContent = periodLabel(period);
  document.getElementById("serviceWeekCards").innerHTML = serviceCards(weekServices);
  document.getElementById("servicePeriodCards").innerHTML = serviceCards(periodServices);

  const statusTotal = periodServices.primaryServices.length || 1;
  const pendingDegrees = periodServices.pending.length / statusTotal * 360;
  const doneDegrees = periodServices.done.length / statusTotal * 360;
  document.getElementById("serviceStatusDashboardChart").innerHTML = `
    <div class="donut-chart service-donut" style="--pending:${pendingDegrees}deg;--done:${pendingDegrees + doneDegrees}deg">
      <div><strong>${periodServices.primaryServices.length}</strong><span>serviços</span></div>
    </div>
    <div class="chart-legend">
      <button><i class="legend-service-pending"></i><span>A fazer</span><strong>${periodServices.pending.length}</strong></button>
      <button><i class="legend-service-done"></i><span>Feitos</span><strong>${periodServices.done.length}</strong></button>
      <button><i class="legend-service-delivered"></i><span>Entregues</span><strong>${periodServices.delivered.length}</strong></button>
    </div>`;

  const volumeDates = dateKeysBetween(period.startDate, period.endDate, 31);
  const dailyVolumes = volumeDates.map((date) => ({
    date,
    count: periodServices.primaryServices.filter((item) => item.date === date).length
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
    const primaryServices = services.filter((item) => !item.isSecondary);
    return {
      client,
      count: primaryServices.length,
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

  const pending = state.services.filter((item) => item.status === "A fazer" && !item.isSecondary);
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
    <article class="metric-card metric-main" data-open-view="payments" role="button" tabindex="0" title="Abrir Pagamentos"><span>Saldo do período</span><strong>${money.format(metrics.balance)}</strong><small>Serviços menos baixas deste período</small></article>
    <article class="metric-card" data-open-view="services" role="button" tabindex="0" title="Abrir Lançamentos"><span>Serviços lançados</span><strong>${money.format(metrics.servicesTotal)}</strong><small>Produção no período</small></article>
    <article class="metric-card" data-open-view="payments" role="button" tabindex="0" title="Abrir Pagamentos"><span>Pagamentos</span><strong>${money.format(metrics.paymentTotal)}</strong><small>Recebimentos no período</small></article>
    <article class="metric-card" data-open-view="billing" role="button" tabindex="0" title="Abrir Cobranças"><span>Cobranças geradas</span><strong>${metrics.billings.length}</strong><small>Fechamentos no período</small></article>`;
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
  const overdueBillings = openBillings.filter(isBillingOverdue);
  const billingAlertPanel = document.getElementById("billingAlertPanel");
  billingAlertPanel.classList.toggle("has-alerts", overdueBillings.length > 0);
  billingAlertPanel.innerHTML = `
    <div class="panel-title"><div><span class="eyebrow">Alertas financeiros</span><h2>Cobranças em aberto</h2></div><button class="table-action" data-payment-dashboard-filter="open">Ver pagamentos</button></div>
    <div class="alert-summary finance-alert-summary"><article><span>Em aberto</span><strong>${money.format(openBillings.reduce((sum, item) => sum + item.openAmount, 0))}</strong><small>${openBillings.length} cobrança(s)</small></article><article class="${overdueBillings.length ? "alert-danger" : ""}"><span>Em atraso</span><strong>${money.format(overdueBillings.reduce((sum, item) => sum + item.openAmount, 0))}</strong><small>${overdueBillings.length} cobrança(s)</small></article></div>`;

  const periodAccounts = state.clients.map((client) => {
    const serviceAmount = periodServices.services.filter((item) => item.clientId === client.id)
      .reduce((sum, item) => sum + Number(item.amount), 0);
    const paymentAmount = paymentsAppliedFor(period).filter((item) => item.clientId === client.id)
      .reduce((sum, item) => sum + Number(item.amount), 0);
    return { client, serviceAmount, paymentAmount, balance: serviceAmount - paymentAmount };
  }).filter((item) => item.serviceAmount || item.paymentAmount).sort((a, b) => b.balance - a.balance);
  document.getElementById("accountList").innerHTML = periodAccounts.length ? periodAccounts.map((item) => `
    <div class="account-row"><div><strong>${escapeHtml(item.client.name)}</strong><span class="meta">${escapeHtml(item.client.priceGroup)}</span></div><span class="meta">${money.format(item.serviceAmount)} / abatido ${money.format(item.paymentAmount)}</span><strong class="amount ${item.balance < 0 ? "negative" : ""}">${money.format(item.balance)}</strong></div>`).join("") : emptyMarkup();

  renderDashboardAttention();
  renderDashboardFinanceSummary();
}

function renderDashboardAttention() {
  const strip = document.getElementById("dashboardAttention");
  if (!strip) return;
  const overdueBillings = currentBillings().filter(isBillingOverdue);
  const overdueTotal = overdueBillings.reduce((sum, billing) => sum + billingOpenAmount(billing), 0);
  const lateServices = state.services.filter(isOverdueService);
  const newRequests = (state.serviceRequests || []).filter((item) => item.status === "Novo");
  const chips = [];
  if (overdueBillings.length) {
    chips.push(`<button type="button" class="attention-chip attention-danger" data-attention="overdue-billings">
      <strong>${overdueBillings.length}</strong> cobrança(s) atrasada(s) · ${money.format(overdueTotal)}</button>`);
  }
  if (lateServices.length) {
    chips.push(`<button type="button" class="attention-chip attention-warning" data-attention="overdue-services">
      <strong>${lateServices.length}</strong> serviço(s) há mais de 24h</button>`);
  }
  if (newRequests.length) {
    chips.push(`<button type="button" class="attention-chip attention-info" data-attention="new-requests">
      <strong>${newRequests.length}</strong> pedido(s) novo(s) de cliente</button>`);
  }
  strip.classList.toggle("hidden", !chips.length);
  strip.innerHTML = chips.length ? `<span class="attention-strip-label">Precisa de atenção</span>${chips.join("")}` : "";
}

function renderDashboardFinanceSummary() {
  const strip = document.getElementById("dashboardFinanceSummary");
  if (!strip) return;
  const openBillings = currentBillings().filter((billing) => billingOpenAmount(billing) > 0);
  const openTotal = openBillings.reduce((sum, billing) => sum + billingOpenAmount(billing), 0);
  const overdueTotal = openBillings.filter(isBillingOverdue).reduce((sum, billing) => sum + billingOpenAmount(billing), 0);
  const today = localDateKey(new Date());
  const receivedToday = state.payments
    .filter((payment) => payment.date === today)
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  strip.innerHTML = `
    <button type="button" data-payment-dashboard-filter="open" title="Abrir Pagamentos"><span>Em aberto</span><strong>${money.format(openTotal)}</strong></button>
    <button type="button" class="${overdueTotal > 0 ? "summary-danger" : ""}" data-attention="overdue-billings" title="Ver cobranças atrasadas"><span>Atrasado</span><strong>${money.format(overdueTotal)}</strong></button>
    <button type="button" class="summary-received" data-open-view="payments" title="Abrir Pagamentos"><span>Recebido hoje</span><strong>${money.format(receivedToday)}</strong></button>`;
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
      detail: `${money.format(billingOpenAmount(billing))} - ${daysPastBillingPeriod(billing)} dia(s) de atraso`
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
    matchesSearch(search, client.name, client.phone, client.priceGroup, client.document, client.email, client.city));
  target.innerHTML = items.length ? items.map((client) => {
    const balance = balanceFor(client.id);
    const clientOverdue = state.billings.some((billing) => billing.clientId === client.id && isBillingOverdue(billing));
    return `
    <article class="client-card ${clientOverdue ? "client-overdue" : ""}">
      <h3>${escapeHtml(client.name)}</h3>
      <p class="meta">${escapeHtml(client.phone)}</p>
      ${client.document ? `<p class="meta">${escapeHtml(client.document)}</p>` : ""}
      ${client.email ? `<p class="meta">${escapeHtml(client.email)}</p>` : ""}
      ${client.city || client.state ? `<p class="meta">${escapeHtml([client.city, client.state].filter(Boolean).join(" - "))}</p>` : ""}
      <span class="badge">${escapeHtml(client.priceGroup)}</span>
      <span class="badge">${billingFrequencyLabel(client.billingFrequency)}</span>
      <div class="access-box">Saldo atual: <strong class="${balance > 0 ? "client-balance-due" : ""}">${money.format(balance)}</strong></div>
      <div class="card-actions">
        <button class="table-action" data-edit-client="${client.id}">Editar</button>
        <button class="table-action" data-manage-client-requesters="${client.id}">Gerenciar solicitantes</button>
        <button class="table-action danger" data-delete-client="${client.id}">Excluir</button>
      </div>
    </article>`;
  }).join("") : emptyMarkup();
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
  const groupKey = (item) => item.serviceGroupId
    ? `${item.serviceGroupId}:${item.reference || ""}`
    : item.id;
  const generallyEligible = state.services
    .filter((item) => !clientFilter || item.clientId === clientFilter)
    .filter((item) => !clientNameFilter || matchesSearch(clientNameFilter, clientById(item.clientId)?.name))
    .filter((item) => searchAcrossHistory || !startDate || item.date >= startDate)
    .filter((item) => searchAcrossHistory || !endDate || item.date <= endDate);
  const matchingGroupKeys = new Set(generallyEligible
    .filter((item) => !statusFilter || item.status === statusFilter)
    .filter((item) => matchesSearch(
      search,
      item.description,
      item.reference,
      item.requestedBy,
      clientById(item.clientId)?.name,
      serviceStatusLabel(item.status)
    ))
    .map(groupKey));
  const groupedItems = Object.values(generallyEligible.reduce((groups, item) => {
    const key = groupKey(item);
    if (!matchingGroupKeys.has(key)) return groups;
    (groups[key] ||= []).push(item);
    return groups;
  }, {})).map((group) => {
    const primary = group.find((item) => !item.isSecondary) || group[0];
    const complementary = group.filter((item) => item.id !== primary.id);
    const ordered = primary.status === "Cancelado" && complementary.some((item) => item.status !== "Cancelado")
      ? [...complementary, primary]
      : [primary, ...complementary];
    return { primary, ordered };
  }).sort((a, b) => {
    const statusOrder = { "A fazer": 0, Pronto: 1, Entregue: 2, Cancelado: 3 };
    const statusDifference = (statusOrder[a.primary.status] ?? 4) - (statusOrder[b.primary.status] ?? 4);
    return statusDifference || b.primary.date.localeCompare(a.primary.date)
      || String(b.primary.createdAt || "").localeCompare(String(a.primary.createdAt || ""));
  });

  const serviceItemMarkup = (item, linked = false) => `
    <article class="timeline-item ${linked ? "linked-service-entry" : ""} ${isOverdueService(item) ? "service-overdue" : ""} ${item.isSecondary ? "secondary-service" : ""}">
      <time>${dateFormat.format(new Date(`${item.date}T00:00:00Z`))}</time>
      <div>
        <h3 class="service-card-description">${escapeHtml(item.description)}</h3>
        <p class="service-card-reference">${escapeHtml(item.reference || "Sem referência")}</p>
        <p class="meta service-card-context">${escapeHtml(clientById(item.clientId)?.name || "")}</p>
        ${item.requestedBy ? `<p class="meta">Solicitante: ${escapeHtml(item.requestedBy)}</p>` : ""}
        ${originCancelledNote(item) ? `<span class="origin-cancelled-label">${escapeHtml(originCancelledNote(item))}</span>` : ""}
        <span class="status status-${item.status.toLowerCase().replace(" ", "-")}">${escapeHtml(serviceStatusLabel(item.status))}</span>${item.isSecondary ? `<span class="secondary-service-label">Serviço complementar</span>` : ""}${isOverdueService(item) ? `<span class="overdue-label">${formatServiceAge(item)}</span>` : ""}${item.confirmationRequestedAt && item.status === "Pronto" ? `<span class="confirmation-label">Confirmação solicitada</span>` : ""}${item.deliveredAt ? `<span class="delivered-label">${escapeHtml(deliveredLabel(item))}</span>` : ""}${serviceStatusDates(item) ? `<p class="service-status-dates">${escapeHtml(serviceStatusDates(item))}</p>` : ""}${item.status === "Cancelado" ? `<p class="cancellation-reason"><strong>Motivo:</strong> ${escapeHtml(item.cancellationReason || "Não informado")}${item.cancellationOriginalAmount !== null && item.cancellationOriginalAmount !== undefined ? ` · Valor anterior: ${money.format(item.cancellationOriginalAmount)}` : ""}</p>` : ""}
      </div>
      <strong>${money.format(item.amount)}</strong>
      <div class="service-actions">
        <div class="status-actions">
          ${item.status === "A fazer" ? `<button class="table-action success" data-service-status="Pronto" data-entry-id="${item.id}">Marcar feito</button>` : ""}
          ${item.status === "Pronto" ? `<button class="table-action" data-request-delivery="${item.id}">Solicitar confirmação</button>` : ""}
          ${item.status === "Pronto" ? `<button class="table-action success" data-service-status="Entregue" data-entry-id="${item.id}">Marcar entregue</button>` : ""}
          ${item.status === "Pronto" ? `<button class="table-action" data-service-status="A fazer" data-entry-id="${item.id}">Voltar para A fazer</button>` : ""}
          ${item.status === "Entregue" ? `<button class="table-action" data-service-status="Pronto" data-entry-id="${item.id}">Voltar para Feito</button>` : ""}
        </div>
        <button class="mobile-service-more" type="button" data-toggle-service-actions="${item.id}" aria-expanded="false">Mais opcoes</button>
        <div class="row-actions">
          ${item.status !== "Cancelado" ? `<button class="table-action" data-edit-entry="${item.id}">Editar</button><button class="table-action danger" data-cancel-entry="${item.id}">Cancelar</button>` : ""}
          <button class="table-action danger" data-delete-entry="${item.id}">Excluir</button>
        </div>
      </div>
    </article>`;
  document.getElementById("serviceList").innerHTML = groupedItems.length
    ? groupedItems.map(({ ordered }) => ordered.length > 1
      ? `<section class="linked-service-group">${ordered.map((item) => serviceItemMarkup(item, true)).join("")}</section>`
      : serviceItemMarkup(ordered[0])).join("")
    : emptyMarkup();
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
      if (statusFilter === "overdue") return isBillingOverdue(billing);
      if (statusFilter === "paid") return billing.currentStatus === "Paga";
      return true;
    })
    .filter((billing) => matchesSearch(
      search,
      clientById(billing.clientId)?.name,
      billing.currentStatus,
      billing.identifier,
      billing.billingNumber ? `#${billing.billingNumber}` : ""
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

  function billingRowMarkup(billing) {
    const canPay = billing.openAmount > 0 && billing.currentStatus !== "Cancelada";
    return `
    <article class="timeline-item ${billingCardStatusClass(billing)}">
      <time>${formatDate(billing.endDate)}</time>
      <div>
        <h3>${escapeHtml(clientById(billing.clientId)?.name || "")}</h3>
        <p class="meta">${billing.billingNumber ? `Cobrança #${billing.billingNumber} · ` : ""}${formatDate(billing.startDate)} a ${formatDate(billing.endDate)}</p>
        <p class="meta">${escapeHtml(billing.statusReason || (billing.currentStatus === "Paga" ? "Quitada pelos pagamentos vinculados" : "Aguardando pagamento"))}</p>
        ${isBillingOverdue(billing) ? `<p class="overdue-message">Em atraso há ${daysPastBillingPeriod(billing)} dia(s).</p>` : ""}
      </div>
      <strong>${money.format(billing.openAmount)}</strong>
      <div class="row-actions">
        <span class="billing-status billing-${billing.currentStatus.toLowerCase()}">${billing.currentStatus}</span>
        ${canPay ? `<button class="table-action" data-pay-billing="${billing.id}" data-payment-mode="partial">Baixa parcial</button><button class="table-action success" data-pay-billing="${billing.id}" data-payment-mode="full">Quitar</button>` : ""}
      </div>
    </article>`;
  }

  const billingGroups = [];
  const billingGroupIndex = new Map();
  billings.forEach((billing) => {
    const key = billing.clientId || "";
    if (!billingGroupIndex.has(key)) {
      billingGroupIndex.set(key, billingGroups.length);
      billingGroups.push({ name: clientById(key)?.name || "Sem cliente", billings: [] });
    }
    billingGroups[billingGroupIndex.get(key)].billings.push(billing);
  });
  billingGroups.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  document.getElementById("openBillingList").innerHTML = billings.length ? billingGroups.map((group) => `
    <div class="payment-group-heading">${escapeHtml(group.name)} <span class="payment-group-count">${group.billings.length}</span></div>
    ${group.billings.map(billingRowMarkup).join("")}`).join("") : emptyMarkup();

  const items = state.payments
    .filter((item) => !clientFilter || item.clientId === clientFilter)
    .filter((item) => !startFilter || item.date >= startFilter)
    .filter((item) => !endFilter || item.date <= endFilter)
    .filter((item) => matchesSearch(search, clientById(item.clientId)?.name, item.note))
    .sort((a, b) => b.date.localeCompare(a.date));

  function paymentItemMarkup(item) {
    const allocationState = paymentAllocationState(item);
    return `
    <article class="timeline-item ${item.billingId ? "payment-applied" : ""}">
      <time>${dateFormat.format(new Date(`${item.date}T00:00:00Z`))}</time>
      <div><h3>${escapeHtml(clientById(item.clientId)?.name || "")}</h3><p class="meta">${escapeHtml(item.note || "Pagamento registrado")}</p><span class="payment-origin">${escapeHtml(item.method || "Forma não informada")} · ${escapeHtml(item.paymentSource || "Manual")}</span><p class="payment-allocation ${allocationState}">${escapeHtml(paymentAllocationLabel(item))}</p></div>
      <strong>${money.format(item.amount)}</strong>
      <div class="row-actions">${item.billingId ? `<span class="applied-badge">${paymentLinkedBadgeLabel(item)}</span>` : `<button class="table-action" data-edit-payment="${item.id}">Editar</button>`}<button class="table-action danger" data-delete-payment="${item.id}">Excluir</button></div>
    </article>`;
  }

  const paymentGroups = [];
  const paymentGroupIndex = new Map();
  items.forEach((item) => {
    const key = item.clientId || "";
    if (!paymentGroupIndex.has(key)) {
      paymentGroupIndex.set(key, paymentGroups.length);
      paymentGroups.push({ name: clientById(key)?.name || "Sem cliente", payments: [] });
    }
    paymentGroups[paymentGroupIndex.get(key)].payments.push(item);
  });
  paymentGroups.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  document.getElementById("paymentList").innerHTML = items.length ? paymentGroups.map((group) => `
    <div class="payment-group-heading">${escapeHtml(group.name)} <span class="payment-group-count">${group.payments.length}</span></div>
    ${group.payments.map(paymentItemMarkup).join("")}`).join("") : emptyMarkup();
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
  const startFilter = billingOverdueOnly
    ? document.getElementById("billingOverdueStartFilter").value
    : document.getElementById("billingStartFilter").value;
  const endFilter = billingOverdueOnly
    ? document.getElementById("billingOverdueEndFilter").value
    : document.getElementById("billingEndFilter").value;
  const search = document.getElementById("billingSearch").value.trim();

  const overdueCount = currentBillings().filter(isBillingOverdue).length;
  document.getElementById("billingOverdueCount").textContent = overdueCount;
  document.getElementById("billingOverdueTab").classList.toggle("active", billingOverdueOnly);
  document.getElementById("billingOverdueTab").classList.toggle("has-overdue", overdueCount > 0);
  document.querySelectorAll("#billing [data-finance-period]").forEach((button) => {
    button.classList.toggle("active", !billingOverdueOnly && button.dataset.financePeriod === financePeriodMode);
  });
  document.getElementById("billingStartFilter").classList.toggle("hidden", billingOverdueOnly);
  document.getElementById("billingEndFilter").classList.toggle("hidden", billingOverdueOnly);
  document.getElementById("billingOverdueStartFilter").classList.toggle("hidden", !billingOverdueOnly);
  document.getElementById("billingOverdueEndFilter").classList.toggle("hidden", !billingOverdueOnly);
  document.getElementById("billingOverdueClearDates").classList.toggle("hidden", !billingOverdueOnly);
  document.getElementById("billingStatusFilter").classList.toggle("hidden", billingOverdueOnly);
  const deleteClientButton = document.getElementById("billingDeleteClientButton");
  const clientBillingCount = clientFilter ? state.billings.filter((item) => item.clientId === clientFilter).length : 0;
  deleteClientButton.classList.toggle("hidden", !clientFilter || !clientBillingCount);
  deleteClientButton.textContent = `Excluir ${clientBillingCount} cobrança(s) deste cliente`;
  deleteClientButton.dataset.clientId = clientFilter || "";
  const accessBillingByClient = new Map();
  state.billings
    .filter((billing) => billing.status !== "Cancelada")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .forEach((billing) => accessBillingByClient.set(billing.clientId, billing.id));
  const items = state.billings
    .filter((item) => !clientFilter || item.clientId === clientFilter)
    .filter((item) => !billingOverdueOnly || isBillingOverdue(item))
    .filter((item) => !startFilter || item.endDate >= startFilter)
    .filter((item) => !endFilter || item.endDate <= endFilter)
    .filter((item) => {
      if (billingOverdueOnly) return true;
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
      item.endDate,
      item.billingNumber ? `#${item.billingNumber}` : ""
    ))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  document.getElementById("billingPeriodLabel").textContent = billingOverdueOnly
    ? `${items.length} cobrança(s) em atraso`
    : periodLabel(ensureFinancePeriod());
  document.getElementById("billingList").innerHTML = items.length ? items.map((item) => `
    <article class="billing-card ${billingCardStatusClass(item)}">
      <span class="eyebrow">${item.billingNumber ? `Cobrança #${item.billingNumber} · ` : ""}${item.startDate.split("-").reverse().join("/")} a ${item.endDate.split("-").reverse().join("/")}</span>
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

// Saldo anterior ao periodo: cobrancas fechadas antes do periodo que ainda tem saldo,
// somando de volta o que foi pago DENTRO do periodo (esse valor volta a aparecer em
// "pagamentos do periodo", sem duplicar - a baixa so aparece uma vez no total final).
function previousBalanceFor(clientId, startFilter) {
  return state.billings
    .filter((billing) => billing.clientId === clientId && billing.endDate < startFilter)
    .filter((billing) => {
      const status = billingCurrentStatus(billing);
      return status !== "Cancelada" && status !== "Consolidada";
    })
    .reduce((sum, billing) => {
      const paidInPeriod = state.payments
        .filter((payment) => payment.billingId === billing.id && payment.date >= startFilter)
        .reduce((total, payment) => total + Number(payment.amount), 0);
      return sum + billingOpenAmount(billing) + paidInPeriod;
    }, 0);
}

function renderFinanceSummary() {
  const period = ensureFinancePeriod();
  const clientFilter = document.getElementById("financeSummaryClientFilter").value;
  const startFilter = document.getElementById("financeSummaryStartFilter").value || period.startDate;
  const endFilter = document.getElementById("financeSummaryEndFilter").value || period.endDate;
  const search = document.getElementById("financeSummarySearch").value.trim();
  document.getElementById("financeSummaryPeriodLabel").textContent = periodLabel({ startDate: startFilter, endDate: endFilter });

  const rows = state.clients
    .filter((client) => !clientFilter || client.id === clientFilter)
    .map((client) => {
      const previousBalance = previousBalanceFor(client.id, startFilter);
      const periodServiceTotal = state.services
        .filter((item) => item.clientId === client.id && item.status !== "Cancelado"
          && item.date >= startFilter && item.date <= endFilter)
        .reduce((sum, item) => sum + Number(item.amount), 0);
      const periodPaymentTotal = state.payments
        .filter((item) => item.clientId === client.id && item.date >= startFilter && item.date <= endFilter)
        .reduce((sum, item) => sum + Number(item.amount), 0);
      return {
        client,
        previousBalance,
        periodServiceTotal,
        periodPaymentTotal,
        openBalance: previousBalance + periodServiceTotal - periodPaymentTotal
      };
    })
    .filter((row) => row.previousBalance || row.periodServiceTotal || row.periodPaymentTotal || Math.abs(row.openBalance) > 0.005)
    .filter((row) => matchesSearch(search, row.client.name))
    .sort((a, b) => b.openBalance - a.openBalance);

  const totals = rows.reduce((sum, row) => ({
    previous: sum.previous + row.previousBalance,
    services: sum.services + row.periodServiceTotal,
    payments: sum.payments + row.periodPaymentTotal,
    open: sum.open + Math.max(0, row.openBalance)
  }), { previous: 0, services: 0, payments: 0, open: 0 });

  document.getElementById("financeSummaryTotals").innerHTML = `
    <article class="metric-card"><span>Cobrança anterior</span><strong>${money.format(totals.previous)}</strong><small>Saldo de antes do período</small></article>
    <article class="metric-card"><span>Consumo do período</span><strong>${money.format(totals.services)}</strong><small>${rows.length} cliente(s)</small></article>
    <article class="metric-card"><span>Pago no período</span><strong>${money.format(totals.payments)}</strong></article>
    <article class="metric-card finance-open-card ${totals.open > 0 ? "has-open" : ""}"><span>Saldo em aberto acumulado</span><strong>${money.format(totals.open)}</strong></article>`;

  document.getElementById("financeSummaryList").innerHTML = rows.length ? rows.map((row) => `
    <div class="account-row">
      <div><strong>${escapeHtml(row.client.name)}</strong><span class="meta">${escapeHtml(row.client.priceGroup || "")}</span></div>
      <span class="meta">Cobrança anterior ${money.format(row.previousBalance)} · Consumo ${money.format(row.periodServiceTotal)} · Pago ${money.format(row.periodPaymentTotal)}</span>
      <strong class="amount ${row.openBalance < 0 ? "negative" : ""}">${money.format(row.openBalance)}</strong>
    </div>`).join("") : emptyMarkup();
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
  showAppAlert(`${label} copiado.`, { type: "success" });
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
  renderFinanceSummary();
  window.supplierModule?.render();
}

function renderSystemSettings() {
  const startSelect = document.getElementById("weekStartDay");
  const endSelect = document.getElementById("weekEndDay");
  if (!startSelect || !endSelect) return;
  startSelect.value = String(systemSettings.weekStartDay ?? 0);
  endSelect.value = String(systemSettings.weekEndDay ?? 5);
  const askEntryContinuationCheckbox = document.getElementById("settingsAskEntryContinuation");
  if (askEntryContinuationCheckbox) askEntryContinuationCheckbox.checked = systemSettings.askEntryContinuation !== false;
  const offerSupplierShareCheckbox = document.getElementById("settingsOfferSupplierShare");
  if (offerSupplierShareCheckbox) offerSupplierShareCheckbox.checked = systemSettings.offerSupplierShare !== false;
  applyTheme();
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

function renderBillingWizardSummary() {
  const form = document.getElementById("billingForm");
  const target = document.getElementById("billingWizardSummary");
  if (!target) return;
  const client = clientById(form.elements.clientId.value);
  const methodCount = form.querySelectorAll('input[name="paymentMethodId"]:checked').length;
  const rows = [
    ["Cliente", clientOptionLabel(client) || "-"],
    ["Período", `${formatDate(form.elements.startDate.value)} a ${formatDate(form.elements.endDate.value)}`],
    ["Formas de pagamento", `${methodCount} selecionada(s)`],
    ["Consulta anterior", form.elements.historyEnabled.checked ? "Sim" : "Não"]
  ];
  target.innerHTML = rows
    .map(([label, value]) => `<div class="wizard-summary-row"><span class="wizard-summary-label">${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join("");
}

const billingWizard = createDialogWizard({
  dialogId: "billingDialog",
  formId: "billingForm",
  navId: "billingWizardNav",
  progressFillId: "billingWizardProgressFill",
  progressLabelId: "billingWizardProgressLabel",
  stepCount: 5,
  lastStepLabel: "Fechar período",
  onReachLastStep: renderBillingWizardSummary,
  pickers: {
    clientSearch: {
      searchField: "clientSearch",
      idField: "clientId",
      items: () => state.clients.map((client) => ({ id: client.id, label: clientOptionLabel(client) })),
      onApply: () => syncBillingClientSelection()
    }
  },
  validateStep: (step, form) => {
    if (step === 1) {
      syncBillingClientSelection();
      if (!form.elements.clientId.value) {
        showAppAlert("Selecione um cliente válido da lista.", { type: "warning" });
        form.elements.clientSearch.focus();
        return false;
      }
    }
    if (step === 2) {
      if (!form.elements.startDate.value || !form.elements.endDate.value) {
        showAppAlert("Informe o período (data inicial e final).", { type: "warning" });
        return false;
      }
      if (form.elements.endDate.value < form.elements.startDate.value) {
        showAppAlert("A data final deve ser igual ou depois da data inicial.", { type: "warning" });
        return false;
      }
    }
    if (step === 3) {
      if (!form.querySelectorAll('input[name="paymentMethodId"]:checked').length) {
        showAppAlert("Selecione pelo menos uma forma de pagamento.", { type: "warning" });
        return false;
      }
    }
    return true;
  }
});

function renderBillingBatchWizardSummary() {
  const form = document.getElementById("billingBatchForm");
  const target = document.getElementById("billingBatchWizardSummary");
  if (!target) return;
  const methodCount = form.querySelectorAll('input[name="paymentMethodId"]:checked').length;
  const rows = [
    ["Período", `${formatDate(form.elements.startDate.value)} a ${formatDate(form.elements.endDate.value)}`],
    ["Formas de pagamento", `${methodCount} selecionada(s)`],
    ["Consulta anterior", form.elements.historyEnabled.checked ? "Sim" : "Não"]
  ];
  target.innerHTML = rows
    .map(([label, value]) => `<div class="wizard-summary-row"><span class="wizard-summary-label">${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join("");
}

const billingBatchWizard = createDialogWizard({
  dialogId: "billingBatchDialog",
  formId: "billingBatchForm",
  navId: "billingBatchWizardNav",
  progressFillId: "billingBatchWizardProgressFill",
  progressLabelId: "billingBatchWizardProgressLabel",
  stepCount: 4,
  lastStepLabel: "Gerar para todos",
  onReachLastStep: renderBillingBatchWizardSummary,
  validateStep: (step, form) => {
    if (step === 1) {
      if (!form.elements.startDate.value || !form.elements.endDate.value) {
        showAppAlert("Informe o período (data inicial e final).", { type: "warning" });
        return false;
      }
      if (form.elements.endDate.value < form.elements.startDate.value) {
        showAppAlert("A data final deve ser igual ou depois da data inicial.", { type: "warning" });
        return false;
      }
    }
    if (step === 2) {
      if (!form.querySelectorAll('input[name="paymentMethodId"]:checked').length) {
        showAppAlert("Selecione pelo menos uma forma de pagamento.", { type: "warning" });
        return false;
      }
    }
    return true;
  }
});

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
      ${service.locked
        ? `<span class="locked-service-note" title="Já está em uma cobrança e não pode ser removido aqui">Em cobrança</span>`
        : `<button type="button" data-remove-additional-service="${index}" aria-label="Remover serviço complementar">×</button>`}
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

function resolveAdditionalCatalogSearchOnEnter() {
  const form = document.getElementById("serviceForm");
  syncAdditionalCatalogSelection();
  const catalogItem = state.catalog.find((item) => item.id === form.elements.additionalCatalogId.value);
  if (catalogItem) form.elements.additionalCatalogSearch.value = catalogOptionLabel(catalogItem);
  return Boolean(catalogItem);
}

function addAdditionalService() {
  const form = document.getElementById("serviceForm");
  syncAdditionalCatalogSelection();
  const catalogId = form.elements.additionalCatalogId.value;
  const amount = Number(form.elements.additionalAmount.value);
  if (!catalogId) {
    showAppAlert("Selecione um serviço complementar válido.", { type: "warning" });
    form.elements.additionalCatalogSearch.focus();
    return false;
  }
  if (catalogId === form.elements.catalogId.value) {
    showAppAlert("O serviço complementar deve ser diferente do serviço principal.", { type: "warning" });
    return false;
  }
  if (additionalServiceValues.some((item) => item.catalogId === catalogId)) {
    showAppAlert("Este serviço complementar já foi adicionado.", { type: "warning" });
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
  additionalServiceValues = enabled ? additionalServiceValues : additionalServiceValues.filter((service) => service.id);
  document.getElementById("additionalServicesSection").classList.toggle("hidden", !enabled && !additionalServiceValues.length);
  form.elements.additionalCatalogId.value = "";
  form.elements.additionalCatalogSearch.value = "";
  form.elements.additionalAmount.value = "";
  renderAdditionalServiceList();
}

function syncServiceClientSelection() {
  const form = document.getElementById("serviceForm");
  const previousClientId = form.elements.clientId.value;
  const client = uniqueClientMatch(form.elements.clientSearch.value);
  form.elements.clientId.value = client?.id || "";
  if (form.elements.clientId.value !== previousClientId) {
    form.elements.requestedBy.value = "";
    updateSuggestedPrice();
    updateServiceRequesterOptions();
  }
}

function resolveServiceClientSearchOnEnter() {
  const form = document.getElementById("serviceForm");
  syncServiceClientSelection();
  const client = state.clients.find((item) => item.id === form.elements.clientId.value);
  if (client) {
    form.elements.clientSearch.value = clientOptionLabel(client);
  } else {
    const search = form.elements.clientSearch.value.trim();
    if (search && state.clients.filter((item) => matchesSearch(search, item.name)).length > 1) {
      showAppAlert("Vários clientes encontrados. Digite mais letras do nome.", { type: "warning" });
    }
  }
  return Boolean(client);
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
  const previousItem = state.catalog.find((item) => item.id === previousCatalogId);
  if (previousItem && searchableText(catalogOptionLabel(previousItem)) === searchableText(form.elements.catalogSearch.value)) {
    setServiceCatalogError();
    return;
  }
  const catalogItem = itemByExactLabel(state.catalog, form.elements.catalogSearch.value, catalogOptionLabel);
  form.elements.catalogId.value = catalogItem?.id || "";
  if (catalogItem) setServiceCatalogError();
  if (form.elements.catalogId.value !== previousCatalogId) updateSuggestedPrice();
}

function resolveServiceCatalogSearchOnEnter() {
  const form = document.getElementById("serviceForm");
  syncServiceCatalogSelection();
  const catalogItem = state.catalog.find((item) => item.id === form.elements.catalogId.value);
  if (catalogItem) {
    form.elements.catalogSearch.value = catalogOptionLabel(catalogItem);
    setServiceCatalogError();
  } else if (form.elements.catalogSearch.value.trim()) {
    setServiceCatalogError("Nenhum serviço encontrado com esse código ou nome.");
  }
  return Boolean(catalogItem);
}

function syncServiceClientFilter() {
  const searchInput = document.getElementById("serviceClientNameFilter");
  const client = uniqueClientMatch(searchInput.value);
  document.getElementById("serviceClientFilter").value = client?.id || "";
  renderServices();
}

function syncClientFilterField(searchId, hiddenId) {
  const searchInput = document.getElementById(searchId);
  const client = itemByExactLabel(state.clients, searchInput.value, clientOptionLabel)
    || uniqueClientMatch(searchInput.value);
  document.getElementById(hiddenId).value = client?.id || "";
}

function syncPaymentClientFilter() {
  syncClientFilterField("paymentClientFilterSearch", "paymentClientFilter");
  renderPayments();
}

function syncBillingClientFilter() {
  syncClientFilterField("billingClientFilterSearch", "billingClientFilter");
  renderBillings();
}

function syncFinanceSummaryClientFilter() {
  syncClientFilterField("financeSummaryClientFilterSearch", "financeSummaryClientFilter");
  renderFinanceSummary();
}

function syncTrackingClientSelection() {
  const form = document.getElementById("trackingForm");
  const client = itemByExactLabel(state.clients, form.elements.clientSearch.value, clientOptionLabel)
    || uniqueClientMatch(form.elements.clientSearch.value);
  form.elements.clientId.value = client?.id || "";
}

function syncPaymentClientSelection() {
  const form = document.getElementById("paymentForm");
  const client = itemByExactLabel(state.clients, form.elements.clientSearch.value, clientOptionLabel)
    || uniqueClientMatch(form.elements.clientSearch.value);
  form.elements.clientId.value = client?.id || "";
}

function syncBillingClientSelection() {
  const form = document.getElementById("billingForm");
  const client = itemByExactLabel(state.clients, form.elements.clientSearch.value, clientOptionLabel)
    || uniqueClientMatch(form.elements.clientSearch.value);
  form.elements.clientId.value = client?.id || "";
}

function renderTrackingServiceOptions() {
  const target = document.getElementById("trackingServiceOptions");
  target.innerHTML = state.catalog.length
    ? [...state.catalog]
      .sort((a, b) => (Number(a.code) || 999999) - (Number(b.code) || 999999) || a.name.localeCompare(b.name, "pt-BR"))
      .map((item) => `<label class="checkbox-label"><input type="checkbox" name="visibleServiceId" value="${item.id}" checked>${escapeHtml(item.code ? `${item.code} - ${item.name}` : item.name)}</label>`)
      .join("")
    : `<p class="meta">Cadastre servicos no catalogo.</p>`;
}

function renderTrackingWizardSummary() {
  const form = document.getElementById("trackingForm");
  const target = document.getElementById("trackingWizardSummary");
  if (!target) return;
  const client = clientById(form.elements.clientId.value);
  const visibleCount = form.querySelectorAll('input[name="visibleServiceId"]:checked').length;
  const totalCount = form.querySelectorAll('input[name="visibleServiceId"]').length;
  const rows = [
    ["Cliente", clientOptionLabel(client) || "-"],
    ["Período", `${formatDate(form.elements.startDate.value)} a ${formatDate(form.elements.endDate.value)}`],
    ["Validade", `${form.elements.validDays.value} dias`],
    ["Pedidos on-line", form.elements.allowRequests.checked ? "Sim" : "Não"],
    ["Serviços visíveis", `${visibleCount} de ${totalCount}`]
  ];
  target.innerHTML = rows
    .map(([label, value]) => `<div class="wizard-summary-row"><span class="wizard-summary-label">${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join("");
}

const trackingWizard = createDialogWizard({
  dialogId: "trackingDialog",
  formId: "trackingForm",
  navId: "trackingWizardNav",
  progressFillId: "trackingWizardProgressFill",
  progressLabelId: "trackingWizardProgressLabel",
  stepCount: 6,
  lastStepLabel: "Gerar e compartilhar",
  onReachLastStep: renderTrackingWizardSummary,
  pickers: {
    clientSearch: {
      searchField: "clientSearch",
      idField: "clientId",
      items: () => state.clients.map((client) => ({ id: client.id, label: clientOptionLabel(client) })),
      onApply: () => syncTrackingClientSelection()
    }
  },
  validateStep: (step, form) => {
    if (step === 1) {
      syncTrackingClientSelection();
      if (!form.elements.clientId.value) {
        showAppAlert("Selecione um cliente válido da lista.", { type: "warning" });
        form.elements.clientSearch.focus();
        return false;
      }
    }
    if (step === 2) {
      if (!form.elements.startDate.value || !form.elements.endDate.value) {
        showAppAlert("Informe o período (data inicial e final).", { type: "warning" });
        return false;
      }
      if (form.elements.endDate.value < form.elements.startDate.value) {
        showAppAlert("A data final deve ser igual ou posterior à data inicial.", { type: "warning" });
        return false;
      }
    }
    return true;
  }
});

function trackingLinkUrl(accessCode, fullAccessCode) {
  const base = `${location.origin}/acompanhamento.html?access=${encodeURIComponent(accessCode)}`;
  return fullAccessCode ? `${base}&full=${encodeURIComponent(fullAccessCode)}` : base;
}

let activeRequestsTab = "requests";

async function renderTrackingLinksPanel() {
  const list = document.getElementById("trackingLinksList");
  if (!list) return;
  list.innerHTML = `<p class="meta">Carregando...</p>`;
  try {
    const { data } = await window.supabaseClient.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) throw new Error("Sua sessão administrativa expirou.");
    const response = await fetch("/.netlify/functions/admin-tracking-links", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Não foi possível carregar os links gerados.");
    const links = result.links || [];
    list.innerHTML = links.length ? links.map((item) => {
      const url = trackingLinkUrl(item.accessCode, item.fullAccessCode);
      return `<article class="request-card tracking-link-card">
        <div class="request-card-head"><h3>${escapeHtml(item.clientName)}</h3></div>
        <p class="tracking-link-meta">Período ${formatDate(item.periodStart)} a ${formatDate(item.periodEnd)} · Gerado em ${new Date(item.createdAt).toLocaleString("pt-BR")}</p>
        <div class="tracking-link-fields">
          <div class="tracking-link-field"><span>Link</span><strong>${escapeHtml(url)}</strong></div>
          <div class="tracking-link-field"><span>Identificador</span><strong>${escapeHtml(item.identifier || "")}</strong></div>
          <div class="tracking-link-field"><span>Senha</span><strong>${escapeHtml(item.password || "")}</strong></div>
        </div>
        <div class="card-actions">
          <button class="table-action" type="button" data-copy-tracking-link="${escapeHtml(url)}">Copiar link</button>
          <button class="table-action" type="button" data-copy-tracking-identifier="${escapeHtml(item.identifier || "")}">Copiar ID</button>
          <button class="table-action" type="button" data-copy-tracking-password="${escapeHtml(item.password || "")}">Copiar senha</button>
          <button class="table-action danger" type="button" data-delete-tracking-link="${item.id}">Excluir</button>
        </div>
      </article>`;
    }).join("") : emptyMarkup();
  } catch (error) {
    console.error(error);
    list.innerHTML = `<p class="meta">${escapeHtml(error.message)}</p>`;
  }
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
  renderTrackingServiceOptions();
  document.getElementById("trackingAccessResult").classList.add("hidden");
  trackingWizard.activate(window.matchMedia("(max-width: 1024px)").matches);
  document.getElementById("trackingDialog").showModal();
  if (!trackingWizard.isActive()) setTimeout(() => (preferredClient ? form.elements.startDate : form.elements.clientSearch).focus(), 0);
}

function renderCatalogPriceFields(item = null) {
  document.getElementById("catalogPriceFields").innerHTML = state.priceTables.map((name) => `
    <label>${escapeHtml(name)}
      <input type="number" min="0" step="0.01" required data-price-table="${escapeHtml(name)}" value="${item ? Number(item.prices[name] || 0).toFixed(2) : ""}">
    </label>`).join("");
}

function setClientDialogTab(tabName = "main") {
  const form = document.getElementById("clientForm");
  form.querySelectorAll("[data-client-dialog-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.clientDialogTab === tabName);
  });
  form.querySelectorAll("[data-client-dialog-panel]").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.clientDialogPanel !== tabName);
  });
}

function openClientForm(client = null) {
  const form = document.getElementById("clientForm");
  form.reset();
  form.elements.clientId.value = client?.id || "";
  form.elements.name.value = client?.name || "";
  form.elements.phone.value = client?.phone || "";
  form.elements.document.value = client?.document || "";
  form.elements.email.value = client?.email || "";
  form.elements.contactName.value = client?.contactName || "";
  form.elements.zipCode.value = client?.zipCode || "";
  form.elements.address.value = client?.address || "";
  form.elements.addressNumber.value = client?.addressNumber || "";
  form.elements.addressComplement.value = client?.addressComplement || "";
  form.elements.neighborhood.value = client?.neighborhood || "";
  form.elements.city.value = client?.city || "";
  form.elements.state.value = client?.state || "";
  form.elements.notes.value = client?.notes || "";
  form.elements.priceGroup.value = client?.priceGroup || "";
  form.elements.billingFrequency.value = client?.billingFrequency || "semanal";
  setClientDialogTab("main");
  document.getElementById("clientDialogTitle").textContent = client ? "Editar cliente" : "Novo cliente";
  document.getElementById("clientDialog").showModal();
}

function renderClientRequesterManager(clientId) {
  const target = document.getElementById("clientRequesterList");
  const form = document.querySelector("#clientRequesterDialog form");
  const search = form?.elements.requesterSearch?.value?.trim() || "";
  const selectedId = form?.elements.selectedRequesterId?.value || "";
  const requesters = requestersForClient(clientId).filter((item) => matchesSearch(search, item.name));
  if (selectedId && !requesters.some((item) => item.id === selectedId)) {
    form.elements.selectedRequesterId.value = "";
  }
  target.innerHTML = requesters.length ? requesters.map((item) => `
    <button class="requester-manager-item${item.id === selectedId ? " active" : ""}" type="button" data-select-managed-requester="${item.id}">
      <strong>${escapeHtml(item.name)}</strong>
      <span>${item.id === selectedId ? "Selecionado" : "Selecionar"}</span>
    </button>`).join("") : `<div class="notification-empty"><strong>Nenhum solicitante encontrado.</strong></div>`;
}

function openClientRequesterManager(client) {
  if (!client) return;
  const form = document.querySelector("#clientRequesterDialog form");
  form.reset();
  form.elements.clientId.value = client.id;
  form.elements.selectedRequesterId.value = "";
  document.getElementById("clientRequesterDialogTitle").textContent = `Solicitantes - ${client.name}`;
  renderClientRequesterManager(client.id);
  document.getElementById("clientRequesterDialog").showModal();
}

function saveManagedRequester(clientId, name) {
  const result = addClientRequester(clientId, name);
  if (!result.ok) {
    showAppAlert(result.message, { type: "warning" });
    return false;
  }
  saveState();
  renderClientRequesterManager(clientId);
  showAppAlert("Solicitante cadastrado com sucesso.", { type: "success" });
  return true;
}

function renderCatalogWizardSummary() {
  const form = document.getElementById("catalogForm");
  const target = document.getElementById("catalogWizardSummary");
  if (!target) return;
  const priceRows = [...form.querySelectorAll("[data-price-table]")]
    .map((input) => [input.dataset.priceTable, money(Number(input.value || 0))]);
  const rows = [
    ["Código", form.elements.code.value.trim() || "-"],
    ["Nome do serviço", form.elements.name.value.trim() || "-"],
    ...priceRows
  ];
  target.innerHTML = rows
    .map(([label, value]) => `<div class="wizard-summary-row"><span class="wizard-summary-label">${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join("");
}

const catalogWizard = createDialogWizard({
  dialogId: "catalogDialog",
  formId: "catalogForm",
  navId: "catalogWizardNav",
  progressFillId: "catalogWizardProgressFill",
  progressLabelId: "catalogWizardProgressLabel",
  stepCount: 4,
  lastStepLabel: "Salvar serviço",
  onReachLastStep: renderCatalogWizardSummary,
  validateStep: (step, form) => {
    if (step === 1) {
      const code = form.elements.code.value.trim();
      if (code && state.catalog.some((catalogItem) =>
        catalogItem.code === code && catalogItem.id !== form.elements.catalogId.value)) {
        showAppAlert("Este código já está sendo usado por outro serviço.", { type: "warning" });
        form.elements.code.focus();
        return false;
      }
    }
    if (step === 2) {
      if (!form.elements.name.value.trim()) {
        showAppAlert("Informe o nome do serviço.", { type: "warning" });
        form.elements.name.focus();
        return false;
      }
    }
    if (step === 3) {
      const priceFields = [...form.querySelectorAll("[data-price-table]")];
      const invalid = priceFields.find((field) => field.value === "" || Number(field.value) < 0);
      if (invalid) {
        showAppAlert("Informe o preço para todas as tabelas.", { type: "warning" });
        invalid.focus();
        return false;
      }
    }
    return true;
  }
});

function nextCatalogCode() {
  const highest = state.catalog.reduce((max, item) => Math.max(max, Number(item.code) || 0), 0);
  return String(highest + 1);
}

function openCatalogForm(item = null) {
  const form = document.getElementById("catalogForm");
  form.reset();
  form.elements.catalogId.value = item?.id || "";
  form.elements.code.value = item ? (item.code || "") : nextCatalogCode();
  form.elements.name.value = item?.name || "";
  renderCatalogPriceFields(item);
  document.getElementById("catalogDialogTitle").textContent = item ? "Editar serviço" : "Novo serviço";
  catalogWizard.activate(window.matchMedia("(max-width: 1024px)").matches);
  document.getElementById("catalogDialog").showModal();
  if (!catalogWizard.isActive()) {
    setTimeout(() => {
      form.elements.code.focus();
      form.elements.code.select();
    }, 0);
  }
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
    if (item.status === "Pronto") {
      item.doneAt ||= changedAt;
      if (!item.deliveryCode) item.deliveryCode = randomDeliveryCode();
    }
    if (item.status === "Entregue") {
      item.doneAt ||= changedAt;
      item.deliveredAt = changedAt;
      item.deliverySource = adminDisplayName();
    } else {
      item.deliveredAt = null;
      item.deliverySource = "";
    }
    if (item.status === "A fazer") item.doneAt = null;
    item.updatedAt = changedAt;
  });

  const supplierStatus = status === "Pronto" ? "Feito" : status === "Entregue" ? "Entregue" : "";
  if (!supplierStatus) return;
  const targetIds = new Set(targets.map((item) => item.id));
  const statusRank = { "A fazer": 0, "Feito": 1, "Entregue": 2 };
  state.supplierEntries
    .filter((item) => targetIds.has(item.clientServiceEntryId) && item.status !== "Cancelado")
    .forEach((item) => {
      if ((statusRank[item.status] ?? 0) >= statusRank[supplierStatus]) return;
      item.status = supplierStatus;
      item.doneAt ||= changedAt;
      item.deliveredAt = supplierStatus === "Entregue" ? changedAt : null;
      item.lastChangedBy = "Administrador";
      item.updatedAt = changedAt;
    });
}

function openServiceCancellation(entry) {
  if (!entry) return;
  if (entry.billingId) {
    showAppAlert("Este serviço já está em uma cobrança. Cancele a cobrança primeiro para alterar o lançamento.", { type: "warning" });
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

function openServiceDeletion(entry) {
  if (!entry) return;
  if (entry.billingId) {
    showAppAlert("Este serviço já está em uma cobrança. Exclua a cobrança primeiro para remover o lançamento.", { type: "warning" });
    return;
  }
  const form = document.getElementById("deleteServiceForm");
  form.reset();
  form.elements.entryId.value = entry.id;
  const group = cancellationGroup(entry);
  const complementary = group.filter((item) => item.id !== entry.id && item.isSecondary);
  const linkedEntryIds = new Set(group.map((item) => item.id));
  const supplierEntries = state.supplierEntries.filter((item) => linkedEntryIds.has(item.clientServiceEntryId));
  const removableSupplierEntries = supplierEntries.filter((item) => !item.payableId);
  const lockedSupplierEntries = supplierEntries.filter((item) => item.payableId);
  document.getElementById("deleteServiceDescription").textContent =
    `${entry.description} · ${entry.reference || "Sem referência"} · ${clientById(entry.clientId)?.name || ""}`;
  document.getElementById("deleteComplementaryOption").classList.toggle("hidden", !complementary.length || entry.isSecondary);
  document.getElementById("deleteSupplierOption").classList.toggle("hidden", !removableSupplierEntries.length);
  document.getElementById("deleteSupplierLockedNote").classList.toggle("hidden", !lockedSupplierEntries.length);
  document.getElementById("deleteServiceDialog").showModal();
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
  form.elements.hasRequester.checked = Boolean(request?.requestedBy || item?.requestedBy);
  form.elements.requestedBy.value = request?.requestedBy || item?.requestedBy || "";
  updateServiceRequesterOptions();
  toggleServiceRequesterSection();
  const isEditablePrimary = Boolean(item) && !item.isSecondary;
  const editableSiblings = isEditablePrimary
    ? state.services.filter((sibling) => sibling.primaryEntryId === item.id && sibling.isSecondary && sibling.status !== "Cancelado")
    : [];
  additionalServiceValues = editableSiblings.map((sibling) => ({
    id: sibling.id,
    catalogId: sibling.catalogId,
    amount: Number(sibling.amount),
    locked: Boolean(sibling.billingId)
  }));
  form.elements.hasAdditionalServices.checked = Boolean(additionalServiceValues.length);
  form.elements.hasAdditionalServices.disabled = Boolean(item?.isSecondary);
  document.getElementById("additionalServicesSection").classList.toggle("hidden", !additionalServiceValues.length);
  const importHint = document.getElementById("serviceImportHint");
  importHint.classList.toggle("hidden", !request);
  importHint.innerHTML = request ? `
    <strong>Pedido importado do cliente</strong>
    <span>${escapeHtml(request.references?.length || 0)} referência(s) · Solicitante: ${escapeHtml(request.requestedBy || "Não informado")}</span>
    ${request.notes ? `<small>${escapeHtml(request.notes)}</small>` : ""}` : "";
  const existingSupplierLinks = isEditablePrimary
    ? state.supplierEntries
      .filter((entry) => entry.clientServiceEntryId === item.id && entry.status !== "Cancelado")
      .map((entry) => ({
        id: entry.id,
        supplierId: entry.supplierId,
        supplierServiceId: entry.supplierServiceId,
        amount: Number(entry.amount),
        locked: Boolean(entry.payableId)
      }))
    : [];
  window.supplierModule?.resetClientEntryOptions(Boolean(item?.isSecondary), existingSupplierLinks);
  document.getElementById("serviceDialogTitle").textContent = item ? "Editar lançamento" : request ? "Importar pedido" : "Novo lançamento";
  document.getElementById("suggestedPrice").textContent = item
    ? "O valor pode ser alterado somente neste lançamento."
    : request ? "Valor sugerido pelo pedido. Você pode ajustar antes de salvar." : "Selecione o cliente e o serviço para preencher o valor.";
  renderReferenceList();
  renderAdditionalServiceList();
  document.querySelectorAll("#serviceDialog .edit-hide-native").forEach((el) => el.classList.toggle("hidden", Boolean(item)));
  setServiceWizardMode(window.matchMedia("(max-width: 1024px)").matches);
  document.getElementById("serviceDialog").showModal();
  if (!serviceWizardModeActive()) setTimeout(() => form.elements.clientSearch.focus(), 0);
}

const SERVICE_WIZARD_STEP_COUNT = 10;
let serviceWizardStep = 1;

function serviceWizardModeActive() {
  return document.getElementById("serviceForm").classList.contains("wizard-mode");
}

function firstVisibleServiceField(container) {
  const candidates = container.querySelectorAll("input, select, textarea");
  for (const field of candidates) {
    if (field.type === "hidden" || field.type === "date" || field.disabled) continue;
    if (field.closest(".hidden")) continue;
    return field;
  }
  return null;
}

function setServiceWizardMode(enabled) {
  const form = document.getElementById("serviceForm");
  const dialog = document.getElementById("serviceDialog");
  form.classList.toggle("wizard-mode", enabled);
  dialog.querySelectorAll(".wizard-only").forEach((el) => el.classList.toggle("hidden", !enabled));
  form.querySelectorAll(".wizard-hide-native").forEach((el) => el.classList.toggle("hidden", enabled));
  form.querySelectorAll(".wizard-picker-search-field").forEach((el) => el.classList.toggle("hidden", enabled));
  form.querySelectorAll(".wizard-choice-btn.selected").forEach((el) => el.classList.remove("selected"));
  if (enabled) {
    resetServiceWizardPickerPages();
    goToServiceWizardStep(1);
  } else {
    form.querySelectorAll(".wizard-step.hidden").forEach((el) => el.classList.remove("hidden"));
  }
}

function syncServiceWizardChoiceSelection(stepElement) {
  const form = document.getElementById("serviceForm");
  stepElement.querySelectorAll(".wizard-choice-btn[data-yesno-choice]").forEach((btn) => {
    const checked = form.elements[btn.dataset.yesnoChoice].checked;
    btn.classList.toggle("selected", (btn.dataset.yesnoValue === "1") === checked);
  });
  stepElement.querySelectorAll(".wizard-choice-btn[data-status-choice]").forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.statusChoice === form.elements.status.value);
  });
  const dateButtons = stepElement.querySelectorAll(".wizard-choice-btn[data-date-choice]");
  if (dateButtons.length) {
    const todayIso = new Date().toISOString().slice(0, 10);
    dateButtons.forEach((btn) => {
      btn.classList.toggle("selected", btn.dataset.dateChoice === "today" && form.elements.date.value === todayIso);
    });
  }
}

function shouldSkipServiceWizardStep(target, form) {
  if (target === 6) return form.elements.hasAdditionalServices.disabled;
  if (target === 7) return form.elements.hasSupplierService.disabled;
  if (target === 8) return form.elements.hasSupplierService.disabled || !form.elements.hasSupplierService.checked;
  return false;
}

function goToServiceWizardStep(step) {
  const form = document.getElementById("serviceForm");
  const direction = step >= serviceWizardStep ? 1 : -1;
  let target = Math.min(Math.max(step, 1), SERVICE_WIZARD_STEP_COUNT);
  while (target > 1 && target < SERVICE_WIZARD_STEP_COUNT && shouldSkipServiceWizardStep(target, form)) {
    target += direction;
  }
  serviceWizardStep = Math.min(Math.max(target, 1), SERVICE_WIZARD_STEP_COUNT);
  form.querySelectorAll(".wizard-step").forEach((el) => {
    el.classList.toggle("hidden", Number(el.dataset.step) !== serviceWizardStep);
  });
  const progressFill = document.getElementById("serviceWizardProgressFill");
  if (progressFill) progressFill.style.width = `${(serviceWizardStep / SERVICE_WIZARD_STEP_COUNT) * 100}%`;
  const progressLabel = document.getElementById("serviceWizardProgressLabel");
  if (progressLabel) progressLabel.textContent = `Passo ${serviceWizardStep}`;
  const nav = document.getElementById("serviceWizardNav");
  const backButton = nav.querySelector("[data-wizard-back]");
  backButton.classList.toggle("hidden", serviceWizardStep === 1);
  nav.classList.toggle("single-button", serviceWizardStep === 1);
  nav.querySelector("[data-wizard-next]").textContent = serviceWizardStep === SERVICE_WIZARD_STEP_COUNT ? "Salvar lançamento" : "Continuar";
  if (serviceWizardStep === SERVICE_WIZARD_STEP_COUNT) renderServiceWizardSummary();
  const stepElement = form.querySelector(`.wizard-step[data-step="${serviceWizardStep}"]`);
  if (stepElement) syncServiceWizardChoiceSelection(stepElement);
  if (serviceWizardStep === 3) renderServiceCatalogPicker();
  if (serviceWizardStep === 6 && form.elements.hasAdditionalServices.checked) renderAdditionalCatalogPicker();
  if (serviceWizardStep === 7 && form.elements.hasSupplierService.checked) renderSupplierPicker();
  if (serviceWizardStep === 8) renderSupplierServicePicker();
  const pickerStep = serviceWizardStep === 3
    || (serviceWizardStep === 6 && form.elements.hasAdditionalServices.checked)
    || (serviceWizardStep === 7 && form.elements.hasSupplierService.checked)
    || serviceWizardStep === 8;
  const focusable = stepElement && !pickerStep ? firstVisibleServiceField(stepElement) : null;
  setTimeout(() => {
    if (focusable) {
      try { focusable.focus({ preventScroll: true }); } catch { focusable.focus(); }
    } else {
      nav.querySelector("[data-wizard-next]")?.focus({ preventScroll: true });
    }
  }, 0);
}

function validateServiceWizardStep(step) {
  const form = document.getElementById("serviceForm");
  if (step === 1) {
    syncServiceClientSelection();
    if (!form.elements.clientId.value) {
      showAppAlert("Selecione um cliente válido da lista.", { type: "warning" });
      form.elements.clientSearch.focus();
      return false;
    }
  }
  if (step === 3) {
    syncServiceCatalogSelection();
    if (!form.elements.catalogId.value) {
      setServiceCatalogError("O serviço é obrigatório. Escolha uma opção válida pelo código ou nome.");
      revealPickerSearchField("catalog");
      form.elements.catalogSearch.focus();
      return false;
    }
    setServiceCatalogError();
  }
  if (step === 4) {
    if (form.elements.entryId.value) {
      if (!form.elements.reference.value.trim()) {
        showAppAlert("Informe a placa ou referência.", { type: "warning" });
        form.elements.reference.focus();
        return false;
      }
      return true;
    }
    if (form.elements.reference.value.trim()) addCurrentReference();
    if (!serviceReferenceValues.length) {
      showAppAlert("Adicione pelo menos uma placa ou referência.", { type: "warning" });
      form.elements.reference.focus();
      return false;
    }
  }
  if (step === 5) {
    if (form.elements.amount.value === "" || Number(form.elements.amount.value) < 0) {
      showAppAlert("Informe o valor do serviço.", { type: "warning" });
      form.elements.amount.focus();
      return false;
    }
  }
  if (step === 6 && form.elements.hasAdditionalServices.checked) {
    if (form.elements.additionalCatalogSearch.value.trim() || form.elements.additionalAmount.value) {
      if (!addAdditionalService()) {
        revealPickerSearchField("additionalCatalog");
        return false;
      }
    }
    if (!additionalServiceValues.length) {
      showAppAlert('Adicione pelo menos um serviço complementar ou toque em "Não".', { type: "warning" });
      revealPickerSearchField("additionalCatalog");
      form.elements.additionalCatalogSearch.focus();
      return false;
    }
  }
  if (step === 7 && form.elements.hasSupplierService.checked) {
    if (!form.elements.supplierId.value) {
      showAppAlert("Selecione o fornecedor.", { type: "warning" });
      revealPickerSearchField("supplier");
      form.elements.supplierSearch.focus();
      return false;
    }
  }
  if (step === 8 && form.elements.hasSupplierService.checked) {
    if (form.elements.supplierServiceSearch.value.trim() || form.elements.supplierAmount.value) {
      if (!window.supplierModule?.addClientSupplierService()) {
        revealPickerSearchField("supplierService");
        return false;
      }
    }
    const supplierSelection = window.supplierModule?.clientEntrySelection();
    if (supplierSelection?.error) {
      showAppAlert(supplierSelection.error, { type: "warning" });
      revealPickerSearchField("supplierService");
      supplierSelection.field?.focus();
      return false;
    }
  }
  return true;
}

function revealPickerSearchField(key) {
  document.querySelector(`[data-picker-search-target="${key}"]`)?.classList.remove("hidden");
}

function renderServiceWizardSummary() {
  const target = document.getElementById("serviceWizardSummary");
  if (!target) return;
  const form = document.getElementById("serviceForm");
  const client = clientById(form.elements.clientId.value);
  const catalogItem = state.catalog.find((catalogEntry) => catalogEntry.id === form.elements.catalogId.value);
  const typedReferences = String(form.elements.reference.value || "")
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  const references = [...new Set([...serviceReferenceValues, ...typedReferences])];
  const statusLabels = { "A fazer": "A fazer", "Pronto": "Feito", "Entregue": "Entregue" };
  const rows = [
    ["Cliente", clientOptionLabel(client) || "-"],
    form.elements.hasRequester.checked ? ["Solicitante", form.elements.requestedBy.value || "-"] : null,
    ["Data", formatDate(form.elements.date.value)],
    ["Serviço", catalogOptionLabel(catalogItem) || "-"],
    ["Placa ou referência", references.length ? references.join(", ") : "-"],
    ["Valor", money.format(Number(form.elements.amount.value || 0))],
    additionalServiceValues.length ? ["Complementares", `${additionalServiceValues.length} serviço(s) · ${money.format(additionalServiceValues.reduce((total, service) => total + Number(service.amount || 0), 0))}`] : null,
    (() => {
      const supplierSelections = window.supplierModule?.currentClientSupplierServiceSelections() || [];
      return form.elements.hasSupplierService.checked && supplierSelections.length
        ? ["Fornecedor", `${supplierSelections.length} serviço(s) · ${money.format(supplierSelections.reduce((total, item) => total + Number(item.amount || 0), 0))}`]
        : null;
    })(),
    ["Situação", statusLabels[form.elements.status.value] || form.elements.status.value]
  ].filter(Boolean);
  target.innerHTML = rows
    .map(([label, value]) => `<div class="wizard-summary-row"><span class="wizard-summary-label">${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join("");
}

const wizardPickerPages = { catalog: 0, additionalCatalog: 0, supplier: 0, supplierService: 0 };
const WIZARD_PICKER_PAGE_SIZE = 6;

function resetServiceWizardPickerPages() {
  Object.keys(wizardPickerPages).forEach((key) => { wizardPickerPages[key] = 0; });
}

function renderWizardPickerGrid(key, items, selectedIds) {
  const grid = document.getElementById(`${key}PickerGrid`);
  if (!grid) return;
  const selected = new Set([].concat(selectedIds).filter(Boolean));
  const totalPages = Math.max(1, Math.ceil(items.length / WIZARD_PICKER_PAGE_SIZE));
  wizardPickerPages[key] = Math.min(Math.max(wizardPickerPages[key] || 0, 0), totalPages - 1);
  const page = wizardPickerPages[key];
  const pageItems = items.slice(page * WIZARD_PICKER_PAGE_SIZE, page * WIZARD_PICKER_PAGE_SIZE + WIZARD_PICKER_PAGE_SIZE);
  grid.innerHTML = pageItems.length
    ? pageItems.map((item) => `<button type="button" class="wizard-choice-btn${selected.has(item.id) ? " selected" : ""}" data-picker-item="${escapeHtml(item.id)}">${escapeHtml(item.label)}</button>`).join("")
    : '<span class="field-hint">Nada cadastrado ainda.</span>';
  const prevButton = document.querySelector(`[data-picker-prev="${key}"]`);
  const nextButton = document.querySelector(`[data-picker-next="${key}"]`);
  if (prevButton) prevButton.disabled = page === 0;
  if (nextButton) nextButton.disabled = page >= totalPages - 1;
}

function catalogUsagePickerItems(excludeId = "") {
  const counts = {};
  state.services.forEach((entry) => {
    if (entry.status === "Cancelado") return;
    counts[entry.catalogId] = (counts[entry.catalogId] || 0) + 1;
  });
  return [...state.catalog]
    .filter((item) => item.id !== excludeId)
    .sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0))
    .map((item) => ({ id: item.id, label: catalogOptionLabel(item) }));
}

function renderServiceCatalogPicker() {
  const form = document.getElementById("serviceForm");
  renderWizardPickerGrid("catalog", catalogUsagePickerItems(), [form.elements.catalogId.value]);
}

function renderAdditionalCatalogPicker() {
  const form = document.getElementById("serviceForm");
  const addedIds = additionalServiceValues.map((service) => service.catalogId);
  renderWizardPickerGrid("additionalCatalog", catalogUsagePickerItems(form.elements.catalogId.value), [...addedIds, form.elements.additionalCatalogId.value]);
}

function renderSupplierPicker() {
  const form = document.getElementById("serviceForm");
  renderWizardPickerGrid("supplier", window.supplierModule?.pickerSuppliers() || [], [form.elements.supplierId.value]);
}

function renderSupplierServicePicker() {
  const form = document.getElementById("serviceForm");
  const supplierId = form.elements.supplierId.value;
  const items = supplierId ? (window.supplierModule?.pickerServicesForSupplier(supplierId) || []) : [];
  const addedIds = (window.supplierModule?.currentClientSupplierServiceSelections() || [])
    .filter((item) => item.supplierId === supplierId)
    .map((item) => item.supplierServiceId);
  renderWizardPickerGrid("supplierService", items, [...addedIds, form.elements.supplierServiceId.value]);
}

async function removeAdditionalServiceByCatalogId(catalogId) {
  const index = additionalServiceValues.findIndex((service) => service.catalogId === catalogId);
  if (index < 0) return;
  const target = additionalServiceValues[index];
  if (target.id && !(await showAppConfirm("Remover este serviço complementar já salvo? Ele será excluído ao salvar o lançamento."))) return;
  additionalServiceValues.splice(index, 1);
  if (!additionalServiceValues.length) {
    document.getElementById("serviceForm").elements.hasAdditionalServices.checked = false;
    document.getElementById("additionalServicesSection").classList.add("hidden");
  }
  renderAdditionalServiceList();
  renderAdditionalCatalogPicker();
}

const WIZARD_PICKER_RENDERERS = {
  catalog: renderServiceCatalogPicker,
  additionalCatalog: renderAdditionalCatalogPicker,
  supplier: renderSupplierPicker,
  supplierService: renderSupplierServicePicker
};

document.getElementById("serviceDialog").addEventListener("click", async (event) => {
  if (!serviceWizardModeActive()) return;
  const yesnoButton = event.target.closest(".wizard-choice-btn[data-yesno-choice]");
  if (yesnoButton) {
    const form = document.getElementById("serviceForm");
    const checkbox = form.elements[yesnoButton.dataset.yesnoChoice];
    checkbox.checked = yesnoButton.dataset.yesnoValue === "1";
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    yesnoButton.parentElement.querySelectorAll(".wizard-choice-btn").forEach((btn) => btn.classList.toggle("selected", btn === yesnoButton));
    const hasPicker = yesnoButton.dataset.yesnoChoice === "hasAdditionalServices" || yesnoButton.dataset.yesnoChoice === "hasSupplierService";
    if (checkbox.checked && yesnoButton.dataset.yesnoChoice === "hasAdditionalServices") renderAdditionalCatalogPicker();
    if (checkbox.checked && yesnoButton.dataset.yesnoChoice === "hasSupplierService") { renderSupplierPicker(); renderSupplierServicePicker(); }
    const stepElement = yesnoButton.closest(".wizard-step");
    const revealedField = checkbox.checked && !hasPicker && stepElement ? firstVisibleServiceField(stepElement) : null;
    setTimeout(() => {
      if (revealedField) revealedField.focus();
      else if (!checkbox.checked || hasPicker) document.querySelector("[data-wizard-next]")?.focus();
    }, 0);
    return;
  }
  const dateButton = event.target.closest(".wizard-choice-btn[data-date-choice]");
  if (dateButton) {
    const form = document.getElementById("serviceForm");
    dateButton.parentElement.querySelectorAll(".wizard-choice-btn").forEach((btn) => btn.classList.toggle("selected", btn === dateButton));
    if (dateButton.dataset.dateChoice === "pick") {
      setTimeout(() => form.elements.date.focus(), 0);
    } else {
      form.elements.date.value = new Date().toISOString().slice(0, 10);
      setTimeout(() => document.querySelector("[data-wizard-next]")?.focus(), 0);
    }
    return;
  }
  const statusButton = event.target.closest(".wizard-choice-btn[data-status-choice]");
  if (statusButton) {
    const form = document.getElementById("serviceForm");
    form.elements.status.value = statusButton.dataset.statusChoice;
    form.elements.status.dispatchEvent(new Event("change", { bubbles: true }));
    statusButton.parentElement.querySelectorAll(".wizard-choice-btn").forEach((btn) => btn.classList.toggle("selected", btn === statusButton));
    setTimeout(() => document.querySelector("[data-wizard-next]")?.focus(), 0);
    return;
  }
  const pickerButton = event.target.closest(".wizard-picker-grid .wizard-choice-btn[data-picker-item]");
  if (pickerButton) {
    const key = pickerButton.closest(".wizard-picker")?.dataset.picker;
    const form = document.getElementById("serviceForm");
    const itemId = pickerButton.dataset.pickerItem;
    const label = pickerButton.textContent.trim();
    if (key === "catalog") {
      const previousCatalogId = form.elements.catalogId.value;
      form.elements.catalogSearch.value = label;
      form.elements.catalogId.value = itemId;
      setServiceCatalogError();
      if (itemId !== previousCatalogId) updateSuggestedPrice();
      renderServiceCatalogPicker();
    } else if (key === "additionalCatalog") {
      const existingAdditional = additionalServiceValues.find((service) => service.catalogId === itemId);
      if (existingAdditional) {
        if (existingAdditional.locked) showAppAlert("Este serviço complementar já está em uma cobrança e não pode ser removido aqui.", { type: "warning" });
        else removeAdditionalServiceByCatalogId(itemId);
      } else {
        form.elements.additionalCatalogSearch.value = label;
        addAdditionalService();
        form.elements.additionalCatalogSearch.blur();
        renderAdditionalCatalogPicker();
      }
    } else if (key === "supplier") {
      form.elements.supplierSearch.value = label;
      form.elements.supplierSearch.dispatchEvent(new Event("change", { bubbles: true }));
      renderSupplierPicker();
      renderSupplierServicePicker();
    } else if (key === "supplierService") {
      const existingSupplierService = (window.supplierModule?.currentClientSupplierServiceSelections() || [])
        .find((item) => item.supplierId === form.elements.supplierId.value && item.supplierServiceId === itemId);
      if (existingSupplierService) {
        if (existingSupplierService.locked) showAppAlert("Este serviço do fornecedor já está em uma conta a pagar e não pode ser removido aqui.", { type: "warning" });
        else await window.supplierModule?.removeClientSupplierServiceById(itemId);
      } else {
        form.elements.supplierServiceSearch.value = label;
        window.supplierModule?.addClientSupplierService();
        form.elements.supplierServiceSearch.blur();
      }
      renderSupplierServicePicker();
    }
    return;
  }
  const pagerButton = event.target.closest("[data-picker-prev], [data-picker-next]");
  if (pagerButton) {
    const key = pagerButton.dataset.pickerPrev || pagerButton.dataset.pickerNext;
    wizardPickerPages[key] = Math.max(0, (wizardPickerPages[key] || 0) + (pagerButton.dataset.pickerPrev ? -1 : 1));
    WIZARD_PICKER_RENDERERS[key]?.();
    return;
  }
  const searchButton = event.target.closest("[data-picker-search]");
  if (searchButton) {
    const key = searchButton.dataset.pickerSearch;
    revealPickerSearchField(key);
    const field = document.querySelector(`[data-picker-search-target="${key}"] input`);
    setTimeout(() => field?.focus(), 0);
    return;
  }
  if (event.target.closest("[data-wizard-back]")) {
    if (serviceWizardStep <= 1) {
      document.querySelector("[data-cancel-service-entry]").click();
    } else {
      goToServiceWizardStep(serviceWizardStep - 1);
    }
    return;
  }
  if (event.target.closest("[data-wizard-next]")) {
    if (serviceWizardStep >= SERVICE_WIZARD_STEP_COUNT) {
      const form = document.getElementById("serviceForm");
      form.requestSubmit(form.querySelector('button[value="default"]'));
    } else if (validateServiceWizardStep(serviceWizardStep)) {
      goToServiceWizardStep(serviceWizardStep + 1);
    }
  }
});

document.getElementById("serviceForm").addEventListener("change", (event) => {
  if (!serviceWizardModeActive()) return;
  if (event.target.name === "catalogSearch") renderServiceCatalogPicker();
  if (event.target.name === "additionalCatalogSearch") renderAdditionalCatalogPicker();
  if (event.target.name === "supplierSearch") { renderSupplierPicker(); renderSupplierServicePicker(); }
  if (event.target.name === "supplierServiceSearch") renderSupplierServicePicker();
});

function importClientRequest(requestId) {
  const request = (state.serviceRequests || []).find((item) => item.id === requestId);
  if (!request || request.status !== "Novo") {
    showAppAlert("Este pedido não está mais disponível para importação.", { type: "warning" });
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
    showAppAlert(clientId ? "Não há pedidos pendentes para este cliente." : "Não há pedidos pendentes.", { type: "warning" });
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

function createDialogWizard(config) {
  const {
    dialogId, formId, navId, progressFillId, progressLabelId, stepCount,
    shouldSkipStep = () => false,
    onEnterStep = () => {},
    isPickerStep = () => false,
    validateStep = () => true,
    onReachLastStep = () => {},
    submitButtonSelector = 'button[value="default"]',
    nextLabel = "Continuar",
    lastStepLabel = "Salvar",
    pickers = {}
  } = config;

  const PICKER_PAGE_SIZE = 6;
  const pickerPages = {};
  let currentStep = 1;
  const getForm = () => document.getElementById(formId);
  const getDialog = () => document.getElementById(dialogId);
  const getNav = () => document.getElementById(navId);

  function renderPicker(key) {
    const picker = pickers[key];
    const grid = document.getElementById(`${key}PickerGrid`);
    if (!picker || !grid) return;
    const form = getForm();
    const items = picker.items(form);
    const selectedId = form.elements[picker.idField]?.value || "";
    const totalPages = Math.max(1, Math.ceil(items.length / PICKER_PAGE_SIZE));
    pickerPages[key] = Math.min(Math.max(pickerPages[key] || 0, 0), totalPages - 1);
    const page = pickerPages[key];
    const pageItems = items.slice(page * PICKER_PAGE_SIZE, page * PICKER_PAGE_SIZE + PICKER_PAGE_SIZE);
    grid.innerHTML = pageItems.length
      ? pageItems.map((item) => `<button type="button" class="wizard-choice-btn${item.id === selectedId ? " selected" : ""}" data-picker-item="${escapeHtml(item.id)}">${escapeHtml(item.label)}</button>`).join("")
      : '<span class="field-hint">Nada cadastrado ainda.</span>';
    const prevButton = document.querySelector(`[data-picker-prev="${key}"]`);
    const nextButton = document.querySelector(`[data-picker-next="${key}"]`);
    if (prevButton) prevButton.disabled = page === 0;
    if (nextButton) nextButton.disabled = page >= totalPages - 1;
  }

  function renderStepPickers(stepElement) {
    stepElement?.querySelectorAll(".wizard-picker[data-picker]").forEach((el) => renderPicker(el.dataset.picker));
  }

  function isActive() {
    return getForm()?.classList.contains("wizard-mode") || false;
  }

  function firstVisibleField(container) {
    const candidates = container.querySelectorAll("input, select, textarea");
    for (const field of candidates) {
      if (field.type === "hidden" || field.type === "date" || field.disabled) continue;
      if (field.closest(".hidden")) continue;
      return field;
    }
    return null;
  }

  function syncChoiceSelection(stepElement) {
    const form = getForm();
    stepElement.querySelectorAll(".wizard-choice-btn[data-choice-value]").forEach((btn) => {
      const fieldName = btn.closest("[data-choice-for]")?.dataset.choiceFor;
      const field = fieldName ? form.elements[fieldName] : null;
      if (!field) { btn.classList.remove("selected"); return; }
      const currentValue = field.type === "checkbox" ? (field.checked ? "1" : "0") : field.value;
      btn.classList.toggle("selected", currentValue === btn.dataset.choiceValue);
    });
    const dateButtons = stepElement.querySelectorAll(".wizard-choice-btn[data-date-choice]");
    if (dateButtons.length) {
      const fieldName = dateButtons[0].closest("[data-choice-for]")?.dataset.choiceFor;
      const field = fieldName ? form.elements[fieldName] : null;
      const todayIso = new Date().toISOString().slice(0, 10);
      dateButtons.forEach((btn) => {
        btn.classList.toggle("selected", btn.dataset.dateChoice === "today" && field?.value === todayIso);
      });
    }
  }

  function goToStep(step) {
    const form = getForm();
    const direction = step >= currentStep ? 1 : -1;
    let target = Math.min(Math.max(step, 1), stepCount);
    while (target > 1 && target < stepCount && shouldSkipStep(target, form)) target += direction;
    currentStep = Math.min(Math.max(target, 1), stepCount);
    form.querySelectorAll(".wizard-step").forEach((el) => {
      el.classList.toggle("hidden", Number(el.dataset.step) !== currentStep);
    });
    const progressFill = document.getElementById(progressFillId);
    if (progressFill) progressFill.style.width = `${(currentStep / stepCount) * 100}%`;
    const progressLabel = document.getElementById(progressLabelId);
    if (progressLabel) progressLabel.textContent = `Passo ${currentStep}`;
    const nav = getNav();
    const backButton = nav.querySelector("[data-wizard-back]");
    backButton.classList.toggle("hidden", currentStep === 1);
    nav.classList.toggle("single-button", currentStep === 1);
    nav.querySelector("[data-wizard-next]").textContent = currentStep === stepCount ? lastStepLabel : nextLabel;
    if (currentStep === stepCount) onReachLastStep(form);
    const stepElement = form.querySelector(`.wizard-step[data-step="${currentStep}"]`);
    onEnterStep(currentStep, form);
    if (stepElement) { syncChoiceSelection(stepElement); renderStepPickers(stepElement); }
    const pickerStep = isPickerStep(currentStep, form) || Boolean(stepElement?.querySelector(".wizard-picker[data-picker]"));
    const focusable = stepElement && !pickerStep ? firstVisibleField(stepElement) : null;
    setTimeout(() => {
      if (focusable) {
        try { focusable.focus({ preventScroll: true }); } catch { focusable.focus(); }
      } else {
        nav.querySelector("[data-wizard-next]")?.focus({ preventScroll: true });
      }
    }, 0);
  }

  function activate(enabled) {
    const form = getForm();
    const dialog = getDialog();
    form.classList.toggle("wizard-mode", enabled);
    dialog.querySelectorAll(".wizard-only").forEach((el) => el.classList.toggle("hidden", !enabled));
    form.querySelectorAll(".wizard-hide-native").forEach((el) => el.classList.toggle("hidden", enabled));
    form.querySelectorAll(".wizard-picker-search-field").forEach((el) => el.classList.toggle("hidden", enabled));
    form.querySelectorAll(".wizard-choice-btn.selected").forEach((el) => el.classList.remove("selected"));
    if (enabled) {
      Object.keys(pickerPages).forEach((key) => { pickerPages[key] = 0; });
      currentStep = 1;
      goToStep(1);
    } else {
      form.querySelectorAll(".wizard-step.hidden").forEach((el) => el.classList.remove("hidden"));
    }
  }

  getDialog().addEventListener("click", (event) => {
    if (!isActive()) return;
    const dateButton = event.target.closest(".wizard-choice-btn[data-date-choice]");
    if (dateButton) {
      const form = getForm();
      const fieldName = dateButton.closest("[data-choice-for]")?.dataset.choiceFor;
      const field = fieldName ? form.elements[fieldName] : null;
      dateButton.parentElement.querySelectorAll(".wizard-choice-btn").forEach((btn) => btn.classList.toggle("selected", btn === dateButton));
      if (dateButton.dataset.dateChoice === "pick") {
        setTimeout(() => field?.focus(), 0);
      } else if (field) {
        field.value = new Date().toISOString().slice(0, 10);
        field.dispatchEvent(new Event("change", { bubbles: true }));
        setTimeout(() => getNav().querySelector("[data-wizard-next]")?.focus(), 0);
      }
      return;
    }
    const choiceButton = event.target.closest(".wizard-choice-btn[data-choice-value]");
    if (choiceButton) {
      const form = getForm();
      const fieldName = choiceButton.closest("[data-choice-for]")?.dataset.choiceFor;
      const field = fieldName ? form.elements[fieldName] : null;
      if (field) {
        if (field.type === "checkbox") field.checked = choiceButton.dataset.choiceValue === "1";
        else field.value = choiceButton.dataset.choiceValue;
        field.dispatchEvent(new Event("change", { bubbles: true }));
      }
      choiceButton.parentElement.querySelectorAll(".wizard-choice-btn").forEach((btn) => btn.classList.toggle("selected", btn === choiceButton));
      setTimeout(() => getNav().querySelector("[data-wizard-next]")?.focus(), 0);
      return;
    }
    if (event.target.closest("[data-wizard-back]")) {
      if (currentStep <= 1) {
        getDialog().querySelector("[data-close-dialog], [data-close-supplier-dialog]")?.click();
      } else {
        goToStep(currentStep - 1);
      }
      return;
    }
    const pickerButton = event.target.closest(".wizard-picker-grid .wizard-choice-btn[data-picker-item]");
    if (pickerButton) {
      const key = pickerButton.closest(".wizard-picker")?.dataset.picker;
      const picker = pickers[key];
      if (picker) {
        const form = getForm();
        form.elements[picker.searchField].value = pickerButton.textContent.trim();
        form.elements[picker.searchField].dispatchEvent(new Event("change", { bubbles: true }));
        picker.onApply?.(form);
        renderPicker(key);
      }
      return;
    }
    const pagerButton = event.target.closest("[data-picker-prev], [data-picker-next]");
    if (pagerButton) {
      const key = pagerButton.dataset.pickerPrev || pagerButton.dataset.pickerNext;
      pickerPages[key] = Math.max(0, (pickerPages[key] || 0) + (pagerButton.dataset.pickerPrev ? -1 : 1));
      renderPicker(key);
      return;
    }
    const searchButton = event.target.closest("[data-picker-search]");
    if (searchButton) {
      const key = searchButton.dataset.pickerSearch;
      const field = document.querySelector(`[data-picker-search-target="${key}"] input`);
      document.querySelector(`[data-picker-search-target="${key}"]`)?.classList.remove("hidden");
      setTimeout(() => field?.focus(), 0);
      return;
    }
    if (event.target.closest("[data-wizard-next]")) {
      if (currentStep >= stepCount) {
        const form = getForm();
        form.requestSubmit(form.querySelector(submitButtonSelector));
      } else if (validateStep(currentStep, getForm())) {
        goToStep(currentStep + 1);
      }
    }
  });

  function resolvePickerFieldOnEnter(fieldName) {
    const key = Object.keys(pickers).find((k) => pickers[k].searchField === fieldName);
    if (!key) return;
    const form = getForm();
    const picker = pickers[key];
    picker.onApply?.(form);
    const resolvedId = form.elements[picker.idField]?.value || "";
    const resolvedItem = resolvedId ? picker.items(form).find((item) => item.id === resolvedId) : null;
    if (resolvedItem) form.elements[picker.searchField].value = resolvedItem.label;
    if (isActive()) renderPicker(key);
  }

  getForm().addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.target.tagName === "BUTTON") return;
    resolvePickerFieldOnEnter(event.target.name);
    if (!isActive()) return;
    if (event.target.tagName === "TEXTAREA") {
      event.stopPropagation();
      return;
    }
    event.preventDefault();
    getNav().querySelector("[data-wizard-next]")?.click();
  });

  return { activate, isActive, goToStep, getCurrentStep: () => currentStep, renderPicker };
}

function openPaymentForm(item = null, billing = null, mode = "partial") {
  const form = document.getElementById("paymentForm");
  form.reset();
  form.elements.paymentId.value = item?.id || "";
  form.elements.billingId.value = item?.billingId || billing?.id || "";
  form.elements.clientId.value = item?.clientId || billing?.clientId || "";
  form.elements.clientSearch.value = clientOptionLabel(clientById(form.elements.clientId.value));
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
  paymentWizard.activate(window.matchMedia("(max-width: 1024px)").matches);
  document.getElementById("paymentDialog").showModal();
  if (!paymentWizard.isActive()) setTimeout(() => form.elements.clientSearch.focus(), 0);
}

function renderPaymentMethodChoices() {
  const form = document.getElementById("paymentForm");
  const container = document.getElementById("paymentMethodChoice");
  if (!container) return;
  const options = [...form.elements.method.options].filter((option) => option.value);
  container.innerHTML = options.length
    ? options.map((option) => `<button type="button" class="wizard-choice-btn" data-choice-value="${escapeHtml(option.value)}">${escapeHtml(option.value)}</button>`).join("")
    : '<span class="field-hint">Nenhuma forma de pagamento cadastrada.</span>';
}

function renderPaymentWizardSummary() {
  const form = document.getElementById("paymentForm");
  const target = document.getElementById("paymentWizardSummary");
  if (!target) return;
  const client = clientById(form.elements.clientId.value);
  const rows = [
    ["Cliente", clientOptionLabel(client) || "-"],
    ["Data", formatDate(form.elements.date.value)],
    ["Valor", money.format(Number(form.elements.amount.value || 0))],
    ["Forma", form.elements.method.value || "Não informada"],
    form.elements.note.value ? ["Observação", form.elements.note.value] : null
  ].filter(Boolean);
  target.innerHTML = rows
    .map(([label, value]) => `<div class="wizard-summary-row"><span class="wizard-summary-label">${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join("");
}

const paymentWizard = createDialogWizard({
  dialogId: "paymentDialog",
  formId: "paymentForm",
  navId: "paymentWizardNav",
  progressFillId: "paymentWizardProgressFill",
  progressLabelId: "paymentWizardProgressLabel",
  stepCount: 6,
  lastStepLabel: "Dar baixa",
  onEnterStep: (step) => {
    if (step === 4) renderPaymentMethodChoices();
  },
  onReachLastStep: renderPaymentWizardSummary,
  pickers: {
    clientSearch: {
      searchField: "clientSearch",
      idField: "clientId",
      items: () => state.clients.map((client) => ({ id: client.id, label: clientOptionLabel(client) })),
      onApply: () => syncPaymentClientSelection()
    }
  },
  validateStep: (step, form) => {
    if (step === 1) {
      syncPaymentClientSelection();
      if (!form.elements.clientId.value) {
        showAppAlert("Selecione um cliente válido da lista.", { type: "warning" });
        form.elements.clientSearch.focus();
        return false;
      }
    }
    if (step === 3) {
      if (form.elements.amount.value === "" || Number(form.elements.amount.value) <= 0) {
        showAppAlert("Informe o valor recebido.", { type: "warning" });
        form.elements.amount.focus();
        return false;
      }
    }
    return true;
  }
});

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
  paymentMethodWizard.activate(window.matchMedia("(max-width: 1024px)").matches);
  document.getElementById("paymentMethodDialog").showModal();
  if (!paymentMethodWizard.isActive()) setTimeout(() => form.elements.name.focus(), 0);
}

function renderPaymentMethodWizardSummary() {
  const form = document.getElementById("paymentMethodForm");
  const target = document.getElementById("paymentMethodWizardSummary");
  if (!target) return;
  const rows = [
    ["Tipo", form.elements.type.value],
    ["Nome para exibição", form.elements.name.value || "-"],
    form.elements.details.value ? ["Chave ou instruções", form.elements.details.value] : null,
    form.elements.link.value ? ["Link de pagamento", form.elements.link.value] : null,
    ["Disponível nas cobranças", form.elements.active.checked ? "Sim" : "Não"]
  ].filter(Boolean);
  target.innerHTML = rows
    .map(([label, value]) => `<div class="wizard-summary-row"><span class="wizard-summary-label">${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join("");
}

const paymentMethodWizard = createDialogWizard({
  dialogId: "paymentMethodDialog",
  formId: "paymentMethodForm",
  navId: "paymentMethodWizardNav",
  progressFillId: "paymentMethodWizardProgressFill",
  progressLabelId: "paymentMethodWizardProgressLabel",
  stepCount: 6,
  onReachLastStep: renderPaymentMethodWizardSummary,
  validateStep: (step, form) => {
    if (step === 2 && !form.elements.name.value.trim()) {
      showAppAlert("Informe o nome para exibição.", { type: "warning" });
      form.elements.name.focus();
      return false;
    }
    return true;
  }
});

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

function requesterServiceSummary(services) {
  const groups = new Map();
  services.forEach((item) => {
    const requester = String(item.requestedBy || "").trim() || "Sem solicitante";
    if (!groups.has(requester)) groups.set(requester, { requester, count: 0, total: 0, services: new Map() });
    const group = groups.get(requester);
    group.count += 1;
    group.total += Number(item.amount || 0);
    const service = group.services.get(item.description) || { name: item.description, count: 0, total: 0 };
    service.count += 1;
    service.total += Number(item.amount || 0);
    group.services.set(item.description, service);
  });
  return [...groups.values()]
    .map((group) => ({ ...group, services: [...group.services.values()] }))
    .sort((a, b) => b.total - a.total || a.requester.localeCompare(b.requester, "pt-BR"));
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
  const requesterGroups = requesterServiceSummary(details.services);
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
  text(billing.billingNumber ? `Relatorio de cobranca #${billing.billingNumber}` : "Relatorio de cobranca", margin, 9, colors.gray, true);
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

  if (requesterGroups.length) {
    heading("Resumo por solicitante");
    for (const group of requesterGroups) {
      ensureSpace(28);
      text(`${group.requester}: ${group.count} servico(s) - ${money.format(group.total)}`, margin, 9, colors.dark, true);
      y -= 16;
      for (const service of group.services) {
        ensureSpace(18);
        text(`- ${service.name}: ${service.count} - ${money.format(service.total)}`, margin + 12, 8, colors.gray);
        y -= 14;
      }
      y -= 4;
    }
  }

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
  showAppAlert(
    "Este navegador não permite anexar o PDF automaticamente.\n\n"
    + "O relatório foi baixado. Abra o WhatsApp e anexe o arquivo PDF salvo.",
    { type: "info" }
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
  return `Olá, ${client?.name || ""}!\n\nSua cobrança${billing.billingNumber ? ` #${billing.billingNumber}` : ""} de ${formatDate(billing.startDate)} a ${formatDate(billing.endDate)} foi gerada.\n\nTotal em aberto: ${money.format(billingOpenAmount(billing))}\n\nFormas de pagamento:\n${methods}\n\nAcesse sua cobrança sem precisar digitar senha:\n${automaticAccessUrl}`;
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
  openWhatsApp(
    `whatsapp://send?${phone ? `phone=${phone}&` : ""}text=${encodeURIComponent(text)}`,
    whatsappWebFallback(phone, text)
  );
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
  const requesterGroups = requesterServiceSummary(details.services);
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
  const requesterRows = requesterGroups.length ? requesterGroups.map((group) => `
    <article class="requester-summary-card">
      <div><strong>${escapeHtml(group.requester)}</strong><span>${group.count} servico(s) - ${money.format(group.total)}</span></div>
      <ul>${group.services.map((service) => `<li>${escapeHtml(service.name)}: ${service.count} - ${money.format(service.total)}</li>`).join("")}</ul>
    </article>`).join("") : `<p class="meta">Nenhum solicitante informado neste periodo.</p>`;
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
      <div><span class="eyebrow">Relatório de cobrança${billing.billingNumber ? ` #${billing.billingNumber}` : ""}</span><h2>${escapeHtml(client?.name || "")}</h2><p class="meta">${billing.startDate.split("-").reverse().join("/")} a ${billing.endDate.split("-").reverse().join("/")}</p></div>
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
    <h3>Resumo por solicitante</h3>
    <div class="requester-summary-list">${requesterRows}</div>
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

function openWhatsApp(url, fallbackUrl) {
  if (!fallbackUrl) {
    window.location.href = url;
    return;
  }
  let handled = false;
  const markHandled = () => { handled = true; };
  window.addEventListener("blur", markHandled, { once: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) markHandled();
  }, { once: true });
  window.location.href = url;
  setTimeout(() => { if (!handled) window.open(fallbackUrl, "_blank", "noopener"); }, 1500);
}

function whatsappWebFallback(phone, text) {
  const base = window.matchMedia("(pointer: coarse)").matches
    ? "https://api.whatsapp.com/send"
    : "https://web.whatsapp.com/send";
  return `${base}?${phone ? `phone=${phone}&` : ""}text=${encodeURIComponent(text)}`;
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
  const clientDialogTab = event.target.closest("[data-client-dialog-tab]");
  const soundAlertButton = event.target.closest("#soundAlertButton, #settingsSoundShortcut");
  const clientServiceScrollButton = event.target.closest("[data-scroll-client-services]");
  const addRequesterButton = event.target.closest("#addRequesterButton");
  const addManagedRequesterButton = event.target.closest("[data-add-managed-requester]");
  const selectManagedRequesterButton = event.target.closest("[data-select-managed-requester]");
  const editManagedRequesterButton = event.target.closest("[data-edit-managed-requester]");
  const deleteManagedRequesterButton = event.target.closest("[data-delete-managed-requester]");
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
  if (clientDialogTab) {
    setClientDialogTab(clientDialogTab.dataset.clientDialogTab);
    return;
  }
  if (addRequesterButton) {
    const form = document.getElementById("serviceForm");
    syncServiceClientSelection();
    const result = addClientRequester(form.elements.clientId.value, form.elements.requestedBy.value);
    showAppAlert(result.ok ? "Solicitante cadastrado." : result.message, { type: result.ok ? "success" : "warning" });
    updateServiceRequesterOptions();
    if (result.ok) saveState();
    return;
  }
  if (addManagedRequesterButton) {
    const form = addManagedRequesterButton.closest("form");
    const clientId = form.elements.clientId.value;
    if (saveManagedRequester(clientId, form.elements.requesterName.value)) form.elements.requesterName.value = "";
    return;
  }
  if (selectManagedRequesterButton) {
    const form = selectManagedRequesterButton.closest("form");
    form.elements.selectedRequesterId.value = selectManagedRequesterButton.dataset.selectManagedRequester;
    renderClientRequesterManager(form.elements.clientId.value);
    return;
  }
  if (editManagedRequesterButton) {
    const form = editManagedRequesterButton.closest("form");
    const requesterId = form?.elements.selectedRequesterId.value;
    const requester = (state.clientRequesters || []).find((item) => item.id === requesterId);
    if (!requester) {
      showAppAlert("Selecione um solicitante para editar.", { type: "warning" });
      return;
    }
    const name = prompt("Nome do solicitante:", requester.name);
    if (name === null) return;
    const cleanName = name.trim().replace(/\s+/g, " ");
    const normalizedName = normalizeRequesterName(cleanName);
    if (!normalizedName) {
      showAppAlert("Informe o solicitante.", { type: "warning" });
      return;
    }
    if ((state.clientRequesters || []).some((item) =>
      item.id !== requester.id
      && item.clientId === requester.clientId
      && item.active !== false
      && item.normalizedName === normalizedName)) {
      showAppAlert("Este solicitante ja esta cadastrado para este cliente.", { type: "warning" });
      return;
    }
    requester.name = cleanName;
    requester.normalizedName = normalizedName;
    requester.active = true;
    saveState();
    renderClientRequesterManager(requester.clientId);
    showAppAlert("Solicitante atualizado com sucesso.", { type: "success" });
    return;
  }
  if (deleteManagedRequesterButton) {
    const form = deleteManagedRequesterButton.closest("form");
    const requesterId = form?.elements.selectedRequesterId.value;
    const requester = (state.clientRequesters || []).find((item) => item.id === requesterId);
    if (!requester) {
      showAppAlert("Selecione um solicitante para excluir.", { type: "warning" });
      return;
    }
    if (!(await showAppConfirm(`Excluir o solicitante "${requester.name}"?`))) return;
    requester.active = false;
    form.elements.selectedRequesterId.value = "";
    saveState();
    renderClientRequesterManager(requester.clientId);
    showAppAlert("Solicitante excluído com sucesso.", { type: "success" });
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
  const requestTabButton = event.target.closest("[data-request-tab]");
  if (requestTabButton) {
    activeRequestsTab = requestTabButton.dataset.requestTab;
    document.querySelectorAll("[data-request-tab]").forEach((button) => {
      button.classList.toggle("active", button.dataset.requestTab === activeRequestsTab);
    });
    document.getElementById("requestsTabPanel").classList.toggle("hidden", activeRequestsTab !== "requests");
    document.getElementById("trackingLinksTabPanel").classList.toggle("hidden", activeRequestsTab !== "links");
    if (activeRequestsTab === "links") renderTrackingLinksPanel();
    return;
  }
  const refreshTrackingLinksButton = event.target.closest("[data-refresh-tracking-links]");
  if (refreshTrackingLinksButton) {
    renderTrackingLinksPanel();
    return;
  }
  const copyTrackingLink = event.target.closest("[data-copy-tracking-link]");
  if (copyTrackingLink) {
    await copyText(copyTrackingLink.dataset.copyTrackingLink, "Link");
    return;
  }
  const copyTrackingIdentifier = event.target.closest("[data-copy-tracking-identifier]");
  if (copyTrackingIdentifier) {
    await copyText(copyTrackingIdentifier.dataset.copyTrackingIdentifier, "Identificador");
    return;
  }
  const copyTrackingPassword = event.target.closest("[data-copy-tracking-password]");
  if (copyTrackingPassword) {
    await copyText(copyTrackingPassword.dataset.copyTrackingPassword, "Senha");
    return;
  }
  const deleteTrackingLinkButton = event.target.closest("[data-delete-tracking-link]");
  if (deleteTrackingLinkButton) {
    if (await showAppConfirm("Excluir este link? O acesso e a senha deixam de funcionar imediatamente.")) {
      deleteTrackingLinkButton.disabled = true;
      try {
        const { data } = await window.supabaseClient.auth.getSession();
        const accessToken = data.session?.access_token;
        if (!accessToken) throw new Error("Sua sessão administrativa expirou.");
        const response = await fetch("/.netlify/functions/admin-tracking-links", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`
          },
          body: JSON.stringify({ id: deleteTrackingLinkButton.dataset.deleteTrackingLink })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Não foi possível excluir o link.");
        showAppAlert("Link excluído.", { type: "success" });
        renderTrackingLinksPanel();
      } catch (error) {
        console.error(error);
        showAppAlert(error.message, { type: "error" });
        deleteTrackingLinkButton.disabled = false;
      }
    }
    return;
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
  const serviceStatusShortcut = event.target.closest("[data-service-status-shortcut]");
  if (serviceStatusShortcut) {
    document.getElementById("serviceStatusFilter").value = serviceStatusShortcut.dataset.serviceStatusShortcut;
    showView("services");
    renderServices();
    return;
  }
  const attentionChip = event.target.closest("[data-attention]");
  if (attentionChip) {
    const kind = attentionChip.dataset.attention;
    if (kind === "overdue-billings") {
      billingOverdueOnly = true;
      document.getElementById("billingOverdueStartFilter").value = "";
      document.getElementById("billingOverdueEndFilter").value = "";
      showView("billing");
      renderBillings();
    } else if (kind === "overdue-services") {
      document.getElementById("serviceStatusFilter").value = "A fazer";
      showView("services");
      renderServices();
    } else if (kind === "new-requests") {
      document.getElementById("requestStatusFilter").value = "Novo";
      showView("requests");
      renderServiceRequests();
    }
    return;
  }
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
    if (await showAppConfirm("Excluir este pedido do historico?")) {
      state.serviceRequests = (state.serviceRequests || []).filter((item) => item.id !== requestId);
      try {
        const result = await window.dataStore?.deleteClientServiceRequest?.(requestId);
        if (result?.error) throw result.error;
        showAppAlert("Pedido excluído com sucesso.", { type: "success" });
      } catch (error) {
        console.error(error);
        showAppAlert("O pedido saiu desta tela, mas nao foi possivel excluir no banco agora.", { type: "error" });
      }
      saveState();
    }
    return;
  }
  if (cancelRequestButton) {
    const request = (state.serviceRequests || []).find((item) => item.id === cancelRequestButton.dataset.cancelClientRequest);
    if (request && await showAppConfirm("Cancelar este pedido recebido do cliente?")) {
      request.status = "Cancelado";
      request.updatedAt = new Date().toISOString();
      try {
        await window.dataStore?.updateClientServiceRequest?.(request.id, {
          status: "Cancelado",
          updated_at: request.updatedAt
        });
        showAppAlert("Pedido cancelado com sucesso.", { type: "success" });
      } catch (error) {
        console.error(error);
        showAppAlert("O pedido foi cancelado nesta tela, mas nao foi possivel atualizar no banco agora.", { type: "error" });
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
      if (dialogButton.dataset.dialog === "billingDialog") {
        renderBillingPaymentMethods();
        billingWizard.activate(window.matchMedia("(max-width: 1024px)").matches);
      }
      if (dialogButton.dataset.dialog === "billingBatchDialog") {
        renderBillingPaymentMethods("billingBatchPaymentMethods");
        const batchForm = document.getElementById("billingBatchForm");
        const week = currentOperationalWeek();
        batchForm.elements.startDate.value = week.startDate;
        batchForm.elements.endDate.value = week.endDate;
        billingBatchWizard.activate(window.matchMedia("(max-width: 1024px)").matches);
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
    const removeIndex = Number(removeAdditionalServiceButton.dataset.removeAdditionalService);
    const target = additionalServiceValues[removeIndex];
    if (!target?.id || await showAppConfirm("Remover este serviço complementar já salvo? Ele será excluído ao salvar o lançamento.")) {
      additionalServiceValues.splice(removeIndex, 1);
      if (!additionalServiceValues.length) {
        document.getElementById("serviceForm").elements.hasAdditionalServices.checked = false;
        document.getElementById("additionalServicesSection").classList.add("hidden");
      }
      renderAdditionalServiceList();
    }
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
  const manageClientRequesters = event.target.closest("[data-manage-client-requesters]");
  if (manageClientRequesters) openClientRequesterManager(clientById(manageClientRequesters.dataset.manageClientRequesters));
  const deleteClient = event.target.closest("[data-delete-client]");
  if (deleteClient) {
    const id = deleteClient.dataset.deleteClient;
    const linked = state.services.some((item) => item.clientId === id)
      || state.payments.some((item) => item.clientId === id)
      || state.billings.some((item) => item.clientId === id);
    if (linked) showAppAlert("Este cliente possui movimentações e não pode ser excluído.", { type: "warning" });
    else if (await showAppConfirm("Excluir este cliente?")) {
      state.clients = state.clients.filter((client) => client.id !== id);
      saveState();
      showAppAlert("Cliente excluído com sucesso.", { type: "success" });
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
      showAppAlert("Esta tabela está vinculada a clientes e não pode ser excluída.", { type: "warning" });
    } else if (await showAppConfirm(`Excluir a ${name}?`)) {
      state.priceTables = state.priceTables.filter((table) => table !== name);
      state.catalog.forEach((item) => delete item.prices[name]);
      saveState();
      showAppAlert("Tabela excluída com sucesso.", { type: "success" });
    }
  }

  const editCatalog = event.target.closest("[data-edit-catalog]");
  if (editCatalog) openCatalogForm(state.catalog.find((item) => item.id === editCatalog.dataset.editCatalog));
  const deleteCatalog = event.target.closest("[data-delete-catalog]");
  if (deleteCatalog) {
    const id = deleteCatalog.dataset.deleteCatalog;
    if (state.services.some((item) => item.catalogId === id)) {
      showAppAlert("Este serviço já possui lançamentos e não pode ser excluído.", { type: "warning" });
    } else if (await showAppConfirm("Excluir este serviço?")) {
      state.catalog = state.catalog.filter((item) => item.id !== id);
      saveState();
      showAppAlert("Serviço excluído com sucesso.", { type: "success" });
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
        showAppAlert("Mensagem de confirmação copiada para enviar no WhatsApp.", { type: "success" });
      } catch {
        showAppAlert(deliveryConfirmationMessage(entry), { type: "info" });
      }
      saveState();
    }
  }
  const deleteEntry = event.target.closest("[data-delete-entry]");
  if (deleteEntry) openServiceDeletion(state.services.find((item) => item.id === deleteEntry.dataset.deleteEntry));

  const editPayment = event.target.closest("[data-edit-payment]");
  if (editPayment) {
    const payment = state.payments.find((item) => item.id === editPayment.dataset.editPayment);
    if (payment?.billingId) showAppAlert("Este pagamento ja foi abatido em uma cobranca e nao pode mais ser editado.", { type: "warning" });
    else if (payment) openPaymentForm(payment);
  }
  const payBillingButton = event.target.closest("[data-pay-billing]");
  if (payBillingButton) {
    const billing = state.billings.find((item) => item.id === payBillingButton.dataset.payBilling);
    if (billing) openPaymentForm(null, billing, payBillingButton.dataset.paymentMode);
  }
  const deletePayment = event.target.closest("[data-delete-payment]");
  if (deletePayment && await showAppConfirm("Excluir este pagamento?")) {
    state.payments = state.payments.filter((item) => item.id !== deletePayment.dataset.deletePayment);
    updateBillingStatuses();
    saveState();
    showAppAlert("Pagamento excluído com sucesso.", { type: "success" });
  }

  const editMethod = event.target.closest("[data-edit-method]");
  if (editMethod) openPaymentMethodForm(state.paymentMethods.find((method) => method.id === editMethod.dataset.editMethod));
  const deleteMethod = event.target.closest("[data-delete-method]");
  if (deleteMethod && await showAppConfirm("Excluir esta forma de pagamento?")) {
    state.paymentMethods = state.paymentMethods.filter((method) => method.id !== deleteMethod.dataset.deleteMethod);
    saveState();
    showAppAlert("Forma de pagamento excluída com sucesso.", { type: "success" });
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
      showAppAlert(`Novo acesso gerado.\n\nIdentificador: ${billing.identifier}\nSenha: ${billing.password}\n\nO acesso anterior foi invalidado.`, { type: "success" });
    } catch (error) {
      console.error(error);
      showAppAlert(error.message, { type: "error" });
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
        showAppAlert(enabled
          ? "Histórico liberado para este acesso."
          : "Histórico bloqueado imediatamente.", { type: "success" });
      } catch (error) {
        console.error(error);
        showAppAlert(error.message, { type: "error" });
        toggleHistoryButton.disabled = false;
      }
    }
  }
  const cancelBillingButton = event.target.closest("[data-cancel-billing]");
  if (cancelBillingButton) {
    const billing = state.billings.find((item) => item.id === cancelBillingButton.dataset.cancelBilling);
    if (billing && billingPaidAmount(billing) > 0) {
      showAppAlert("Esta cobrança possui pagamento posterior e não pode ser cancelada.", { type: "warning" });
    } else if (billing && await showAppConfirm("Cancelar esta cobrança e liberar os lançamentos para um novo fechamento?")) {
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
        showAppAlert("Cobrança cancelada com sucesso.", { type: "success" });
      } catch (error) {
        console.error(error);
        showAppAlert(error.message, { type: "error" });
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
      showAppAlert("Esta cobrança não pode ser excluída porque já existe uma cobrança mais recente para o cliente.", { type: "warning" });
    } else if (billing && await showAppConfirm(
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
        showAppAlert("Cobrança excluída. Os lançamentos foram liberados para um novo fechamento.", { type: "success" });
      } catch (error) {
        console.error(error);
        showAppAlert(error.message || "Não foi possível excluir a cobrança.", { type: "error" });
        deleteBillingButton.disabled = false;
      }
    }
  }
  const deleteClientBillingsButton = event.target.closest("#billingDeleteClientButton");
  if (deleteClientBillingsButton) {
    const targetClientId = deleteClientBillingsButton.dataset.clientId;
    const targetBillings = state.billings.filter((item) => item.clientId === targetClientId);
    if (targetClientId && targetBillings.length && await showAppConfirm(
      `Excluir definitivamente TODAS as ${targetBillings.length} cobrança(s) de ${escapeHtml(clientById(targetClientId)?.name || "este cliente")}?\n\n`
      + "Os serviços e pagamentos vinculados continuarão registrados e ficarão disponíveis para um novo fechamento. Esta ação não pode ser desfeita."
    )) {
      deleteClientBillingsButton.disabled = true;
      try {
        for (const billing of targetBillings) {
          try {
            await cancelClientAccess(billing);
          } catch (error) {
            console.error(`Falha ao cancelar acesso da cobrança ${billing.id}:`, error);
          }
          state.services.forEach((item) => {
            if (item.billingId === billing.id) item.billingId = null;
          });
          state.payments.forEach((item) => {
            if (item.billingId === billing.id) item.billingId = null;
          });
        }
        const targetIds = new Set(targetBillings.map((item) => item.id));
        state.billings = state.billings.filter((item) => !targetIds.has(item.id));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        if (remoteReady && window.dataStore) await window.dataStore.upsertState(state);
        render();
        showAppAlert(`${targetBillings.length} cobrança(s) excluída(s).`, { type: "success" });
      } catch (error) {
        console.error(error);
        showAppAlert(error.message || "Não foi possível excluir as cobranças deste cliente.", { type: "error" });
      } finally {
        deleteClientBillingsButton.disabled = false;
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
        showAppAlert(error.message || "Não foi possível abrir o WhatsApp.", { type: "error" });
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
        showAppAlert("Não foi possível compartilhar o relatório.", { type: "error" });
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
    name: data.get("name").trim(),
    phone: data.get("phone").trim(),
    document: data.get("document").trim(),
    email: data.get("email").trim(),
    contactName: data.get("contactName").trim(),
    zipCode: data.get("zipCode").trim(),
    address: data.get("address").trim(),
    addressNumber: data.get("addressNumber").trim(),
    addressComplement: data.get("addressComplement").trim(),
    neighborhood: data.get("neighborhood").trim(),
    city: data.get("city").trim(),
    state: data.get("state").trim().toUpperCase(),
    notes: data.get("notes").trim(),
    priceGroup: data.get("priceGroup"),
    billingFrequency: data.get("billingFrequency") || "semanal"
  };
  const index = state.clients.findIndex((item) => item.id === client.id);
  const isNewClient = index < 0;
  if (index >= 0) state.clients[index] = client;
  else state.clients.push(client);
  event.currentTarget.reset();
  event.currentTarget.closest("dialog").close();
  saveState();
  showAppAlert(isNewClient ? "Cliente cadastrado com sucesso." : "Cliente atualizado com sucesso.", { type: "success" });
});

document.getElementById("priceTableForm").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const originalName = data.get("originalName");
  const name = data.get("name").trim();
  if (state.priceTables.some((table) => table === name && table !== originalName)) {
    showAppAlert("Já existe uma tabela com este nome.", { type: "warning" });
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
  showAppAlert(originalName ? "Tabela atualizada com sucesso." : "Tabela cadastrada com sucesso.", { type: "success" });
});

document.getElementById("catalogForm").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const code = String(data.get("code") || "").trim();
  if (code && state.catalog.some((catalogItem) =>
    catalogItem.code === code && catalogItem.id !== data.get("catalogId"))) {
    showAppAlert("Este código já está sendo usado por outro serviço.", { type: "warning" });
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
  const isNewCatalogItem = existingIndex < 0;
  if (existingIndex >= 0) state.catalog[existingIndex] = item;
  else state.catalog.push(item);
  event.currentTarget.reset();
  event.currentTarget.closest("dialog").close();
  saveState();
  showAppAlert(isNewCatalogItem ? "Serviço cadastrado com sucesso." : "Serviço atualizado com sucesso.", { type: "success" });
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
    showAppAlert("Selecione um cliente válido da lista.", { type: "warning" });
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
    showAppAlert(supplierSelection.error, { type: "warning" });
    supplierSelection.field?.focus();
    return;
  }
  if (form.elements.hasAdditionalServices.checked && !additionalServiceValues.length) {
    showAppAlert("Adicione pelo menos um serviço complementar ou desmarque a opção.", { type: "warning" });
    form.elements.additionalCatalogSearch.focus();
    return;
  }
  if (additionalServiceValues.some((service) => service.catalogId === data.get("catalogId"))) {
    showAppAlert("O serviço principal também está na lista de complementares. Remova-o ou escolha outro serviço.", { type: "warning" });
    return;
  }
  const newAdditionalServiceValues = additionalServiceValues.filter((service) => !service.id);
  const serviceDefinitions = [
    {
      catalogId: data.get("catalogId"),
      description: catalogItem.name,
      amount: Number(data.get("amount")),
      isSecondary: Boolean(existingEntry?.isSecondary)
    },
    ...newAdditionalServiceValues.map((service) => {
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
  const requestedBy = form.elements.hasRequester.checked
    ? String(data.get("requestedBy") || "").trim().replace(/\s+/g, " ")
    : "";
  if (requestedBy) addClientRequester(data.get("clientId"), requestedBy);
  const existingSiblingIds = existingEntry && !existingEntry.isSecondary
    ? new Set(state.services.filter((service) => service.primaryEntryId === existingEntry.id && service.isSecondary).map((service) => service.id))
    : new Set();
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
        requestedBy,
        reference,
        amount: service.amount,
        status: data.get("status"),
        serviceGroupId,
        primaryEntryId: isPrimary
          ? (existingEntry ? existingEntry.primaryEntryId || "" : "")
          : primaryEntryId,
        isSecondary: service.isSecondary,
        deliveryCode: isPrimary && existingEntry?.deliveryCode
          ? existingEntry.deliveryCode
          : randomDeliveryCode(),
        confirmationRequestedAt: isPrimary ? existingEntry?.confirmationRequestedAt || null : null,
        doneAt: ["Pronto", "Entregue"].includes(data.get("status"))
          ? (isPrimary ? existingEntry?.doneAt : null) || now
          : null,
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
  let editedSupplierSelections = [];
  if (existingEntry && !existingEntry.isSecondary) {
    const keptComplementaryIds = new Set(additionalServiceValues.filter((service) => service.id).map((service) => service.id));
    const complementaryToRemove = state.services.filter((service) =>
      existingSiblingIds.has(service.id) && !keptComplementaryIds.has(service.id) && !service.billingId);
    if (complementaryToRemove.length) {
      const removedIds = new Set(complementaryToRemove.map((service) => service.id));
      state.supplierEntries.forEach((entry) => {
        if (removedIds.has(entry.clientServiceEntryId) && entry.payableId) entry.clientServiceEntryId = null;
      });
      state.supplierEntries = state.supplierEntries.filter((entry) => !removedIds.has(entry.clientServiceEntryId) || entry.payableId);
      state.services = state.services.filter((service) => !removedIds.has(service.id));
    }
    state.services
      .filter((service) => existingSiblingIds.has(service.id) && keptComplementaryIds.has(service.id))
      .forEach((service) => {
        service.reference = createdEntries[0].reference;
        service.date = createdEntries[0].date;
        service.updatedAt = now;
      });
    editedSupplierSelections = window.supplierModule?.currentClientSupplierServiceSelections() || [];
    const keptSupplierLinkIds = new Set(editedSupplierSelections.filter((selection) => selection.id).map((selection) => selection.id));
    const supplierLinkIdsToRemove = new Set(
      state.supplierEntries
        .filter((entry) => entry.clientServiceEntryId === existingEntry.id && !keptSupplierLinkIds.has(entry.id) && !entry.payableId)
        .map((entry) => entry.id)
    );
    if (supplierLinkIdsToRemove.size) {
      state.supplierEntries = state.supplierEntries.filter((entry) => !supplierLinkIdsToRemove.has(entry.id));
    }
    editedSupplierSelections = editedSupplierSelections.filter((selection) => !selection.id);
  }
  const savedClientId = data.get("clientId");
  if (sourceRequest && !existingEntry) {
    sourceRequest.status = "Importado";
    sourceRequest.importedEntryIds = createdEntries.map((entry) => entry.id);
    sourceRequest.importedAt = now;
    sourceRequest.updatedAt = now;
  }
  form.reset();
  form.closest("dialog").close();
  const createdSupplierEntries = !existingEntry
    ? window.supplierModule?.createForClientEntries(createdEntries, supplierSelection) || []
    : (editedSupplierSelections.length
      ? window.supplierModule?.createForClientEntries([createdEntries[0]], editedSupplierSelections) || []
      : []);
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
    showAppAlert(existingEntry ? "Lançamento atualizado com sucesso." : "Lançamento salvo com sucesso.", { type: "success" });
  } catch (error) {
    console.error("Falha ao sincronizar o lançamento:", error);
    showAppAlert("O lançamento ficou salvo neste aparelho, mas a sincronização online falhou. O sistema tentará novamente.", { type: "error" });
    saveState();
  }
  if (existingEntry) return;

  if (systemSettings.offerSupplierShare !== false) {
    await window.supplierModule?.offerSupplierRequestShare(createdSupplierEntries);
  }
  if (systemSettings.askEntryContinuation === false) return;
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
  } else {
    state.supplierEntries
      .filter((item) => targetIds.has(item.clientServiceEntryId) && item.status !== "Cancelado" && item.status !== "Entregue")
      .forEach((item) => {
        item.status = "Entregue";
        item.doneAt ||= now;
        item.deliveredAt = now;
        item.lastChangedBy = adminDisplayName();
        item.updatedAt = now;
      });
  }
  event.currentTarget.closest("dialog").close();
  saveState();
  showAppAlert("Serviço cancelado com sucesso.", { type: "success" });
});

document.getElementById("deleteServiceForm").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const entry = state.services.find((item) => item.id === data.get("entryId"));
  if (!entry) return;
  const group = cancellationGroup(entry);
  const targets = [entry];
  if (data.get("deleteComplementary") === "on" && !entry.isSecondary) {
    targets.push(...group.filter((item) => item.id !== entry.id && item.isSecondary));
  }
  const targetIds = new Set(targets.map((item) => item.id));
  if (data.get("deleteSupplier") === "on") {
    state.supplierEntries = state.supplierEntries.filter((item) =>
      !targetIds.has(item.clientServiceEntryId) || Boolean(item.payableId)
    );
  }
  state.supplierEntries.forEach((item) => {
    if (targetIds.has(item.clientServiceEntryId)) item.clientServiceEntryId = null;
  });
  if (!entry.isSecondary && data.get("deleteComplementary") !== "on") {
    group.filter((item) => item.id !== entry.id && item.isSecondary).forEach((item) => {
      item.primaryEntryId = null;
      item.isSecondary = false;
      item.notes = [item.notes, "Serviço de origem excluído"].filter(Boolean).join(" · ");
    });
  }
  state.services = state.services.filter((item) => !targetIds.has(item.id));
  event.currentTarget.closest("dialog").close();
  saveState();
  showAppAlert("Lançamento excluído com sucesso.", { type: "success" });
});

document.getElementById("paymentForm").addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const form = event.currentTarget;
  syncPaymentClientSelection();
  if (!form.elements.clientId.value) {
    showAppAlert("Selecione um cliente válido da lista.", { type: "warning" });
    form.elements.clientSearch.focus();
    return;
  }
  const data = new FormData(event.currentTarget);
  const existingPayment = state.payments.find((item) => item.id === data.get("paymentId"));
  const now = new Date().toISOString();
  const billingId = data.get("billingId") || existingPayment?.billingId || null;
  const amount = Number(data.get("amount"));
  const linkedBilling = state.billings.find((item) => item.id === billingId);
  if (linkedBilling) {
    if (data.get("clientId") !== linkedBilling.clientId) {
      showAppAlert("O cliente do pagamento deve ser o mesmo da cobrança.", { type: "warning" });
      return;
    }
    const available = billingOpenAmount(linkedBilling) + Number(existingPayment?.amount || 0);
    if (amount > available + 0.001) {
      showAppAlert(`O valor máximo para esta cobrança é ${money.format(available)}.`, { type: "warning" });
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
  const isNewPayment = index < 0;
  if (index >= 0) state.payments[index] = payment;
  else state.payments.push(payment);
  updateBillingStatuses();
  event.currentTarget.reset();
  event.currentTarget.closest("dialog").close();
  saveState();
  showAppAlert(isNewPayment ? "Pagamento cadastrado com sucesso." : "Pagamento atualizado com sucesso.", { type: "success" });
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
  const isNewMethod = index < 0;
  if (index >= 0) state.paymentMethods[index] = method;
  else state.paymentMethods.push(method);
  event.currentTarget.reset();
  event.currentTarget.closest("dialog").close();
  saveState();
  showAppAlert(isNewMethod ? "Forma de pagamento cadastrada com sucesso." : "Forma de pagamento atualizada com sucesso.", { type: "success" });
});

document.getElementById("trackingForm").addEventListener("submit", async (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const form = event.currentTarget;
  syncTrackingClientSelection();
  if (!form.elements.clientId.value) {
    showAppAlert("Selecione um cliente válido da lista.", { type: "warning" });
    form.elements.clientSearch.focus();
    return;
  }
  if (form.elements.endDate.value < form.elements.startDate.value) {
    showAppAlert("A data final deve ser igual ou posterior à data inicial.", { type: "warning" });
    return;
  }

  const button = event.submitter;
  button.disabled = true;
  button.textContent = "Gerando link...";
  const formData = new FormData(form);
  const visibleServiceIds = formData.getAll("visibleServiceId");
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
        visibleServiceIds
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Não foi possível gerar o link.");
    const client = clientById(form.elements.clientId.value);
    const url = trackingLinkUrl(result.accessCode, result.fullAccessCode);
    const requestText = form.elements.allowRequests.checked
      ? "\n\nNeste link voc\u00EA tamb\u00E9m pode enviar novos pedidos."
      : "";
    const text = `Ol\u00E1, ${client?.name || ""}!\n\nAcompanhe seus servi\u00E7os de ${formatDate(form.elements.startDate.value)} a ${formatDate(form.elements.endDate.value)} pelo link abaixo:\n\n${url}${requestText}`;
    const phone = whatsappPhone(client);
    openWhatsApp(
      `whatsapp://send?${phone ? `phone=${phone}&` : ""}text=${encodeURIComponent(text)}`,
      whatsappWebFallback(phone, text)
    );
    document.getElementById("trackingAccessLink").textContent = url;
    document.getElementById("trackingAccessIdentifier").textContent = result.identifier;
    document.getElementById("trackingAccessPassword").textContent = result.password;
    document.getElementById("trackingAccessResult").classList.remove("hidden");
    if (activeRequestsTab === "links") renderTrackingLinksPanel();
  } catch (error) {
    console.error(error);
    showAppAlert(error.message, { type: "error" });
  } finally {
    button.disabled = false;
    button.textContent = "Gerar e compartilhar";
  }
});

document.getElementById("billingForm").addEventListener("submit", async (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const form = event.currentTarget;
  if (form.dataset.submitting === "1") return;
  form.dataset.submitting = "1";
  const wizardNextButton = document.getElementById("billingWizardNav")?.querySelector("[data-wizard-next]");
  if (wizardNextButton) wizardNextButton.disabled = true;
  const releaseSubmitGuard = () => {
    form.dataset.submitting = "";
    if (wizardNextButton) wizardNextButton.disabled = false;
  };
  syncBillingClientSelection();
  if (!form.elements.clientId.value) {
    showAppAlert("Selecione um cliente válido da lista.", { type: "warning" });
    form.elements.clientSearch.focus();
    releaseSubmitGuard();
    return;
  }
  const dialog = form.closest("dialog");
  const submitButton = event.submitter;
  const data = new FormData(form);
  const clientId = data.get("clientId");
  const startDate = data.get("startDate");
  const endDate = data.get("endDate");
  const billingId = crypto.randomUUID();
  const paymentMethodIds = data.getAll("paymentMethodId");
  if (!paymentMethodIds.length) {
    showAppAlert("Selecione pelo menos uma forma de pagamento.", { type: "warning" });
    releaseSubmitGuard();
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
    const confirmed = await showAppConfirm(
      `Existem ${pendingServices.length} serviço(s) ainda marcados como "A fazer":\n\n${names}\n\nOK: gerar a cobrança mesmo assim.\nCancelar: voltar e atualizar os status.`
    );
    if (!confirmed) { releaseSubmitGuard(); return; }
  }

  const billing = {
    id: billingId,
    billingNumber: nextBillingNumber(),
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
    showAppAlert(`Cobrança criada.\n\nIdentificador: ${billing.identifier}\nSenha: ${billing.password}\n\nA senha será exibida somente agora. O relatório compartilhado não inclui esses dados.`, { type: "success" });
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
    showAppAlert(error.message, { type: "error" });
    render();
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Fechar período";
    releaseSubmitGuard();
  }
});

document.getElementById("billingBatchForm").addEventListener("submit", async (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  const form = event.currentTarget;
  if (form.dataset.submitting === "1") return;
  form.dataset.submitting = "1";
  const wizardNextButton = document.getElementById("billingBatchWizardNav")?.querySelector("[data-wizard-next]");
  if (wizardNextButton) wizardNextButton.disabled = true;
  const releaseSubmitGuard = () => {
    form.dataset.submitting = "";
    if (wizardNextButton) wizardNextButton.disabled = false;
  };
  const dialog = form.closest("dialog");
  const submitButton = event.submitter;
  const data = new FormData(form);
  const startDate = data.get("startDate");
  const endDate = data.get("endDate");
  const paymentMethodIds = data.getAll("paymentMethodId");
  if (!paymentMethodIds.length) {
    showAppAlert("Selecione pelo menos uma forma de pagamento.", { type: "warning" });
    releaseSubmitGuard();
    return;
  }

  const eligibleServices = state.services.filter((item) =>
    !item.billingId && item.status !== "Cancelado"
    && item.date >= startDate && item.date <= endDate
  );
  const clientIds = [...new Set(eligibleServices.map((item) => item.clientId))];
  if (!clientIds.length) {
    showAppAlert("Nenhum cliente possui servicos pendentes de cobranca neste periodo.", { type: "warning" });
    releaseSubmitGuard();
    return;
  }
  const pendingCount = eligibleServices.filter((item) => item.status === "A fazer").length;
  const warning = pendingCount ? `\n\nAtencao: ${pendingCount} servico(s) ainda estao marcados como A fazer.` : "";
  if (!(await showAppConfirm(`Gerar ${clientIds.length} cobranca(s), uma para cada cliente com servicos no periodo?${warning}`))) { releaseSubmitGuard(); return; }

  const stateBeforeBatch = typeof structuredClone === "function"
    ? structuredClone(state)
    : JSON.parse(JSON.stringify(state));
  const selectedMethods = state.paymentMethods
    .filter((method) => paymentMethodIds.includes(method.id))
    .map((method) => ({ ...method }));
  let nextBatchBillingNumber = nextBillingNumber();
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
      id: crypto.randomUUID(), billingNumber: nextBatchBillingNumber++, clientId, startDate, endDate, amount,
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
    showAppAlert(`${successCount} cobranca(s) gerada(s) com sucesso.${failures.length ? `\n\nFalhas:\n${failures.join("\n")}` : ""}`, { type: "success" });
  } catch (error) {
    console.error(error);
    state = stateBeforeBatch;
    try {
      await (window.dataStore.saveNow?.(state) || window.dataStore.upsertState(state));
    } catch (rollbackError) {
      console.error("Falha ao desfazer o fechamento em lote:", rollbackError);
    }
    render();
    showAppAlert(`Nao foi possivel concluir o fechamento em lote. ${error.message}`, { type: "error" });
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Gerar para todos";
    releaseSubmitGuard();
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
  ["paymentClientFilterSearch", "input", syncPaymentClientFilter],
  ["paymentStatusFilter", "change", renderPayments],
  ["paymentStartFilter", "change", () => { setFinancePeriodFromInputs("payment"); refreshFinanceViews(); }],
  ["paymentEndFilter", "change", () => { setFinancePeriodFromInputs("payment"); refreshFinanceViews(); }],
  ["paymentSearch", "input", renderPayments],
  ["paymentMethodStatusFilter", "change", renderPaymentMethods],
  ["paymentMethodSearch", "input", renderPaymentMethods],
  ["billingClientFilterSearch", "input", syncBillingClientFilter],
  ["billingStatusFilter", "change", renderBillings],
  ["billingStartFilter", "change", () => { setFinancePeriodFromInputs("billing"); refreshFinanceViews(); }],
  ["billingEndFilter", "change", () => { setFinancePeriodFromInputs("billing"); refreshFinanceViews(); }],
  ["billingOverdueStartFilter", "input", renderBillings],
  ["billingOverdueEndFilter", "input", renderBillings],
  ["billingOverdueClearDates", "click", () => {
    document.getElementById("billingOverdueStartFilter").value = "";
    document.getElementById("billingOverdueEndFilter").value = "";
    renderBillings();
  }],
  ["billingSearch", "input", renderBillings],
  ["financeSummaryClientFilterSearch", "input", syncFinanceSummaryClientFilter],
  ["financeSummaryStartFilter", "change", () => { setFinancePeriodFromInputs("financeSummary"); refreshFinanceViews(); }],
  ["financeSummaryEndFilter", "change", () => { setFinancePeriodFromInputs("financeSummary"); refreshFinanceViews(); }],
  ["financeSummarySearch", "input", renderFinanceSummary],
  ["clientRequesterSearch", "input", () => {
    const form = document.querySelector("#clientRequesterDialog form");
    renderClientRequesterManager(form.elements.clientId.value);
  }]
].forEach(([id, eventName, handler]) => {
  document.getElementById(id).addEventListener(eventName, handler);
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey) return;
  if (!["INPUT", "SELECT"].includes(event.target.tagName)) return;
  const container = event.target.closest(".filters");
  if (!container) return;
  event.preventDefault();
  const fields = Array.from(container.querySelectorAll("input, select"))
    .filter((field) => !field.disabled && field.offsetParent !== null);
  const next = fields[fields.indexOf(event.target) + 1];
  if (next) next.focus();
});
document.addEventListener("click", (event) => {
  const periodButton = event.target.closest("[data-finance-period]");
  const shiftButton = event.target.closest("[data-finance-shift]");
  const overdueToggle = event.target.closest("[data-billing-overdue-toggle]");
  if (!periodButton && !shiftButton && !overdueToggle) return;
  if (overdueToggle) {
    billingOverdueOnly = !billingOverdueOnly;
    if (billingOverdueOnly) {
      document.getElementById("billingOverdueStartFilter").value = "";
      document.getElementById("billingOverdueEndFilter").value = "";
    }
    renderBillings();
    return;
  }
  billingOverdueOnly = false;
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
document.querySelector('#serviceForm input[name="hasRequester"]').addEventListener("change", toggleServiceRequesterSection);
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
document.querySelector('#trackingForm [data-tracking-services-all]').addEventListener("click", () => {
  document.querySelectorAll('#trackingServiceOptions input[name="visibleServiceId"]').forEach((checkbox) => { checkbox.checked = true; });
});
document.querySelector('#trackingForm [data-tracking-services-none]').addEventListener("click", () => {
  document.querySelectorAll('#trackingServiceOptions input[name="visibleServiceId"]').forEach((checkbox) => { checkbox.checked = false; });
});
document.getElementById("trackingAccessResult").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-copy-tracking]");
  if (!button) return;
  const fieldId = { link: "trackingAccessLink", identifier: "trackingAccessIdentifier", password: "trackingAccessPassword" }[button.dataset.copyTracking];
  const label = { link: "Link", identifier: "Identificador", password: "Senha" }[button.dataset.copyTracking];
  const field = document.getElementById(fieldId);
  await copyText(field.textContent, label);
});
document.querySelector('#paymentForm input[name="clientSearch"]').addEventListener("input", syncPaymentClientSelection);
document.querySelector('#paymentForm input[name="clientSearch"]').addEventListener("change", syncPaymentClientSelection);
document.querySelector('#billingForm input[name="clientSearch"]').addEventListener("input", syncBillingClientSelection);
document.querySelector('#billingForm input[name="clientSearch"]').addEventListener("change", syncBillingClientSelection);
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
      ...systemSettings,
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
document.getElementById("settingsAskEntryContinuation")?.addEventListener("change", (event) => {
  systemSettings = { ...systemSettings, askEntryContinuation: event.currentTarget.checked };
  saveSystemSettings();
});
document.getElementById("settingsOfferSupplierShare")?.addEventListener("change", (event) => {
  systemSettings = { ...systemSettings, offerSupplierShare: event.currentTarget.checked };
  saveSystemSettings();
});
document.getElementById("settingsPushToggle")?.addEventListener("click", async () => {
  const button = document.getElementById("settingsPushToggle");
  button.disabled = true;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) await disablePushNotifications();
    else await enablePushNotifications();
  } catch (error) {
    showAppAlert(error.message, { type: "warning" });
  } finally {
    await updatePushToggleButton();
  }
});
document.addEventListener("click", (event) => {
  const themeButton = event.target.closest("[data-theme-option]");
  if (!themeButton) return;
  systemSettings = { ...systemSettings, theme: themeButton.dataset.themeOption };
  saveSystemSettings();
  applyTheme();
});
document.getElementById("addReferenceButton").addEventListener("click", addCurrentReference);
document.querySelector('#serviceForm input[name="hasAdditionalServices"]').addEventListener("change", toggleAdditionalServices);
document.querySelector('#serviceForm input[name="additionalCatalogSearch"]').addEventListener("input", syncAdditionalCatalogSelection);
document.querySelector('#serviceForm input[name="additionalCatalogSearch"]').addEventListener("change", syncAdditionalCatalogSelection);
document.getElementById("addAdditionalServiceButton").addEventListener("click", addAdditionalService);
function closeServiceDialog() {
  serviceReferenceValues = [];
  additionalServiceValues = [];
  document.getElementById("serviceForm").reset();
  document.getElementById("additionalServicesSection").classList.add("hidden");
  window.supplierModule?.resetClientEntryOptions();
  document.getElementById("serviceDialog").close();
}
document.querySelector("[data-cancel-service-entry]").addEventListener("click", closeServiceDialog);
document.querySelector("[data-close-service-dialog]").addEventListener("click", (event) => {
  event.preventDefault();
  closeServiceDialog();
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

function keepServiceFieldVisible(field) {
  const form = document.getElementById("serviceForm");
  if (!field || !form.contains(field)) return;
  const adjustScroll = (behavior = "smooth") => {
    const viewport = window.visualViewport;
    const formRect = form.getBoundingClientRect();
    const actionBar = form.querySelector(".dialog-form-actions");
    const stickyActionHeight = actionBar && getComputedStyle(actionBar).position === "sticky"
      ? actionBar.getBoundingClientRect().height + 20
      : 0;
    const visibleTop = Math.max((viewport?.offsetTop || 0) + 18, formRect.top + 72);
    const visibleBottom = Math.min(
      (viewport?.offsetTop || 0) + (viewport?.height || window.innerHeight) - 18,
      formRect.bottom - stickyActionHeight - 12
    );
    const rect = field.getBoundingClientRect();
    if (rect.bottom > visibleBottom) {
      form.scrollBy({ top: rect.bottom - visibleBottom + 24, behavior });
    } else if (rect.top < visibleTop) {
      form.scrollBy({ top: rect.top - visibleTop - 16, behavior });
    }
  };

  requestAnimationFrame(() => adjustScroll("auto"));
  setTimeout(
    () => adjustScroll("smooth"),
    window.matchMedia("(max-width: 1024px)").matches ? 280 : 90
  );
}

document.getElementById("serviceForm").addEventListener("focusin", (event) => {
  if (event.target.matches("input, select, textarea")) keepServiceFieldVisible(event.target);
});

document.getElementById("serviceForm").addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey || event.target.tagName === "BUTTON") return;
  if (serviceWizardModeActive()) {
    const target = event.target;
    const wizardForm = document.getElementById("serviceForm");
    if (target.name === "clientSearch") {
      event.preventDefault();
      resolveServiceClientSearchOnEnter();
      document.querySelector("[data-wizard-next]").click();
      return;
    }
    if (target.name === "reference") {
      event.preventDefault();
      if (wizardForm.elements.entryId.value || !target.value.trim()) {
        document.querySelector("[data-wizard-next]").click();
      } else {
        addCurrentReference();
      }
      return;
    }
    if (target.name === "catalogSearch") {
      event.preventDefault();
      resolveServiceCatalogSearchOnEnter();
      document.querySelector("[data-wizard-next]").click();
      return;
    }
    if (target.name === "additionalCatalogSearch") {
      event.preventDefault();
      if (!target.value.trim() && additionalServiceValues.length) {
        document.querySelector("[data-wizard-next]").click();
        return;
      }
      resolveAdditionalCatalogSearchOnEnter();
      wizardForm.elements.additionalAmount.focus();
      return;
    }
    if (target.name === "additionalAmount") {
      event.preventDefault();
      addAdditionalService();
      return;
    }
    if (target.name === "supplierSearch") {
      event.preventDefault();
      window.supplierModule?.resolveSupplierSearchOnEnter(wizardForm);
      wizardForm.elements.supplierServiceSearch.focus();
      return;
    }
    if (target.name === "supplierServiceSearch") {
      event.preventDefault();
      if (!target.value.trim() && window.supplierModule?.hasClientSupplierServices()) {
        document.querySelector("[data-wizard-next]").click();
        return;
      }
      if (window.supplierModule?.resolveClientSupplierServiceSearchOnEnter()) wizardForm.elements.supplierAmount.focus();
      return;
    }
    if (target.name === "supplierAmount") {
      event.preventDefault();
      window.supplierModule?.addClientSupplierService();
      return;
    }
    event.preventDefault();
    document.querySelector("[data-wizard-next]").click();
    return;
  }
  const form = event.currentTarget;
  const supplierEnabled = form.elements.hasSupplierService.checked
    && !form.elements.hasSupplierService.disabled;
  const additionalEnabled = form.elements.hasAdditionalServices.checked
    && !form.elements.hasAdditionalServices.disabled;

  function focusField(field) {
    if (!field) return;
    try {
      field.focus({ preventScroll: true });
    } catch {
      field.focus();
    }
    keepServiceFieldVisible(field);
  }

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
        form.elements.supplierSearch,
        form.elements.supplierServiceSearch,
        form.elements.supplierAmount
      ] : []),
      form.elements.status
    ].filter((field) => field && !field.disabled);
    const index = fields.indexOf(target);
    if (index < 0) return false;
    const next = fields.slice(index + 1).find((field) => field !== form.elements.date);
    if (next) {
      focusField(next);
      return true;
    }
    form.requestSubmit(form.querySelector('button[value="default"]'));
    return true;
  }

  if (event.target.name === "hasAdditionalServices") {
    event.preventDefault();
    if (additionalEnabled) focusField(form.elements.additionalCatalogSearch);
    else focusField(form.elements.hasSupplierService);
    return;
  }
  if (event.target.name === "hasSupplierService") {
    event.preventDefault();
    if (supplierEnabled) focusField(form.elements.supplierSearch);
    else focusField(form.elements.status);
    return;
  }
  if (event.target.name === "supplierSearch") {
    event.preventDefault();
    window.supplierModule?.resolveSupplierSearchOnEnter(form);
    focusNextFrom(event.target);
    return;
  }
  if (event.target.name === "supplierServiceSearch") {
    event.preventDefault();
    if (!event.target.value.trim() && window.supplierModule?.hasClientSupplierServices()) {
      focusField(form.elements.status);
      return;
    }
    if (!window.supplierModule?.resolveClientSupplierServiceSearchOnEnter()) return;
    focusField(form.elements.supplierAmount);
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
      focusField(form.elements.hasSupplierService);
      return;
    }
    resolveAdditionalCatalogSearchOnEnter();
    focusField(form.elements.additionalAmount);
    return;
  }
  if (event.target.name === "additionalAmount") {
    event.preventDefault();
    addAdditionalService();
    return;
  }
  if (event.target.name === "reference") {
    event.preventDefault();
    if (!form.elements.entryId.value && event.target.value.trim()) {
      addCurrentReference();
      return;
    }
    focusField(form.elements.amount);
    return;
  }
  if (event.target.name === "catalogSearch") {
    event.preventDefault();
    resolveServiceCatalogSearchOnEnter();
    focusNextFrom(event.target);
    return;
  }
  event.preventDefault();
  if (event.target.name === "clientSearch") resolveServiceClientSearchOnEnter();
  focusNextFrom(event.target);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey || event.target.tagName === "BUTTON") return;
  const form = event.target.closest("dialog form");
  if (!form || form.id === "serviceForm" || form.id === "supplierEntryForm") return;
  if (event.target.tagName === "TEXTAREA") return;
  const fields = Array.from(form.querySelectorAll("input, select, textarea, button"))
    .filter((field) => !field.disabled && field.type !== "hidden" && field.offsetParent !== null);
  const index = fields.indexOf(event.target);
  if (index < 0) return;
  event.preventDefault();
  const next = fields.slice(index + 1).find((field) =>
    field.name !== "date" && (field.tagName !== "BUTTON" || field.type === "submit" || field.value === "default"));
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
document.getElementById("mobileInstallButton")?.addEventListener("click", () => {
  document.getElementById("installButton")?.click();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setMobileMenuOpen(false);
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js?v=146").then((registration) => registration.update());
}
updateSoundAlertButton();
updatePushToggleButton();
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
