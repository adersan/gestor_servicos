import { useEffect, useState } from "react";
import { CalendarClock, ClipboardList, Link2, PlusCircle } from "lucide-react";

import { useServicesData } from "@/services/useServicesData";
import type { ServiceFiltersState } from "@/services/data";
import { ServiceFilters } from "@/services/components/ServiceFilters";
import { ServiceCard } from "@/services/components/ServiceCard";
import { ServiceSimpleTable } from "@/services/components/ServiceSimpleTable";
import { ServiceBulkActionsBar } from "@/services/components/ServiceBulkActionsBar";

const SERVICE_DISPLAY_KEY = "gestor-servicos-service-display-v1";

function defaultFilters(): ServiceFiltersState {
  const week = window.currentOperationalWeek();
  return { clientId: "", clientName: "", status: "", startDate: week.startDate, endDate: week.endDate, search: "" };
}

// Fase 7: reconstrucao de "Clientes > Lançamento" (vanilla renderServices(),
// app.js) em React+Tailwind, com paridade completa (modo simples + selecao em
// massa), decisao explicita do usuario. Ver plano em
// .claude/plans/breezy-coalescing-sonnet.md, Fase 7.
export function Services() {
  const [filters, setFilters] = useState<ServiceFiltersState>(defaultFilters);
  const [displayMode, setDisplayMode] = useState<"simple" | "full">(
    () => (localStorage.getItem(SERVICE_DISPLAY_KEY) === "simple" ? "simple" : "full")
  );
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { groups, matchingPrimaryCount, periodLabel } = useServicesData(filters);

  const selectionActive = selectionMode && displayMode === "simple";

  useEffect(() => {
    const visibleIds = new Set(groups.map((group) => group.primary.id));
    setSelectedIds((current) => {
      const next = new Set([...current].filter((id) => visibleIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [groups]);

  const updateFilters = (next: Partial<ServiceFiltersState>) => setFilters((current) => ({ ...current, ...next }));

  const toggleDisplayMode = () => {
    const next = displayMode === "simple" ? "full" : "simple";
    setDisplayMode(next);
    localStorage.setItem(SERVICE_DISPLAY_KEY, next);
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
    setSelectedIds(checked ? new Set(groups.map((group) => group.primary.id)) : new Set());
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-gradient-to-br from-[var(--primary-10)] via-surface to-surface p-5">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <ClipboardList className="h-6 w-6" />
          </span>
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-muted">Movimento diário</span>
            <h2 className="text-xl font-bold text-brand-ink">Lançamentos</h2>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            data-dialog="trackingDialog"
            className="flex h-9 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-sm font-semibold text-ink transition-colors hover:bg-surface-2"
          >
            <Link2 className="h-4 w-4" />
            Link de acompanhamento
          </button>
          <button
            type="button"
            data-dialog="serviceDialog"
            className="flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <PlusCircle className="h-4 w-4" />
            Lançar serviço
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-3">
        <div>
          <span className="block text-xs font-bold uppercase tracking-wide text-muted">Período exibido</span>
          <strong className="text-sm text-ink">{periodLabel}</strong>
          <span className="ml-2 text-sm text-muted">
            {matchingPrimaryCount ? `${matchingPrimaryCount} lançamento(s) encontrado(s)` : "Nenhum lançamento encontrado"}
          </span>
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

      <ServiceFilters filters={filters} onChange={updateFilters} />

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

      {selectionActive && <ServiceBulkActionsBar selectedIds={selectedIds} onClear={() => setSelectedIds(new Set())} />}

      {displayMode === "simple" ? (
        <ServiceSimpleTable
          groups={groups}
          selectionActive={selectionActive}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
        />
      ) : groups.length ? (
        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <ServiceCard key={group.primary.id} item={group.ordered[0]} complementary={group.ordered.slice(1)} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
          Nenhum registro por aqui.
        </p>
      )}
    </div>
  );
}
