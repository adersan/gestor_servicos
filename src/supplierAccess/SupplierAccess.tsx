import { useState } from "react";
import { Link2, PlusCircle, RefreshCcw } from "lucide-react";

import { useSupplierOnlineData } from "@/supplierAccess/useSupplierOnlineData";
import { useSupplierLinks } from "@/supplierAccess/useSupplierLinks";
import type { SupplierOnlineFiltersState } from "@/supplierAccess/data";
import { SupplierOnlineEntryCard } from "@/supplierAccess/components/SupplierOnlineEntryCard";
import { SupplierLinkCard } from "@/supplierAccess/components/SupplierLinkCard";

type AccessTab = "online" | "links";

function defaultFilters(): SupplierOnlineFiltersState {
  return { supplierId: "", clientId: "", startDate: "", endDate: "" };
}

// Fase 11 da migracao React: "Fornecedores > Acessos" (vanilla
// renderSupplierOnlineEntries()/renderSupplierLinksPanel(), supplier.js).
// Mesmo padrao de 2 abas da Fase 8 (Pedido on-line): aba "Serviço online"
// sincrona (window.getAppState()), aba "Links gerados" assincrona (fetch
// autenticado em admin-supplier-links, useSupplierLinks.ts espelha
// useTrackingLinks.ts quase 1:1). Simplificacao deliberada: o filtro
// dedicado por cliente nao foi portado pra UI (o estado existe no hook,
// so nao tem select ainda) - lista ja filtra por fornecedor e periodo, que
// cobre o uso mais comum.
export function SupplierAccess() {
  const [tab, setTab] = useState<AccessTab>("online");
  const [filters, setFilters] = useState<SupplierOnlineFiltersState>(defaultFilters);

  const entries = useSupplierOnlineData(filters);
  const links = useSupplierLinks(tab === "links");
  const suppliers = window.getAppState().suppliers;

  const updateFilters = (next: Partial<SupplierOnlineFiltersState>) => setFilters((current) => ({ ...current, ...next }));

  return (
    <div className="flex flex-col gap-4">
      <div className="inline-flex w-fit gap-1 rounded-2xl border border-border bg-surface p-1" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "online"}
          onClick={() => setTab("online")}
          className={`rounded-xl px-3.5 py-1.5 text-sm font-semibold transition-colors ${
            tab === "online" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted hover:bg-surface-2 hover:text-ink"
          }`}
        >
          Serviço online
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "links"}
          onClick={() => setTab("links")}
          className={`rounded-xl px-3.5 py-1.5 text-sm font-semibold transition-colors ${
            tab === "links" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted hover:bg-surface-2 hover:text-ink"
          }`}
        >
          Links gerados
        </button>
      </div>

      {tab === "online" ? (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-3">
            <select
              value={filters.supplierId}
              onChange={(event) => updateFilters({ supplierId: event.target.value })}
              className="rounded-xl border border-border bg-background px-3 py-1.5 text-sm text-ink"
            >
              <option value="">Todos os fornecedores</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              aria-label="Data inicial"
              value={filters.startDate}
              onChange={(event) => updateFilters({ startDate: event.target.value })}
              className="rounded-xl border border-border bg-background px-3 py-1.5 text-sm text-ink"
            />
            <input
              type="date"
              aria-label="Data final"
              value={filters.endDate}
              onChange={(event) => updateFilters({ endDate: event.target.value })}
              className="rounded-xl border border-border bg-background px-3 py-1.5 text-sm text-ink"
            />
          </div>

          {entries.length ? (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {entries.map((entry) => (
                <SupplierOnlineEntryCard key={entry.id} entry={entry} />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">Nenhum registro por aqui.</p>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-3">
            <p className="text-sm text-muted">
              Um link por fornecedor. Gerar um novo substitui o anterior (link, identificador e senha). Sem senha: só os serviços, sem valores. Com senha:
              acesso completo, incluindo contas a pagar e pagamentos.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => links.refresh()}
                disabled={links.loading}
                className="flex h-9 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-sm font-semibold text-ink transition-colors hover:bg-surface-2 disabled:opacity-60"
              >
                <RefreshCcw className={`h-4 w-4 ${links.loading ? "animate-spin" : ""}`} />
                Atualizar
              </button>
              <button
                type="button"
                data-supplier-action="access"
                className="flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                <PlusCircle className="h-4 w-4" />
                Gerar novo link
              </button>
            </div>
          </div>

          {links.error ? (
            <p className="rounded-2xl border border-[var(--danger-40)] bg-[var(--danger-10)] p-4 text-sm text-danger">{links.error}</p>
          ) : links.links === null ? (
            <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">Carregando...</p>
          ) : links.links.length ? (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {links.links.map((link) => (
                <SupplierLinkCard key={link.id} link={link} onDelete={links.removeLink} />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
              <span className="mb-1 block">
                <Link2 className="mx-auto h-5 w-5 text-muted" />
              </span>
              Nenhum registro por aqui.
            </p>
          )}
        </>
      )}
    </div>
  );
}
