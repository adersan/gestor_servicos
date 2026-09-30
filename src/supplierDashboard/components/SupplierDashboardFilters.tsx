import { useState } from "react";
import { CalendarClock } from "lucide-react";

import type { SupplierDashboardFilters as Filters } from "@/supplierDashboard/data";

export function SupplierDashboardFilters({
  filters,
  onChange,
  onWeek,
  onMonth
}: {
  filters: Filters;
  onChange: (next: Partial<Filters>) => void;
  onWeek: () => void;
  onMonth: () => void;
}) {
  const [supplierText, setSupplierText] = useState("");
  const { suppliers } = window.getAppState();

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
        <input
          type="search"
          list="supplierOptions"
          placeholder="Digite o fornecedor"
          value={supplierText}
          onChange={(event) => {
            setSupplierText(event.target.value);
            if (!event.target.value.trim()) {
              onChange({ supplierId: "" });
              return;
            }
            const match = suppliers.find((item) => item.name.toLowerCase() === event.target.value.trim().toLowerCase());
            if (match) onChange({ supplierId: match.id });
          }}
          className="min-w-[200px] flex-1 rounded-xl border border-border bg-background px-3 py-1.5 text-sm text-ink"
        />
        <input
          type="date"
          aria-label="Data inicial"
          value={filters.startDate}
          onChange={(event) => onChange({ startDate: event.target.value })}
          className="rounded-xl border border-border bg-background px-2 py-1.5 text-sm text-ink"
        />
        <input
          type="date"
          aria-label="Data final"
          value={filters.endDate}
          onChange={(event) => onChange({ endDate: event.target.value })}
          className="rounded-xl border border-border bg-background px-2 py-1.5 text-sm text-ink"
        />
      </div>
    </div>
  );
}
