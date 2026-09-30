import { useState } from "react";
import { PlusCircle, Search } from "lucide-react";

import { useSupplierRecordsData } from "@/supplierRecords/useSupplierRecordsData";
import type { SupplierRecordsFiltersState } from "@/supplierRecords/data";
import { SupplierCard } from "@/supplierRecords/components/SupplierCard";

function defaultFilters(): SupplierRecordsFiltersState {
  return { search: "" };
}

// Fase 9 da migracao React: "Fornecedores > Cadastros" (vanilla
// renderRecords(), supplier.js:282-299). Mesmo perfil visual dos cards ja
// portados. Sem banner proprio de topo (diferente de Services/Requests) -
// a secao #suppliers ja tem um .section-heading fixo fora dos paineis,
// visivel em todas as 6 abas; aqui so replica o subsection-heading que o
// vanilla ja usava especificamente pra esta aba. Primeira de varias fases
// dentro de Fornecedores - as outras 5 abas (Lançamentos, Acessos, Contas
// a pagar, Pagamento, Painel) ficam pra fases seguintes, cada uma com seu
// proprio modulo/flag, mesmo padrao do resto do projeto.
export function SupplierRecords() {
  const [filters, setFilters] = useState<SupplierRecordsFiltersState>(defaultFilters);
  const suppliers = useSupplierRecordsData(filters);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-wide text-muted">Cadastro</span>
          <h3 className="text-lg font-bold text-brand-ink">Fornecedores</h3>
        </div>
        <button
          type="button"
          data-supplier-action="supplier"
          className="flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <PlusCircle className="h-4 w-4" />
          Adicionar
        </button>
      </div>

      <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface p-3">
        <Search className="h-4 w-4 text-muted" />
        <input
          type="search"
          placeholder="Buscar fornecedor"
          value={filters.search}
          onChange={(event) => setFilters({ search: event.target.value })}
          className="w-full bg-transparent text-sm text-ink outline-none"
        />
      </div>

      {suppliers.length ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {suppliers.map((supplier) => (
            <SupplierCard key={supplier.id} supplier={supplier} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">Nenhum registro por aqui.</p>
      )}
    </div>
  );
}
