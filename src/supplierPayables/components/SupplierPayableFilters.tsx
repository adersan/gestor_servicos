import { Search } from "lucide-react";

import type { SupplierPayableFiltersState } from "@/supplierPayables/data";

export function SupplierPayableFilters({
  filters,
  onChange
}: {
  filters: SupplierPayableFiltersState;
  onChange: (next: Partial<SupplierPayableFiltersState>) => void;
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
        <option value="">Todos</option>
        <option value="open">Em aberto</option>
        <option value="paid">Pagos</option>
      </select>
      <input
        type="date"
        aria-label="Data inicial das contas"
        value={filters.startDate}
        onChange={(event) => onChange({ startDate: event.target.value })}
        className="rounded-xl border border-border bg-background px-3 py-1.5 text-sm text-ink"
      />
      <input
        type="date"
        aria-label="Data final das contas"
        value={filters.endDate}
        onChange={(event) => onChange({ endDate: event.target.value })}
        className="rounded-xl border border-border bg-background px-3 py-1.5 text-sm text-ink"
      />
      <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3 py-1.5">
        <Search className="h-4 w-4 text-muted" />
        <input
          type="search"
          placeholder="Buscar fornecedor ou situação"
          value={filters.search}
          onChange={(event) => onChange({ search: event.target.value })}
          className="w-full bg-transparent text-sm text-ink outline-none"
        />
      </div>
    </div>
  );
}
