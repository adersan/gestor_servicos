import { useState } from "react";
import { CalendarClock, Search } from "lucide-react";

import { reportFilterVisible } from "@/reports/data";
import type { ReportDefinition } from "@/types/global";

export interface ReportFiltersState {
  startDate: string;
  endDate: string;
  clientId: string;
  clientName: string;
  supplierId: string;
  supplierName: string;
  status: string;
  extra: string;
  search: string;
}

export function ReportFilters({
  def,
  filters,
  onChange,
  onWeek,
  onMonth
}: {
  def: ReportDefinition;
  filters: ReportFiltersState;
  onChange: (next: Partial<ReportFiltersState>) => void;
  onWeek: () => void;
  onMonth: () => void;
}) {
  const [clientText, setClientText] = useState(filters.clientName);
  const [supplierText, setSupplierText] = useState(filters.supplierName);
  const { clients, suppliers } = window.getAppState();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onWeek} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink">
          <CalendarClock className="h-3.5 w-3.5" />
          Semana atual
        </button>
        <button type="button" onClick={onMonth} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink">
          <CalendarClock className="h-3.5 w-3.5" />
          Mês atual
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-3">
        <label className="flex items-center gap-1.5 text-sm text-muted">
          Início
          <input
            type="date"
            value={filters.startDate}
            onChange={(event) => onChange({ startDate: event.target.value })}
            className="rounded-xl border border-border bg-background px-2 py-1.5 text-sm text-ink"
          />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-muted">
          Fim
          <input
            type="date"
            value={filters.endDate}
            onChange={(event) => onChange({ endDate: event.target.value })}
            className="rounded-xl border border-border bg-background px-2 py-1.5 text-sm text-ink"
          />
        </label>

        {reportFilterVisible(def, "client") && (
          <input
            type="search"
            list="serviceClientOptions"
            placeholder="Todos os clientes"
            value={clientText}
            onChange={(event) => {
              setClientText(event.target.value);
              if (!event.target.value.trim()) {
                onChange({ clientId: "", clientName: "" });
                return;
              }
              const match = clients.find((item) => item.name.toLowerCase() === event.target.value.trim().toLowerCase());
              if (match) onChange({ clientId: match.id, clientName: match.name });
            }}
            className="min-w-[180px] rounded-xl border border-border bg-background px-3 py-1.5 text-sm text-ink"
          />
        )}

        {reportFilterVisible(def, "supplier") && (
          <input
            type="search"
            list="supplierOptions"
            placeholder="Todos os fornecedores"
            value={supplierText}
            onChange={(event) => {
              setSupplierText(event.target.value);
              if (!event.target.value.trim()) {
                onChange({ supplierId: "", supplierName: "" });
                return;
              }
              const match = suppliers.find((item) => item.name.toLowerCase() === event.target.value.trim().toLowerCase());
              if (match) onChange({ supplierId: match.id, supplierName: match.name });
            }}
            className="min-w-[180px] rounded-xl border border-border bg-background px-3 py-1.5 text-sm text-ink"
          />
        )}

        {reportFilterVisible(def, "status") && (
          <select
            value={filters.status}
            onChange={(event) => onChange({ status: event.target.value })}
            className="rounded-xl border border-border bg-background px-3 py-1.5 text-sm text-ink"
          >
            <option value="">Todos os status</option>
            {(def.statusOptions || []).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}

        {reportFilterVisible(def, "extra") && def.extraFilter && (
          <select
            value={filters.extra}
            onChange={(event) => onChange({ extra: event.target.value })}
            className="rounded-xl border border-border bg-background px-3 py-1.5 text-sm text-ink"
          >
            <option value="">Todos</option>
            {def.extraFilter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}

        {reportFilterVisible(def, "search") && (
          <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3 py-1.5">
            <Search className="h-4 w-4 text-muted" />
            <input
              type="search"
              placeholder="Nome, placa, observação..."
              value={filters.search}
              onChange={(event) => onChange({ search: event.target.value })}
              className="w-full bg-transparent text-sm text-ink outline-none"
            />
          </div>
        )}
      </div>
    </div>
  );
}
