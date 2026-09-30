import { Search } from "lucide-react";

import type { RequestFiltersState } from "@/requests/data";

export function RequestFilters({
  filters,
  onChange
}: {
  filters: RequestFiltersState;
  onChange: (next: Partial<RequestFiltersState>) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-3">
      <select
        value={filters.status}
        onChange={(event) => onChange({ status: event.target.value })}
        className="rounded-xl border border-border bg-background px-3 py-1.5 text-sm text-ink"
      >
        <option value="Novo">Novos</option>
        <option value="">Todos</option>
        <option value="Importado">Importados</option>
        <option value="Cancelado">Cancelados</option>
      </select>
      <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3 py-1.5">
        <Search className="h-4 w-4 text-muted" />
        <input
          type="search"
          placeholder="Buscar cliente, placa, serviço ou solicitante"
          value={filters.search}
          onChange={(event) => onChange({ search: event.target.value })}
          className="w-full bg-transparent text-sm text-ink outline-none"
        />
      </div>
    </div>
  );
}
