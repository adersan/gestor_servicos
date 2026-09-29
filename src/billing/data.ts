import { shiftMonth, isSamePeriod, subscribeToAppRender, type PeriodMode } from "@/dashboard/data";
import type { Billing } from "@/types/global";

export { shiftMonth, isSamePeriod, subscribeToAppRender };
export type { PeriodMode };

export type BillingStatusFilter = "" | "paid" | "open";

export interface BillingFilters {
  clientId: string | null;
  startDate: string;
  endDate: string;
  status: BillingStatusFilter;
  search: string;
  overdueOnly: boolean;
}

// Espelha exatamente o filtro de renderBillings() (app.js) - inclusive o
// detalhe de comparar por endDate (nao startDate) dentro do periodo, e o
// modo "Atrasadas" ignorando o filtro de status. Nenhuma regra de negocio
// nova, so a mesma sequencia de .filter() em cima de window.getAppState().
export function loadBillingList(filters: BillingFilters): Billing[] {
  const state = window.getAppState();
  return state.billings
    .filter((item) => !filters.clientId || item.clientId === filters.clientId)
    .filter((item) => !filters.overdueOnly || window.isBillingOverdue(item))
    .filter((item) => filters.overdueOnly || !filters.startDate || item.endDate >= filters.startDate)
    .filter((item) => filters.overdueOnly || !filters.endDate || item.endDate <= filters.endDate)
    .filter((item) => {
      if (filters.overdueOnly) return true;
      const status = window.billingCurrentStatus(item);
      if (filters.status === "paid") return status === "Paga";
      if (filters.status === "open") return status === "Aberta" || status === "Parcial";
      return true;
    })
    .filter((item) =>
      window.matchesSearch(
        filters.search,
        window.clientById(item.clientId)?.name,
        item.identifier,
        item.status,
        item.startDate,
        item.endDate,
        item.billingNumber ? `#${item.billingNumber}` : ""
      )
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function loadOverdueCount(): number {
  return window.currentBillings().filter(window.isBillingOverdue).length;
}

// Mesma regra do vanilla accessBillingByClient: a cobranca nao-cancelada mais
// recente de cada cliente e a "dona" do acesso - so ela mostra o botao de
// bloquear/liberar historico.
export function loadAccessBillingIdByClient(): Map<string, string> {
  const state = window.getAppState();
  const map = new Map<string, string>();
  state.billings
    .filter((billing) => billing.status !== "Cancelada")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .forEach((billing) => map.set(billing.clientId, billing.id));
  return map;
}
