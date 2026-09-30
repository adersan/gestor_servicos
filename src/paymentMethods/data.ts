import { subscribeToAppRender } from "@/dashboard/data";
import type { PaymentMethod } from "@/types/global";

export { subscribeToAppRender };

export interface PaymentMethodFiltersState {
  status: "" | "active" | "inactive";
  search: string;
}

// Espelha renderPaymentMethods() (app.js:2182-2201) - mesmo filtro por
// status ativo/inativo e busca por tipo/nome/instrucoes/link.
export function loadPaymentMethods(filters: PaymentMethodFiltersState): PaymentMethod[] {
  const state = window.getAppState();
  const { status, search } = filters;
  return state.paymentMethods
    .filter((method) => !status || (status === "active" ? method.active : !method.active))
    .filter((method) => window.matchesSearch(search, method.type, method.name, method.details, method.link));
}
