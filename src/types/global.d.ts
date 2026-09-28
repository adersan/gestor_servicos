/**
 * Ponte de tipos para as funcoes/estado ja existentes em app.js (script classico,
 * viram propriedade implicita de window). Nao redeclara logica de negocio - so
 * descreve o formato do que ja existe, pra o codigo React ganhar checagem de tipo
 * sem duplicar nenhuma regra financeira/operacional. Ver plano em
 * .claude/plans/breezy-coalescing-sonnet.md, secao "Ponte de dados".
 */

export interface Period {
  startDate: string;
  endDate: string;
}

export interface Client {
  id: string;
  name: string;
  phone?: string;
  priceGroup: string;
  billingFrequency?: "semanal" | "quinzenal" | "mensal";
}

export interface ServiceEntry {
  id: string;
  clientId: string;
  date: string;
  amount: number;
  status: "A fazer" | "Pronto" | "Entregue" | "Cancelado";
  isSecondary?: boolean;
  description?: string;
  reference?: string;
  createdAt?: string;
}

export interface SupplierEntry {
  id: string;
  date: string;
  amount: number;
  status: string;
}

export interface Payment {
  id: string;
  clientId: string;
  date: string;
  amount: number;
  billingId?: string;
  createdAt?: string;
}

export interface Billing {
  id: string;
  clientId: string;
  startDate: string;
  endDate: string;
  status: "Aberta" | "Parcial" | "Paga" | "Cancelada";
  createdAt: string;
  rolledIntoBillingId?: string;
  paymentMethods?: unknown[];
  paymentMethodIds?: string[];
}

export interface ServiceRequest {
  id: string;
  status: "Novo" | string;
}

export interface ServiceMetrics {
  services: ServiceEntry[];
  primaryServices: ServiceEntry[];
  supplierEntries: SupplierEntry[];
  pending: ServiceEntry[];
  done: ServiceEntry[];
  delivered: ServiceEntry[];
  primaryTotal: number;
  supplierTotal: number;
  total: number;
}

export interface FinanceMetrics {
  servicesTotal: number;
  paymentTotal: number;
  appliedPaymentTotal: number;
  balance: number;
  billings: Billing[];
}

export interface DashboardNotifications {
  overdueServices: ServiceEntry[];
  overdueBillings: Billing[];
}

export interface AppState {
  clients: Client[];
  services: ServiceEntry[];
  supplierEntries: SupplierEntry[];
  payments: Payment[];
  billings: Billing[];
  serviceRequests: ServiceRequest[];
}

declare global {
  interface Window {
    getAppState: () => AppState;

    currentOperationalWeek: (reference?: Date) => Period;
    monthPeriod: (reference?: Date) => Period;
    defaultFinancePeriodMode: () => "week" | "month";
    defaultPeriod: () => Period;
    previousFinancePeriod: (period: Period, mode: "week" | "month") => Period;
    periodLabel: (period: Period) => string;
    dateKeysBetween: (startDate: string, endDate: string, maximum?: number) => string[];
    inPeriod: (date: string, period: Period) => boolean;

    servicesFor: (range: Period) => ServiceEntry[];
    supplierEntriesFor: (range: Period) => SupplierEntry[];
    paymentsAppliedFor: (range: Period) => Payment[];
    paymentsReceivedFor: (range: Period) => Payment[];
    billingsFor: (range: Period) => Billing[];
    serviceMetrics: (range: Period) => ServiceMetrics;
    financeMetrics: (range: Period) => FinanceMetrics;

    currentBillings: () => Billing[];
    billingPaidAmount: (billing: Billing) => number;
    billingOpenAmount: (billing: Billing) => number;
    billingCurrentStatus: (billing: Billing) => "Aberta" | "Parcial" | "Paga" | "Cancelada" | "Consolidada";
    isBillingOverdue: (billing: Billing) => boolean;
    billingAgeDays: (billing: Billing) => number;

    formatDate: (value: string) => string;
    localDateKey: (date: Date) => string;

    clientById: (id: string) => Client | undefined;
    balanceFor: (clientId: string, endDate?: string | null) => number;
    isOverdueService: (item: ServiceEntry) => boolean;
    formatServiceAge: (item: ServiceEntry) => string;
    dashboardNotifications: () => DashboardNotifications;

    showView: (viewId: string) => void;

    mountReactDashboard?: (root: HTMLElement) => void;
  }
}
