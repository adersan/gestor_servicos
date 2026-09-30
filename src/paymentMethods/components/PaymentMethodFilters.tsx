import { Search } from "lucide-react";

import type { PaymentMethodFiltersState } from "@/paymentMethods/data";

export function PaymentMethodFilters({
  filters,
  onChange
}: {
  filters: PaymentMethodFiltersState;
  onChange: (next: Partial<PaymentMethodFiltersState>) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-3">
      <select
        value={filters.status}
        onChange={(event) => onChange({ status: event.target.value as PaymentMethodFiltersState["status"] })}
        className="rounded-xl border border-border bg-background px-3 py-1.5 text-sm text-ink"
      >
        <option value="">Ativas e inativas</option>
        <option value="active">Somente ativas</option>
        <option value="inactive">Somente inativas</option>
      </select>
      <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3 py-1.5">
        <Search className="h-4 w-4 text-muted" />
        <input
          type="search"
          placeholder="Buscar tipo, nome ou chave"
          value={filters.search}
          onChange={(event) => onChange({ search: event.target.value })}
          className="w-full bg-transparent text-sm text-ink outline-none"
        />
      </div>
    </div>
  );
}
