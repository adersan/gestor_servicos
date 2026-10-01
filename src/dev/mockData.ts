import type { Client, Period, ServiceEntry } from "@/types/global";

// Stubs so <Dashboard/> pode ser montado no harness de dev sem Supabase/login -
// mesmo formato de retorno das funcoes reais em app.js, so com dados inventados.
export function installMockBridge() {
  const period: Period = { startDate: "2026-09-22", endDate: "2026-09-28" };

  const clients: Client[] = [
    { id: "c1", name: "Ana Paula Ferreira" },
    { id: "c2", name: "Carlos Eduardo Souza" }
  ] as Client[];

  const pending: ServiceEntry[] = [
    { id: "1", clientId: "c1", date: "2026-09-23", amount: 80, status: "A fazer" },
    { id: "2", clientId: "c2", date: "2026-09-24", amount: 120, status: "A fazer" }
  ] as ServiceEntry[];
  const done: ServiceEntry[] = [
    { id: "3", clientId: "c1", date: "2026-09-22", amount: 60, status: "Pronto" }
  ] as ServiceEntry[];
  const delivered: ServiceEntry[] = [
    { id: "4", clientId: "c2", date: "2026-09-21", amount: 200, status: "Entregue" }
  ] as ServiceEntry[];

  window.currentOperationalWeek = () => period;
  window.defaultPeriod = () => period;
  window.defaultFinancePeriodMode = () => "week";
  window.monthPeriod = () => ({ startDate: "2026-09-01", endDate: "2026-09-30" });
  window.serviceMetrics = () => ({
    services: [...pending, ...done, ...delivered],
    primaryServices: [...pending, ...done, ...delivered],
    supplierEntries: [],
    pending,
    done,
    delivered,
    primaryTotal: 460,
    supplierTotal: 0,
    total: 460
  });
  window.financeMetrics = () => ({
    servicesTotal: 460,
    paymentTotal: 300,
    appliedPaymentTotal: 300,
    balance: 160,
    billings: []
  });
  window.showView = (viewId: string) => {
    // eslint-disable-next-line no-console
    console.log("[mock] showView ->", viewId);
  };

  window.getAppState = () => ({
    clients,
    services: [...pending, ...done, ...delivered],
    suppliers: [],
    supplierEntries: [],
    payments: [],
    billings: [],
    serviceRequests: [],
    supplierPayables: [],
    supplierPayments: [],
    paymentMethods: [],
    catalog: [],
    priceTables: []
  }) as unknown as ReturnType<typeof window.getAppState>;
  window.currentBillings = () => [];
  window.isBillingOverdue = () => false;
  window.billingOpenAmount = () => 0;
  window.isOverdueService = () => false;
  window.localDateKey = (date: Date) => date.toISOString().slice(0, 10);
  window.dateKeysBetween = (start: string) => [start];
  window.paymentsReceivedFor = () => [];
  window.paymentsAppliedFor = () => [];
  window.billingsFor = () => [];
  window.billingCurrentStatus = () => "Aberta";
}
