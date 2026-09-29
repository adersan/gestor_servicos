import { useState } from "react";
import { Search } from "lucide-react";

import type { ServiceFiltersState } from "@/services/data";

export function ServiceFilters({
  filters,
  onChange
}: {
  filters: ServiceFiltersState;
  onChange: (next: Partial<ServiceFiltersState>) => void;
}) {
  const [clientText, setClientText] = useState(filters.clientName);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-3">
      <input
        type="search"
        list="serviceClientOptions"
        placeholder="Digite o cliente"
        value={clientText}
        onChange={(event) => {
          const value = event.target.value;
          setClientText(value);
          // Espelha o texto digitado no input real escondido do vanilla -
          // "Lançar serviço"/FAB/"Link de acompanhamento" leem esse valor ao
          // vivo pra pre-selecionar cliente (app.js:5108/2966). Ver plano, Fase 7.
          const realInput = document.getElementById("serviceClientNameFilter") as HTMLInputElement | null;
          if (realInput) realInput.value = value;
          const client = window.uniqueClientMatch(value);
          onChange({ clientId: client?.id || "", clientName: value });
        }}
        className="min-w-[180px] flex-1 rounded-xl border border-border bg-background px-3 py-1.5 text-sm text-ink"
      />
      <select
        value={filters.status}
        onChange={(event) => onChange({ status: event.target.value })}
        className="rounded-xl border border-border bg-background px-3 py-1.5 text-sm text-ink"
      >
        <option value="">Todas as situações</option>
        <option value="A fazer">A fazer</option>
        <option value="Pronto">Feito</option>
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
          placeholder="Buscar cliente, placa ou serviço"
          value={filters.search}
          onChange={(event) => onChange({ search: event.target.value })}
          className="w-full bg-transparent text-sm text-ink outline-none"
        />
      </div>
    </div>
  );
}
