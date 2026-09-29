import { Search } from "lucide-react";

export function FinanceSummaryFilters({
  clientName,
  onClientChange,
  search,
  onSearchChange
}: {
  clientName: string;
  onClientChange: (clientId: string | null, name: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-3">
      <input
        type="search"
        list="serviceClientOptions"
        placeholder="Filtrar por cliente"
        defaultValue={clientName}
        onChange={(event) => {
          if (!event.target.value.trim()) {
            onClientChange(null, "");
            return;
          }
          const client = window.uniqueClientMatch(event.target.value);
          if (client) onClientChange(client.id, client.name);
        }}
        className="min-w-[200px] flex-1 rounded-xl border border-border bg-background px-3 py-1.5 text-sm text-ink"
      />
      <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3 py-1.5">
        <Search className="h-4 w-4 text-muted" />
        <input
          type="search"
          placeholder="Buscar cliente"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="w-full bg-transparent text-sm text-ink outline-none"
        />
      </div>
    </div>
  );
}
