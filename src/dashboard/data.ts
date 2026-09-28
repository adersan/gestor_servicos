import type {
  Billing,
  Client,
  FinanceMetrics,
  Period,
  ServiceEntry,
  ServiceMetrics
} from "@/types/global";

export type PeriodMode = "week" | "month" | "custom";

export interface DashboardSnapshot {
  period: Period;
  serviceMetrics: ServiceMetrics;
  financeMetrics: FinanceMetrics;
}

// Todas as funcoes abaixo so agregam (filter/map/reduce) o que as funcoes
// window.* de app.js ja retornam - nenhuma regra de negocio (status, atraso,
// saldo, quitacao) e recalculada aqui. Ver ponte de dados no plano em
// .claude/plans/breezy-coalescing-sonnet.md.

export function loadDashboardSnapshot(period: Period): DashboardSnapshot {
  return {
    period,
    serviceMetrics: window.serviceMetrics(period),
    financeMetrics: window.financeMetrics(period)
  };
}

export function subscribeToAppRender(callback: () => void): () => void {
  document.addEventListener("gestor:render", callback);
  return () => document.removeEventListener("gestor:render", callback);
}

export function shiftMonth(period: Period, direction: 1 | -1): Period {
  const reference = new Date(`${period.startDate}T12:00:00`);
  reference.setDate(1);
  reference.setMonth(reference.getMonth() + direction);
  return window.monthPeriod(reference);
}

export function isSamePeriod(a: Period, b: Period): boolean {
  return a.startDate === b.startDate && a.endDate === b.endDate;
}

export interface AttentionData {
  overdueBillingsCount: number;
  overdueBillingsTotal: number;
  overdueServicesCount: number;
  newRequestsCount: number;
}

export function loadAttentionData(): AttentionData {
  const state = window.getAppState();
  const overdueBillings = window.currentBillings().filter(window.isBillingOverdue);
  const overdueServices = state.services.filter(window.isOverdueService);
  const newRequests = (state.serviceRequests || []).filter((item) => item.status === "Novo");
  return {
    overdueBillingsCount: overdueBillings.length,
    overdueBillingsTotal: overdueBillings.reduce((sum, b) => sum + window.billingOpenAmount(b), 0),
    overdueServicesCount: overdueServices.length,
    newRequestsCount: newRequests.length
  };
}

export interface FinanceSummaryData {
  openTotal: number;
  overdueTotal: number;
  receivedToday: number;
}

export function loadFinanceSummary(): FinanceSummaryData {
  const state = window.getAppState();
  const openBillings = window.currentBillings().filter((b) => window.billingOpenAmount(b) > 0);
  const overdueTotal = openBillings.filter(window.isBillingOverdue)
    .reduce((sum, b) => sum + window.billingOpenAmount(b), 0);
  const today = window.localDateKey(new Date());
  const receivedToday = state.payments.filter((p) => p.date === today)
    .reduce((sum, p) => sum + Number(p.amount), 0);
  return {
    openTotal: openBillings.reduce((sum, b) => sum + window.billingOpenAmount(b), 0),
    overdueTotal,
    receivedToday
  };
}

export interface ClientVolume {
  client: Client;
  count: number;
  amount: number;
}

export function loadClientRanking(metrics: ServiceMetrics): ClientVolume[] {
  const state = window.getAppState();
  return state.clients
    .map((client): ClientVolume => {
      const services = metrics.services.filter((item) => item.clientId === client.id);
      const primaryServices = services.filter((item) => !item.isSecondary);
      return {
        client,
        count: primaryServices.length,
        amount: services.reduce((sum, item) => sum + Number(item.amount), 0)
      };
    })
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count || b.amount - a.amount);
}

export interface ServiceAlerts {
  pendingCount: number;
  overdue: ServiceEntry[];
}

export function loadServiceAlerts(): ServiceAlerts {
  const state = window.getAppState();
  const pending = state.services.filter((item) => item.status === "A fazer" && !item.isSecondary);
  const overdue = pending.filter(window.isOverdueService);
  return { pendingCount: pending.length, overdue: overdue.slice(0, 5) };
}

export interface DailyPoint {
  date: string;
  value: number;
}

export function loadDailyVolumes(period: Period, metrics: ServiceMetrics): DailyPoint[] {
  return window.dateKeysBetween(period.startDate, period.endDate, 31).map((date) => ({
    date,
    value: metrics.primaryServices.filter((item) => item.date === date).length
  }));
}

export function loadDailyPayments(period: Period): DailyPoint[] {
  const payments = window.paymentsReceivedFor(period);
  return window.dateKeysBetween(period.startDate, period.endDate, 31).map((date) => ({
    date,
    value: payments.filter((payment) => payment.date === date)
      .reduce((sum, payment) => sum + Number(payment.amount), 0)
  }));
}

export interface BillingStatusCounts {
  paid: number;
  partial: number;
  open: number;
}

export function loadBillingStatusCounts(period: Period): BillingStatusCounts {
  const billings = window.billingsFor(period).map((billing) => window.billingCurrentStatus(billing));
  return {
    paid: billings.filter((status) => status === "Paga").length,
    partial: billings.filter((status) => status === "Parcial").length,
    open: billings.filter((status) => status === "Aberta").length
  };
}

export interface BillingAlertData {
  openCount: number;
  openTotal: number;
  overdueCount: number;
  overdueTotal: number;
}

export function loadBillingAlerts(): BillingAlertData {
  const openBillings = window.currentBillings()
    .map((billing) => ({ billing, openAmount: window.billingOpenAmount(billing) }))
    .filter((item) => item.openAmount > 0);
  const overdueBillings = openBillings.filter((item) => window.isBillingOverdue(item.billing));
  return {
    openCount: openBillings.length,
    openTotal: openBillings.reduce((sum, item) => sum + item.openAmount, 0),
    overdueCount: overdueBillings.length,
    overdueTotal: overdueBillings.reduce((sum, item) => sum + item.openAmount, 0)
  };
}

export interface AccountRow {
  client: Client;
  serviceAmount: number;
  paymentAmount: number;
  balance: number;
}

export function loadAccountList(period: Period, metrics: ServiceMetrics): AccountRow[] {
  const state = window.getAppState();
  const paymentsApplied = window.paymentsAppliedFor(period);
  return state.clients
    .map((client): AccountRow => {
      const serviceAmount = metrics.services.filter((item) => item.clientId === client.id)
        .reduce((sum, item) => sum + Number(item.amount), 0);
      const paymentAmount = paymentsApplied.filter((item) => item.clientId === client.id)
        .reduce((sum, item) => sum + Number(item.amount), 0);
      return { client, serviceAmount, paymentAmount, balance: serviceAmount - paymentAmount };
    })
    .filter((item) => item.serviceAmount || item.paymentAmount)
    .sort((a, b) => b.balance - a.balance);
}

export type { Billing };
