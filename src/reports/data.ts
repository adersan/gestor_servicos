import type { ReportColumn, ReportDefinition, ReportFilters } from "@/types/global";

export type ReportFilterKey = "start" | "end" | "client" | "supplier" | "status" | "extra" | "search";

// Espelha reportFilterVisible() (app.js) - regra de UI (quais campos de
// filtro aparecem pra cada tipo), nao regra de negocio, seguro reimplementar
// direto aqui igual as demais telas desta migracao.
export function reportFilterVisible(def: ReportDefinition, key: ReportFilterKey): boolean {
  if (key === "start" || key === "end") return true;
  if (key === "client") return Boolean(def.needsClient);
  if (key === "supplier") return Boolean(def.needsSupplier);
  if (key === "status") return Boolean(def.statusOptions?.length);
  if (key === "extra") return Boolean(def.extraFilter);
  if (key === "search") return def.searchable !== false;
  return true;
}

export function loadReportColumns(def: ReportDefinition): Set<string> {
  const allKeys = new Set(def.columns.map((column) => column.key));
  const raw = localStorage.getItem(window.reportColumnStorageKey(def.id));
  if (!raw) return allKeys;
  try {
    const saved = (JSON.parse(raw) as string[]).filter((key) => allKeys.has(key));
    return new Set(saved.length ? saved : allKeys);
  } catch {
    return allKeys;
  }
}

export function saveReportColumns(defId: string, columnKeys: string[]) {
  localStorage.setItem(window.reportColumnStorageKey(defId), JSON.stringify(columnKeys));
}

export interface ReportResults {
  rows: any[];
  columns: ReportColumn[];
  totals: (number | null)[];
  countLabel: string;
  overLimit: boolean;
  error: boolean;
}

// Espelha renderReportResults() (app.js) - mesma tentativa/captura de erro,
// mesmo calculo de totais (colunas summable), mesmo aviso de limite de
// linhas (REPORT_ROW_WARNING_LIMIT).
export function buildReportResults(def: ReportDefinition, filters: ReportFilters, columnKeys: string[]): ReportResults {
  let rows: any[];
  try {
    rows = def.getRows(filters) || [];
  } catch (error) {
    console.error("Falha ao gerar relatório:", error);
    return { rows: [], columns: [], totals: [], countLabel: "Não foi possível gerar este relatório com os filtros atuais.", overLimit: false, error: true };
  }
  const columns = def.columns.filter((column) => columnKeys.includes(column.key));
  const countLabel = rows.length ? `${rows.length} registro(s) encontrado(s)` : "Nenhum registro encontrado";
  const totals = columns.map((column) =>
    column.summable ? rows.reduce((sum, row) => sum + Number(column.raw ? column.raw(row) : 0), 0) : null
  );
  return { rows, columns, totals, countLabel, overLimit: rows.length > window.REPORT_ROW_WARNING_LIMIT, error: false };
}
