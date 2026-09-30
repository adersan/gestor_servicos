import { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";

import { useSupplierEntriesData } from "@/supplierEntries/useSupplierEntriesData";
import type { SupplierEntryFiltersState } from "@/supplierEntries/data";
import { SupplierEntryFilters } from "@/supplierEntries/components/SupplierEntryFilters";
import { SupplierEntryCard } from "@/supplierEntries/components/SupplierEntryCard";
import { SupplierEntrySimpleTable } from "@/supplierEntries/components/SupplierEntrySimpleTable";
import { SupplierEntryBulkActionsBar } from "@/supplierEntries/components/SupplierEntryBulkActionsBar";

const DISPLAY_KEY = "gestor-servicos-supplier-entry-display-v1";

function defaultFilters(): SupplierEntryFiltersState {
  const week = window.currentOperationalWeek();
  return { supplierId: "", status: "", startDate: week.startDate, endDate: week.endDate, search: "" };
}

// Fase 10 da migracao React: "Fornecedores > Lançamentos" (vanilla
// renderEntries(), supplier.js). Mesma paridade de recursos da Fase 7
// (Lancamento/Clientes): modo simples/completo + selecao em massa. Sem
// banner proprio de topo - a secao #suppliers ja tem um .section-heading
// fixo fora dos paineis ("Fornecedores" / "Lançamento direto"), igual
// aconteceu na Fase 9 (Cadastros).
export function SupplierEntries() {
  const [filters, setFilters] = useState<SupplierEntryFiltersState>(defaultFilters);
  const [displayMode, setDisplayMode] = useState<"simple" | "full">(
    () => (localStorage.getItem(DISPLAY_KEY) === "simple" ? "simple" : "full")
  );
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { entries, resultsLabel, periodLabel } = useSupplierEntriesData(filters);

  const selectionActive = selectionMode && displayMode === "simple";

  useEffect(() => {
    const visibleIds = new Set(entries.map((entry) => entry.id));
    setSelectedIds((current) => {
      const next = new Set([...current].filter((id) => visibleIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [entries]);

  const updateFilters = (next: Partial<SupplierEntryFiltersState>) => setFilters((current) => ({ ...current, ...next }));

  const toggleDisplayMode = () => {
    const next = displayMode === "simple" ? "full" : "simple";
    setDisplayMode(next);
    localStorage.setItem(DISPLAY_KEY, next);
    if (next !== "simple") {
      setSelectionMode(false);
      setSelectedIds(new Set());
    }
  };

  const toggleSelectionMode = () => {
    setSelectionMode((current) => {
      if (current) setSelectedIds(new Set());
      return !current;
    });
  };

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(entries.filter((entry) => !entry.payableId).map((entry) => entry.id)) : new Set());
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-3">
        <div>
          <span className="block text-xs font-bold uppercase tracking-wide text-muted">Semana exibida</span>
          <strong className="text-sm text-ink">{periodLabel}</strong>
          <span className="ml-2 text-sm text-muted">{resultsLabel}</span>
        </div>
        <button
          type="button"
          onClick={() => {
            const week = window.currentOperationalWeek();
            updateFilters({ startDate: week.startDate, endDate: week.endDate });
          }}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink"
        >
          <CalendarClock className="h-3.5 w-3.5" />
          Voltar para semana atual
        </button>
      </div>

      <SupplierEntryFilters filters={filters} onChange={updateFilters} />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={toggleDisplayMode}
          aria-pressed={displayMode === "simple"}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
            displayMode === "simple" ? "border-primary bg-primary text-primary-foreground" : "border-border text-ink"
          }`}
        >
          {displayMode === "simple" ? "Exibir completo" : "Exibir simples"}
        </button>
        {displayMode === "simple" && (
          <button
            type="button"
            onClick={toggleSelectionMode}
            aria-pressed={selectionMode}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
              selectionMode ? "border-primary bg-primary text-primary-foreground" : "border-border text-ink"
            }`}
          >
            Selecionar
          </button>
        )}
      </div>

      {selectionActive && <SupplierEntryBulkActionsBar selectedIds={selectedIds} entries={entries} onClear={() => setSelectedIds(new Set())} />}

      {displayMode === "simple" ? (
        <SupplierEntrySimpleTable
          entries={entries}
          selectionActive={selectionActive}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
        />
      ) : entries.length ? (
        <div className="flex flex-col gap-3">
          {entries.map((entry) => (
            <SupplierEntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">Nenhum registro por aqui.</p>
      )}
    </div>
  );
}
