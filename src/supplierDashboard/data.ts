import { subscribeToAppRender } from "@/dashboard/data";
import type { SupplierEntry } from "@/types/global";

export { subscribeToAppRender };

export interface SupplierDashboardFilters {
  supplierId: string;
  startDate: string;
  endDate: string;
}

export interface SupplierRankingRow {
  supplierId: string;
  supplierName: string;
  count: number;
  total: number;
}

export interface SupplierServicesSnapshot {
  entries: SupplierEntry[];
  total: number;
  pendingCount: number;
  pendingTotal: number;
  doneCount: number;
  doneTotal: number;
  payableOpenTotal: number;
  ranking: SupplierRankingRow[];
}

// Espelha renderDashboard() (vanilla supplier.js) - mesmos 5 cards, mesmo
// ranking por fornecedor, mesmo resumo A fazer/Feito. So exclui "Cancelado",
// igual o vanilla.
export function loadSupplierServicesSnapshot(filters: SupplierDashboardFilters): SupplierServicesSnapshot {
  const state = window.getAppState();
  const { payableOpen, supplierById } = window.supplierModule;
  const { supplierId, startDate, endDate } = filters;

  const entries = state.supplierEntries.filter((item) =>
    item.status !== "Cancelado"
    && (!supplierId || item.supplierId === supplierId)
    && (!startDate || item.date >= startDate)
    && (!endDate || item.date <= endDate)
  );
  const total = entries.reduce((sum, item) => sum + Number(item.amount), 0);
  const pending = entries.filter((item) => item.status === "A fazer");
  const done = entries.filter((item) => item.status === "Feito");
  const pendingTotal = pending.reduce((sum, item) => sum + Number(item.amount), 0);
  const doneTotal = done.reduce((sum, item) => sum + Number(item.amount), 0);
  const payableOpenTotal = state.supplierPayables
    .filter((item) => item.status !== "Cancelada" && (!supplierId || item.supplierId === supplierId))
    .reduce((sum, item) => sum + payableOpen(item), 0);

  const rankingMap = new Map<string, SupplierRankingRow>();
  entries.forEach((item) => {
    const existing = rankingMap.get(item.supplierId) || { supplierId: item.supplierId, supplierName: supplierById(item.supplierId)?.name || "", count: 0, total: 0 };
    existing.count += 1;
    existing.total += Number(item.amount);
    rankingMap.set(item.supplierId, existing);
  });
  const ranking = [...rankingMap.values()].sort((a, b) => b.total - a.total);

  return { entries, total, pendingCount: pending.length, pendingTotal, doneCount: done.length, doneTotal, payableOpenTotal, ranking };
}

export interface SupplierFinanceRankingRow {
  supplierId: string;
  supplierName: string;
  count: number;
  open: number;
}

export interface SupplierFinanceSnapshot {
  openTotal: number;
  paidTotal: number;
  openCount: number;
  paidCount: number;
  payableCount: number;
  ranking: SupplierFinanceRankingRow[];
}

// Espelha renderDashboardFinance() (vanilla supplier.js) - filtra contas por
// endDate dentro do periodo (nao por data de lancamento, igual o vanilla).
export function loadSupplierFinanceSnapshot(filters: SupplierDashboardFilters): SupplierFinanceSnapshot {
  const state = window.getAppState();
  const { payableStatus, payableOpen, payablePaid, supplierById } = window.supplierModule;
  const { supplierId, startDate, endDate } = filters;

  const payables = state.supplierPayables.filter((item) =>
    item.status !== "Cancelada"
    && (!supplierId || item.supplierId === supplierId)
    && (!startDate || item.endDate >= startDate)
    && (!endDate || item.endDate <= endDate)
  );
  const openTotal = payables.reduce((sum, item) => sum + payableOpen(item), 0);
  const paidTotal = payables.reduce((sum, item) => sum + payablePaid(item), 0);
  const openCount = payables.filter((item) => payableOpen(item) > 0).length;
  const paidCount = payables.filter((item) => payableStatus(item) === "Paga").length;

  const rankingMap = new Map<string, SupplierFinanceRankingRow>();
  payables.forEach((item) => {
    const existing = rankingMap.get(item.supplierId) || { supplierId: item.supplierId, supplierName: supplierById(item.supplierId)?.name || "", count: 0, open: 0 };
    existing.open += payableOpen(item);
    existing.count += 1;
    rankingMap.set(item.supplierId, existing);
  });
  const ranking = [...rankingMap.values()].filter((item) => item.open > 0.001).sort((a, b) => b.open - a.open);

  return { openTotal, paidTotal, openCount, paidCount, payableCount: payables.length, ranking };
}
