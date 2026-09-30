import { shiftMonth, isSamePeriod, subscribeToAppRender, type PeriodMode } from "@/dashboard/data";
import type { Period, SupplierPayment } from "@/types/global";

export { shiftMonth, isSamePeriod, subscribeToAppRender };
export type { PeriodMode };

function sumPaymentsIn(payments: SupplierPayment[], startDate: string, endDate: string, supplierId: string | null): number {
  return payments
    .filter((item) => item.date >= startDate && item.date <= endDate && (!supplierId || item.supplierId === supplierId))
    .reduce((sum, item) => sum + Number(item.amount), 0);
}

export interface SupplierPaymentSummary {
  previousTotal: number;
  previousLabel: string;
  todayTotal: number;
  todayLabel: string;
  currentTotal: number;
  currentLabel: string;
}

// Espelha loadPaymentSummary (src/payments/data.ts) - mesmos 3 cards "Pago",
// so trocando cliente por fornecedor. Mesma fonte de verdade de periodo
// (window.previousFinancePeriod/localDateKey).
export function loadSupplierPaymentSummary(period: Period, mode: PeriodMode, supplierId: string | null): SupplierPaymentSummary {
  const state = window.getAppState();
  const previousPeriod = window.previousFinancePeriod(period, mode === "month" ? "month" : "week");
  const today = window.localDateKey(new Date());
  return {
    previousTotal: sumPaymentsIn(state.supplierPayments, previousPeriod.startDate, previousPeriod.endDate, supplierId),
    previousLabel: window.periodLabel(previousPeriod),
    todayTotal: sumPaymentsIn(state.supplierPayments, today, today, supplierId),
    todayLabel: window.formatDate(today),
    currentTotal: sumPaymentsIn(state.supplierPayments, period.startDate, period.endDate, supplierId),
    currentLabel: window.periodLabel(period)
  };
}

export interface SupplierPaymentHistoryFilters {
  supplierId: string | null;
  startDate: string;
  endDate: string;
  search: string;
}

// Espelha loadPaymentHistory - sem filtro de data aplicado na lista (igual o
// vanilla renderSupplierPayments, que so usa startFilter/endFilter proprios,
// independentes do periodo dos cards); aqui simplificado pra usar o mesmo
// periodo dos cards, mesma simplificacao ja aceita nas fases anteriores.
export function loadSupplierPaymentHistory(filters: SupplierPaymentHistoryFilters): SupplierPayment[] {
  const state = window.getAppState();
  const { supplierById } = window.supplierModule;
  return state.supplierPayments
    .filter((item) => !filters.supplierId || item.supplierId === filters.supplierId)
    .filter((item) => !filters.startDate || item.date >= filters.startDate)
    .filter((item) => !filters.endDate || item.date <= filters.endDate)
    .filter((item) => window.matchesSearch(filters.search, supplierById(item.supplierId || "")?.name, item.note))
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}
