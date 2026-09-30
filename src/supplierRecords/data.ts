import { subscribeToAppRender } from "@/dashboard/data";
import type { Supplier } from "@/types/global";

export { subscribeToAppRender };

export interface SupplierRecordsFiltersState {
  search: string;
}

// Espelha renderRecords() (supplier.js:282-299) - mesmo filtro por
// nome/telefone/documento (matchesSearch cobre a mesma ideia de
// normalized(...).includes(...) usada la, sem duplicar a regra).
export function loadSuppliers(filters: SupplierRecordsFiltersState): Supplier[] {
  const state = window.getAppState();
  const { search } = filters;
  return state.suppliers.filter((item) => window.matchesSearch(search, item.name, item.phone, item.document));
}
