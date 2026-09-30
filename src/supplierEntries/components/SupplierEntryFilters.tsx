import { Search } from "lucide-react";

import type { SupplierEntryFiltersState } from "@/supplierEntries/data";

export function SupplierEntryFilters({
  filters,
  onChange
}: {
  filters: SupplierEntryFiltersState;
  onChange: (next: Partial<SupplierEntryFiltersState>) => void;
}) {
  const suppliers = window.getAppState().suppliers;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-3">
      <select
        value={filters.supplierId}
        onChange={(event) => onChange({ supplierId: event.target.value })}
        className="rounded-xl border border-border bg-background px-3 py-1.5 text-sm text-ink"
      >
        <option value="">Todos os fornecedores</option>
        {suppliers.map((supplier) => (
          <option key={supplier.id} value={supplier.id}>
            {supplier.name}
          </option>
        ))}
      </select>
      <select
        value={filters.status}
        onChange={(event) => onChange({ status: event.target.value })}
        className="rounded-xl border border-border bg-background px-3 py-1.5 text-sm text-ink"
      >
        <option value="">Todos os status</option>
        <option value="A fazer">A fazer</option>
        <option value="Feito">Feito</option>
        <option value="Entregue">Entregue</option>
        <option value="Cancelado">Cancelado</option>
      </select>
      <input
        type="date"
        aria-label="Data inicial"
        value={filters.startDate}
        onChange={(event) => onChange({ startDate: event.target.value })}
        className="rounded-xl border border-border bg-background px-3 py-1.5 text-sm text-ink"
      />
      <input
        type="date"
        aria-label="Data final"
        value={filters.endDate}
        onChange={(event) => onChange({ endDate: event.target.value })}
        className="rounded-xl border border-border bg-background px-3 py-1.5 text-sm text-ink"
      />
      <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3 py-1.5">
        <Search className="h-4 w-4 text-muted" />
        <input
          type="search"
          placeholder="Buscar serviço, fornecedor ou referência"
          value={filters.search}
          onChange={(event) => onChange({ search: event.target.value })}
          className="w-full bg-transparent text-sm text-ink outline-none"
        />
      </div>
    </div>
  );
}
