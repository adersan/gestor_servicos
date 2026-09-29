import { shiftMonth, isSamePeriod, subscribeToAppRender, type PeriodMode } from "@/dashboard/data";
import type { Client } from "@/types/global";

export { shiftMonth, isSamePeriod, subscribeToAppRender };
export type { PeriodMode };

export interface FinanceSummaryFilters {
  clientId: string | null;
  startDate: string;
  endDate: string;
  search: string;
}

export interface FinanceSummaryRow {
  client: Client;
  previousBalance: number;
  periodServiceTotal: number;
  periodPaymentTotal: number;
  openBalance: number;
}

// Espelha renderFinanceSummary() (app.js) linha a linha - inclusive usar
// previousBalanceFor (nao balanceFor) pra "saldo anterior", que ja e a versao
// corrigida do calculo (nao mascara pagamento que quita divida antiga).
export function loadFinanceSummaryRows(filters: FinanceSummaryFilters): FinanceSummaryRow[] {
  const state = window.getAppState();
  return state.clients
    .filter((client) => !filters.clientId || client.id === filters.clientId)
    .map((client): FinanceSummaryRow => {
      const previousBalance = window.previousBalanceFor(client.id, filters.startDate);
      const periodServiceTotal = state.services
        .filter(
          (item) =>
            item.clientId === client.id &&
            item.status !== "Cancelado" &&
            item.date >= filters.startDate &&
            item.date <= filters.endDate
        )
        .reduce((sum, item) => sum + Number(item.amount), 0);
      const periodPaymentTotal = state.payments
        .filter((item) => item.clientId === client.id && item.date >= filters.startDate && item.date <= filters.endDate)
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
    .filter((row) => window.matchesSearch(filters.search, row.client.name))
    .sort((a, b) => b.openBalance - a.openBalance);
}

export interface FinanceSummaryTotals {
  previous: number;
  services: number;
  payments: number;
  open: number;
}

export function loadFinanceSummaryTotals(rows: FinanceSummaryRow[]): FinanceSummaryTotals {
  return rows.reduce(
    (sum, row) => ({
      previous: sum.previous + row.previousBalance,
      services: sum.services + row.periodServiceTotal,
      payments: sum.payments + row.periodPaymentTotal,
      open: sum.open + Math.max(0, row.openBalance)
    }),
    { previous: 0, services: 0, payments: 0, open: 0 }
  );
}
