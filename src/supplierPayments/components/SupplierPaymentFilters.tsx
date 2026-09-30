import { useState } from "react";
import { Search } from "lucide-react";

export function SupplierPaymentFilters({
  supplierName,
  onSupplierChange,
  search,
  onSearchChange
}: {
  supplierName: string;
  onSupplierChange: (supplierId: string | null, name: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
}) {
  const [supplierText, setSupplierText] = useState(supplierName);
  const { suppliers } = window.getAppState();

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-3">
      <input
        type="search"
        list="supplierOptions"
        placeholder="Filtrar por fornecedor"
        value={supplierText}
        onChange={(event) => {
          setSupplierText(event.target.value);
          if (!event.target.value.trim()) {
            onSupplierChange(null, "");
            return;
          }
          const match = suppliers.find((item) => item.name.toLowerCase() === event.target.value.trim().toLowerCase());
          if (match) onSupplierChange(match.id, match.name);
        }}
        className="min-w-[200px] flex-1 rounded-xl border border-border bg-background px-3 py-1.5 text-sm text-ink"
      />
      <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3 py-1.5">
        <Search className="h-4 w-4 text-muted" />
        <input
          type="search"
          placeholder="Buscar por fornecedor ou observação"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="w-full bg-transparent text-sm text-ink outline-none"
        />
      </div>
    </div>
  );
}
