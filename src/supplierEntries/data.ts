import { subscribeToAppRender } from "@/dashboard/data";
import type { SupplierEntry } from "@/types/global";

export { subscribeToAppRender };

export interface SupplierEntryFiltersState {
  supplierId: string;
  status: string;
  startDate: string;
  endDate: string;
  search: string;
}

export interface SupplierEntriesResult {
  entries: SupplierEntry[];
  resultsLabel: string;
  periodLabel: string;
}

const STATUS_ORDER: Record<string, number> = { "A fazer": 0, Feito: 1, Entregue: 2, Cancelado: 3 };

// Espelha renderEntries() (supplier.js:422-467) - mesmo filtro/ordenacao.
// Simplificacao deliberada: o filtro dedicado por cliente (supplierEntryClientFilter)
// nao foi portado - a busca livre ja cobre nome do cliente na mesma string
// combinada que o vanilla usa (matchesSearch cobre a mesma ideia de
// normalized(...).includes(...)). Ver Fase 10.
export function loadSupplierEntries(filters: SupplierEntryFiltersState): SupplierEntriesResult {
  const state = window.getAppState();
  const { supplierId, status, startDate, endDate, search } = filters;
  const { clientName, supplierById } = window.supplierModule;

  const entries = [...state.supplierEntries]
    .filter((item) => !supplierId || item.supplierId === supplierId)
    .filter((item) => !status || item.status === status)
    .filter((item) => !startDate || item.date >= startDate)
    .filter((item) => !endDate || item.date <= endDate)
    .filter((item) =>
      window.matchesSearch(search, item.description, item.reference, clientName(item.clientId || ""), supplierById(item.supplierId)?.name)
    )
    .sort((a, b) => {
      const statusDifference = (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3);
      if (statusDifference) return statusDifference;
      const dateDifference = b.date.localeCompare(a.date);
      if (dateDifference) return dateDifference;
      return String(b.createdAt || b.updatedAt || "").localeCompare(String(a.createdAt || a.updatedAt || ""));
    });

  const periodLabel = startDate && endDate ? `${window.formatDate(startDate)} a ${window.formatDate(endDate)}` : "Todos os períodos";
  const resultsLabel = entries.length ? `${entries.length} lançamento(s) encontrado(s)` : "Nenhum lançamento encontrado";

  return { entries, resultsLabel, periodLabel };
}
