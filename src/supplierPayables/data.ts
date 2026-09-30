import { subscribeToAppRender } from "@/dashboard/data";
import type { SupplierPayable } from "@/types/global";

export { subscribeToAppRender };

export interface SupplierPayableFiltersState {
  supplierId: string;
  status: string;
  startDate: string;
  endDate: string;
  search: string;
}

export interface SupplierPayablesResult {
  payables: SupplierPayable[];
  totalOpen: number;
  totalPaid: number;
  openCount: number;
}

// Espelha renderPayables() (supplier.js:483-505) - mesmo filtro/ordenacao e
// resumo. Simplificacao deliberada: os atalhos de periodo (semana/mes) usam
// so window.currentOperationalWeek()/monthPeriod() localmente - a navegacao
// anterior/proximo periodo (data-finance-shift) compartilhada com outras
// telas de Financeiro nao foi portada.
export function loadSupplierPayables(filters: SupplierPayableFiltersState): SupplierPayablesResult {
  const state = window.getAppState();
  const { payableStatus, payableOpen, supplierById } = window.supplierModule;
  const { supplierId, status, startDate, endDate, search } = filters;

  state.supplierPayables.forEach((item) => {
    item.status = payableStatus(item);
  });

  const payables = state.supplierPayables
    .filter((item) => !supplierId || item.supplierId === supplierId)
    .filter((item) => !status || (status === "open" ? payableOpen(item) > 0 : payableStatus(item) === "Paga"))
    .filter((item) => !startDate || item.endDate >= startDate)
    .filter((item) => !endDate || item.endDate <= endDate)
    .filter((item) => item.status !== "Cancelada")
    .filter((item) => window.matchesSearch(search, supplierById(item.supplierId)?.name, payableStatus(item)))
    .sort((a, b) => b.endDate.localeCompare(a.endDate));

  const totalOpen = state.supplierPayables.filter((item) => item.status !== "Cancelada").reduce((sum, item) => sum + payableOpen(item), 0);
  const totalPaid = state.supplierPayments.reduce((sum, item) => sum + Number(item.amount), 0);
  const openCount = state.supplierPayables.filter((item) => payableOpen(item) > 0 && item.status !== "Cancelada").length;

  return { payables, totalOpen, totalPaid, openCount };
}
