import { shiftMonth, isSamePeriod, subscribeToAppRender, type PeriodMode } from "@/dashboard/data";
import type { Payment } from "@/types/global";
import type { Period } from "@/types/global";

export { shiftMonth, isSamePeriod, subscribeToAppRender };
export type { PeriodMode };

// dateFormat local, mesmo formato do app.js (const dateFormat = new
// Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" })) - const de nivel superior
// nao vira window.*, trivial recriar, sem regra de negocio envolvida.
export const dateFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });

function sumPaymentsIn(payments: Payment[], startDate: string, endDate: string, clientId: string | null): number {
  return payments
    .filter((item) => item.date >= startDate && item.date <= endDate && (!clientId || item.clientId === clientId))
    .reduce((sum, item) => sum + Number(item.amount), 0);
}

export interface PaymentSummary {
  previousTotal: number;
  previousLabel: string;
  todayTotal: number;
  todayLabel: string;
  currentTotal: number;
  currentLabel: string;
}

// Espelha os 3 cards "Recebido" de renderPayments() (app.js) - mesma ordem,
// mesmos limites de periodo (window.previousFinancePeriod/localDateKey), so a
// soma em si (sumPaymentsIn) e uma agregacao trivial de UI reimplementada aqui
// (no vanilla e uma closure local, nao acessivel via window).
export function loadPaymentSummary(period: Period, mode: PeriodMode, clientId: string | null): PaymentSummary {
  const state = window.getAppState();
  const previousPeriod = window.previousFinancePeriod(period, mode === "month" ? "month" : "week");
  const today = window.localDateKey(new Date());
  return {
    previousTotal: sumPaymentsIn(state.payments, previousPeriod.startDate, previousPeriod.endDate, clientId),
    previousLabel: window.periodLabel(previousPeriod),
    todayTotal: sumPaymentsIn(state.payments, today, today, clientId),
    todayLabel: window.formatDate(today),
    currentTotal: sumPaymentsIn(state.payments, period.startDate, period.endDate, clientId),
    currentLabel: window.periodLabel(period)
  };
}

export interface PaymentHistoryFilters {
  clientId: string | null;
  startDate: string;
  endDate: string;
  search: string;
}

export function loadPaymentHistory(filters: PaymentHistoryFilters): Payment[] {
  const state = window.getAppState();
  return state.payments
    .filter((item) => !filters.clientId || item.clientId === filters.clientId)
    .filter((item) => item.date >= filters.startDate && item.date <= filters.endDate)
    .filter((item) => {
      const client = window.clientById(item.clientId);
      return window.matchesSearch(filters.search, client?.name, item.note);
    })
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}
