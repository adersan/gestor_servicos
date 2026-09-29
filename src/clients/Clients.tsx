import { useState } from "react";
import { Users, UserPlus } from "lucide-react";

import { useClientsData } from "@/clients/useClientsData";
import { ClientsFilters } from "@/clients/components/ClientsFilters";
import { ClientCard } from "@/clients/components/ClientCard";

// Fase 5: reconstrucao de "Clientes > Cadastro" (vanilla renderClients(),
// app.js) em React+Tailwind, card completo com os botoes de acao reais. Ver
// plano em .claude/plans/breezy-coalescing-sonnet.md, Fase 5.
export function Clients() {
  const [search, setSearch] = useState("");
  const { rows } = useClientsData(search);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-gradient-to-br from-[var(--primary-10)] via-surface to-surface p-5">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Users className="h-6 w-6" />
          </span>
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-muted">Cadastro</span>
            <h2 className="text-xl font-bold text-brand-ink">Clientes</h2>
          </div>
        </div>
        <button
          type="button"
          data-dialog="clientDialog"
          className="flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <UserPlus className="h-4 w-4" />
          Adicionar cliente
        </button>
      </div>

      <ClientsFilters search={search} onSearchChange={setSearch} />

      {rows.length ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <ClientCard key={row.client.id} row={row} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
          Nenhum registro por aqui.
        </p>
      )}
    </div>
  );
}
