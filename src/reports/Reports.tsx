import { useState } from "react";
import { ClipboardList, PlayCircle, FileDown } from "lucide-react";

import { buildReportResults, loadReportColumns, saveReportColumns, type ReportResults } from "@/reports/data";
import { ReportTypeSelect } from "@/reports/components/ReportTypeSelect";
import { ReportFilters, type ReportFiltersState } from "@/reports/components/ReportFilters";
import { ReportColumnPicker } from "@/reports/components/ReportColumnPicker";
import { ReportTable } from "@/reports/components/ReportTable";
import type { ReportFilters as ReportFiltersPayload } from "@/types/global";

function definitionById(typeId: string) {
  return window.REPORT_DEFINITIONS.find((def) => def.id === typeId) || window.REPORT_DEFINITIONS[0];
}

function defaultFilters(): ReportFiltersState {
  const week = window.currentOperationalWeek();
  return {
    startDate: week.startDate,
    endDate: week.endDate,
    clientId: "",
    clientName: "",
    supplierId: "",
    supplierName: "",
    status: "",
    extra: "",
    search: ""
  };
}

function resetFiltersKeepingPeriod(current: ReportFiltersState): ReportFiltersState {
  return { ...current, clientId: "", clientName: "", supplierId: "", supplierName: "", status: "", extra: "", search: "" };
}

// Fase 16 da migracao React: "Relatórios" (vanilla REPORT_DEFINITIONS +
// renderReportResults()/downloadReportPdf(), app.js). Motor generico de 11
// tipos de relatorio - em vez de reimplementar cada `getRows`/coluna em TS
// (duplicaria bastante regra de negocio, ex.: previousBalanceFor,
// paymentAllocationLabel, billingCurrentStatus etc.), REPORT_DEFINITIONS e
// exposto inteiro via window (array de closures do proprio app.js, cada
// `getRows`/`value`/`raw` roda no escopo original, com acesso direto ao
// `state` real). Exportacao em PDF reaproveita buildTablePdf/reportFileName
// ja existentes (window.downloadReportPdfFor, extraido de downloadReportPdf
// pra aceitar argumentos explicitos em vez de ler o DOM).
export function Reports() {
  const [typeId, setTypeId] = useState<string>(() => window.REPORT_DEFINITIONS[0].id);
  const [filters, setFilters] = useState<ReportFiltersState>(defaultFilters);
  const [columns, setColumns] = useState<Set<string>>(() => loadReportColumns(definitionById(typeId)));
  const [results, setResults] = useState<ReportResults | null>(null);

  const def = definitionById(typeId);

  const updateFilters = (next: Partial<ReportFiltersState>) => setFilters((current) => ({ ...current, ...next }));

  const handleTypeChange = (nextTypeId: string) => {
    setTypeId(nextTypeId);
    setFilters((current) => resetFiltersKeepingPeriod(current));
    setColumns(loadReportColumns(definitionById(nextTypeId)));
    setResults(null);
  };

  const handleWeek = () => {
    const week = window.currentOperationalWeek();
    updateFilters({ startDate: week.startDate, endDate: week.endDate });
  };
  const handleMonth = () => {
    const month = window.monthPeriod();
    updateFilters({ startDate: month.startDate, endDate: month.endDate });
  };

  const filtersPayload = (): ReportFiltersPayload => ({
    period: { startDate: filters.startDate, endDate: filters.endDate },
    clientId: filters.clientId,
    supplierId: filters.supplierId,
    status: filters.status,
    extra: filters.extra,
    search: filters.search
  });

  const handleGenerate = () => {
    setResults(buildReportResults(def, filtersPayload(), [...columns]));
  };

  const handleColumnsChange = (next: Set<string>) => {
    setColumns(next);
    saveReportColumns(def.id, [...next]);
    setResults(buildReportResults(def, filtersPayload(), [...next]));
  };

  const handleExportPdf = () => {
    window.downloadReportPdfFor(def.id, filtersPayload(), [...columns]);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-gradient-to-br from-[var(--primary-10)] via-surface to-surface p-5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
          <ClipboardList className="h-6 w-6" />
        </span>
        <div>
          <span className="text-xs font-bold uppercase tracking-wide text-muted">Auditoria e conferência</span>
          <h2 className="text-xl font-bold text-brand-ink">Relatórios</h2>
          <p className="text-sm text-muted">Escolha um tipo de relatório, ajuste o período e os filtros, marque as colunas que quer ver e gere a tabela.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <ReportTypeSelect value={typeId} onChange={handleTypeChange} />
      </div>

      <ReportFilters key={def.id} def={def} filters={filters} onChange={updateFilters} onWeek={handleWeek} onMonth={handleMonth} />

      <ReportColumnPicker def={def} selected={columns} onChange={handleColumnsChange} />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleGenerate}
          className="flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <PlayCircle className="h-4 w-4" />
          Gerar relatório
        </button>
        <button
          type="button"
          onClick={handleExportPdf}
          className="flex h-9 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-sm font-semibold text-ink transition-colors hover:bg-surface-2"
        >
          <FileDown className="h-4 w-4" />
          Exportar PDF
        </button>
        {results && <span className="text-sm text-muted">{results.countLabel}</span>}
      </div>

      {results?.overLimit && (
        <p className="rounded-xl bg-amber-500/15 px-3 py-2 text-xs text-amber-700">
          Muitos registros encontrados — considere estreitar o período ou os filtros antes de exportar em PDF.
        </p>
      )}

      {results && <ReportTable results={results} />}
    </div>
  );
}
