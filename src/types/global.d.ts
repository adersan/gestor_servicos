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
  document?: string;
  email?: string;
  city?: string;
  state?: string;
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
  requestedBy?: string;
  serviceGroupId?: string;
  primaryEntryId?: string;
  notes?: string;
  cancellationReason?: string;
  cancellationOriginalAmount?: number | null;
  confirmationRequestedAt?: string;
  deliveredAt?: string | null;
  deliverySource?: string;
  deliveryCode?: string;
  doneAt?: string | null;
  updatedAt?: string;
}

export interface ServiceGroup {
  primary: ServiceEntry;
  complementary: ServiceEntry[];
  ordered: ServiceEntry[];
}

export interface SupplierEntry {
  id: string;
  date: string;
  amount: number;
  status: "A fazer" | "Feito" | "Entregue" | "Cancelado" | string;
  supplierId: string;
  clientId?: string;
  description: string;
  reference?: string;
  source: string;
  payableId?: string;
  cancellationReason?: string;
  cancellationOriginalAmount?: number | null;
  lastChangedBy?: string;
  notes?: string;
  clientServiceEntryId?: string;
  createdAt?: string;
  updatedAt?: string;
  doneAt?: string | null;
  deliveredAt?: string | null;
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  document?: string;
  isDefault?: boolean;
}

export interface SupplierPaymentPreference {
  id: string;
  method: string;
  amount: number;
}

export interface SupplierPayable {
  id: string;
  supplierId: string;
  startDate: string;
  endDate: string;
  amount: number;
  status: "Aberta" | "Parcial" | "Paga" | "Cancelada" | string;
  createdAt?: string;
  snapshot?: {
    paymentPreferences?: SupplierPaymentPreference[];
    paymentPreference?: { method: string; amount: number };
  };
}

export interface SupplierPayment {
  id: string;
  payableId?: string;
  supplierId?: string;
  amount: number;
  date: string;
  method?: string;
  note?: string;
  createdAt?: string;
  paymentSource?: string;
}

export interface Payment {
  id: string;
  clientId: string;
  date: string;
  amount: number;
  billingId?: string;
  createdAt?: string;
  note?: string;
  method?: string;
  paymentSource?: string;
}

export interface Billing {
  id: string;
  clientId: string;
  amount: number;
  startDate: string;
  endDate: string;
  status: "Aberta" | "Parcial" | "Paga" | "Cancelada";
  createdAt: string;
  rolledIntoBillingId?: string;
  paymentMethods?: unknown[];
  paymentMethodIds?: string[];
  billingNumber?: number;
  statusReason?: string;
  creditGenerated?: number;
  sendHistory?: { sentAt: string }[];
  historyEnabled?: boolean;
  identifier?: string;
  password?: string;
}

export interface ServiceRequest {
  id: string;
  clientId: string;
  status: "Novo" | "Importado" | "Cancelado" | string;
  serviceName?: string;
  requestedBy?: string;
  notes?: string;
  references?: string[];
  amount?: number;
  requestedDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TrackingLink {
  id: string;
  clientName: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  accessCode: string;
  fullAccessCode?: string;
  identifier?: string;
  password?: string;
}

export interface SupplierLink {
  id: string;
  supplierName: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  accessCode: string;
  identifier?: string;
  password?: string;
  expiresAt?: string | null;
}

export interface PaymentMethod {
  id: string;
  type: string;
  name: string;
  details?: string;
  link?: string;
  active: boolean;
}

export interface CatalogItem {
  id: string;
  code?: string;
  name: string;
  prices: Record<string, number>;
}

export interface SystemSettings {
  periodMode: "week" | "month";
  weekStartDay: number;
  weekEndDay: number;
  askEntryContinuation: boolean;
  offerSupplierShare: boolean;
  theme: string;
}

export interface PushToggleState {
  supported: boolean;
  disabled: boolean;
  label: string;
  status: string;
}

export interface ReportColumn {
  key: string;
  label: string;
  align?: "right";
  summable?: boolean;
  pdfWidth?: number;
  raw?: (row: any) => number;
  value: (row: any) => string;
}

export interface ReportFilters {
  period: Period;
  clientId?: string;
  supplierId?: string;
  status?: string;
  extra?: string;
  search?: string;
}

export interface ReportOption {
  value: string;
  label: string;
}

export interface ReportDefinition {
  id: string;
  group: string;
  label: string;
  needsClient?: boolean;
  needsSupplier?: boolean;
  searchable?: boolean;
  statusOptions?: ReportOption[];
  extraFilter?: { label: string; options: ReportOption[] };
  columns: ReportColumn[];
  getRows: (filters: ReportFilters) => any[];
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
  suppliers: Supplier[];
  supplierEntries: SupplierEntry[];
  supplierPayables: SupplierPayable[];
  supplierPayments: SupplierPayment[];
  payments: Payment[];
  paymentMethods: PaymentMethod[];
  billings: Billing[];
  serviceRequests: ServiceRequest[];
  catalog: CatalogItem[];
  priceTables: string[];
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
    previousBalanceFor: (clientId: string, startFilter: string) => number;
    billingFrequencyLabel: (frequency: string) => string;
    isOverdueService: (item: ServiceEntry) => boolean;
    formatServiceAge: (item: ServiceEntry) => string;
    dashboardNotifications: () => DashboardNotifications;

