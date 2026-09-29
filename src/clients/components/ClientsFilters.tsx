import { Search } from "lucide-react";

export function ClientsFilters({ search, onSearchChange }: { search: string; onSearchChange: (value: string) => void }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface p-3">
      <Search className="h-4 w-4 text-muted" />
      <input
        type="search"
        placeholder="Buscar cliente, telefone ou tabela"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        className="w-full bg-transparent text-sm text-ink outline-none"
      />
    </div>
  );
}
