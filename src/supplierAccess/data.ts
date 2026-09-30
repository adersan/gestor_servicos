import { subscribeToAppRender } from "@/dashboard/data";
import type { SupplierEntry } from "@/types/global";

export { subscribeToAppRender };

export interface SupplierOnlineFiltersState {
  supplierId: string;
  clientId: string;
  startDate: string;
  endDate: string;
}

// Espelha renderSupplierOnlineEntries() (supplier.js:631-654) - mesmo
// filtro/ordenacao. Lista somente leitura (sem botoes de acao - o vanilla
// tambem nao tem nenhum nessa aba).
export function loadSupplierOnlineEntries(filters: SupplierOnlineFiltersState): SupplierEntry[] {
  const state = window.getAppState();
  const { supplierId, clientId, startDate, endDate } = filters;
  return state.supplierEntries
    .filter((item) => item.source === "Fornecedor")
    .filter((item) => !supplierId || item.supplierId === supplierId)
    .filter((item) => !clientId || item.clientId === clientId)
    .filter((item) => !startDate || item.date >= startDate)
    .filter((item) => !endDate || item.date <= endDate)
    .sort((a, b) => b.date.localeCompare(a.date));
}