    serviceStatusLabel: (status: string) => string;
    deliveredLabel: (item: ServiceEntry) => string;
    serviceStatusDates: (item: ServiceEntry) => string;
    originCancelledNote: (item: ServiceEntry) => string;
    applyServiceStatus: (entry: ServiceEntry, status: string, changedAt?: string) => void;
    saveState: () => void;
    showAppConfirm: (message: string, opts?: { title?: string; confirmText?: string; cancelText?: string; danger?: boolean }) => Promise<boolean>;
    showAppAlert: (message: string, opts?: { type?: "success" | "warning" | "error" | "info" }) => void;
    openServiceQuickView: (primaryId: string) => void;
    serviceGroupsById: Map<string, ServiceGroup>;
    SERVICE_STATUS_NEXT_TARGETS: Record<string, string[]>;
    SERVICE_BULK_STATUS_LABELS: Record<string, string>;
    SERVICE_SIMPLE_STATUS_INITIALS: Record<string, string>;

    matchesSearch: (search: string, ...values: Array<string | undefined | null>) => boolean;
    uniqueClientMatch: (value: string) => Client | null;

    paymentIsCredit: (payment: Payment) => boolean;
    paymentAllocationState: (payment: Payment) => "credit" | "loose" | "linked-open" | "linked-paid";
    paymentAllocationLabel: (payment: Payment) => string;
    billingNumberLabel: (billing: Billing) => string;
    openPaymentDetail: (payment: Payment) => void;

    billingPaymentSummary: (billing: Billing) => string;
    billingRolloverTarget: (billing: Billing) => Billing | null;
    billingHasCardPaymentMethod: (billing: Billing) => boolean;
    billingStatusLabel: (billing: Billing) => string;
    billingCardStatusClass: (billing: Billing) => string;
    openBillingReport: (billingId: string) => void;

    showView: (viewId: string) => void;

    REPORT_DEFINITIONS: ReportDefinition[];
    REPORT_ROW_WARNING_LIMIT: number;
    reportColumnStorageKey: (typeId: string) => string;
    downloadReportPdfFor: (typeId: string, filters: ReportFilters, columnKeys: string[]) => void;

    getSystemSettings: () => SystemSettings;
    updatePeriodMode: (mode: "week" | "month") => void;
    updateWeekDays: (startDay: number, endDay: number) => void;
    updateAskEntryContinuation: (checked: boolean) => void;
    updateOfferSupplierShare: (checked: boolean) => void;
    applyTheme: () => void;
    pushToggleState: () => Promise<PushToggleState>;
    togglePushNotifications: () => Promise<void>;

    supabaseClient: {
      auth: {
        getSession: () => Promise<{ data: { session: { access_token: string } | null } }>;
      };
    };

    mountReactDashboard?: (root: HTMLElement) => void;
    mountReactPayments?: (root: HTMLElement) => void;
    mountReactBilling?: (root: HTMLElement) => void;
    mountReactFinanceSummary?: (root: HTMLElement) => void;
    mountReactClients?: (root: HTMLElement) => void;
    mountReactCatalog?: (root: HTMLElement) => void;
    mountReactServices?: (root: HTMLElement) => void;
    mountReactRequests?: (root: HTMLElement) => void;
    mountReactSupplierRecords?: (root: HTMLElement) => void;
    mountReactSupplierEntries?: (root: HTMLElement) => void;
    mountReactSupplierAccess?: (root: HTMLElement) => void;
    mountReactSupplierPayables?: (root: HTMLElement) => void;
    mountReactSupplierPayments?: (root: HTMLElement) => void;
    mountReactSupplierDashboard?: (root: HTMLElement) => void;
    mountReactPaymentMethods?: (root: HTMLElement) => void;
    mountReactReports?: (root: HTMLElement) => void;
    mountReactSettings?: (root: HTMLElement) => void;
    mountReactHelp?: (root: HTMLElement) => void;
    mountReactExtras?: (root: HTMLElement) => void;
    extrasSyncToolOptionsVisibility?: () => void;

    supplierModule: {
      clientName: (id: string) => string;
      supplierById: (id: string) => Supplier | undefined;
      originCancelledNote: (item: SupplierEntry) => string;
      supplierEntryStatusDates: (item: SupplierEntry) => string;
      openSupplierEntryQuickView: (id: string) => void;
      supplierEntryBulkStatusEligible: (entry: SupplierEntry, targetStatus: string) => boolean;
      applySupplierEntryStatus: (entry: SupplierEntry, targetStatus: string, changedAt: string) => void;
      payableStatus: (payable: SupplierPayable) => "Aberta" | "Parcial" | "Paga" | "Cancelada";
      payableOpen: (payable: SupplierPayable) => number;
      payablePaid: (payable: SupplierPayable) => number;
      supplierPreferencesOf: (payable: SupplierPayable) => SupplierPaymentPreference[];
      supplierPaymentAllocationState: (payment: SupplierPayment) => "credit" | "loose" | "linked-open" | "linked-paid";
      supplierPaymentAllocationLabel: (payment: SupplierPayment) => string;
      openSupplierPaymentDetail: (payment: SupplierPayment) => void;
      SUPPLIER_ENTRY_STATUS_NEXT_TARGETS: Record<string, string[]>;
      SUPPLIER_ENTRY_BULK_STATUS_LABELS: Record<string, string>;
      SUPPLIER_ENTRY_SIMPLE_STATUS_INITIALS: Record<string, string>;
    };
  }
}
