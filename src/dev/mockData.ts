import type { Period, ServiceEntry } from "@/types/global";

// Stubs so <Dashboard/> pode ser montado no harness de dev sem Supabase/login -
// mesmo formato de retorno das funcoes reais em app.js, so com dados inventados.
export function installMockBridge() {
  const period: Period = { startDate: "2026-09-22", endDate: "2026-09-28" };

  const pending: ServiceEntry[] = [
    { id: "1", clientId: "c1", date: "2026-09-23", amount: 80, status: "A fazer" },
    { id: "2", clientId: "c2", date: "2026-09-24", amount: 120, status: "A fazer" }
  ];
  const done: ServiceEntry[] = [
    { id: "3", clientId: "c1", date: "2026-09-22", amount: 60, status: "Pronto" }
  ];
  const delivered: ServiceEntry[] = [
    { id: "4", clientId: "c2", date: "2026-09-21", amount: 200, status: "Entregue" }
  ];

  window.currentOperationalWeek = () => period;
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
}
