import { useState } from "react";
import { ClipboardList, Inbox, Link2, PlusCircle, TrendingUp, RefreshCcw } from "lucide-react";

import { StatCard } from "@/components/ui/stat-card";
import { money } from "@/lib/format";
import { useRequestsData } from "@/requests/useRequestsData";
import { useTrackingLinks } from "@/requests/useTrackingLinks";
import type { RequestFiltersState } from "@/requests/data";
import { RequestFilters } from "@/requests/components/RequestFilters";
import { RequestCard } from "@/requests/components/RequestCard";
import { TrackingLinkCard } from "@/requests/components/TrackingLinkCard";

type RequestsTab = "requests" | "links";

function defaultFilters(): RequestFiltersState {
  return { status: "Novo", search: "" };
}

// Fase 8: reconstrucao de "Clientes > Pedido on-line" (vanilla
// renderServiceRequests()/renderTrackingLinksPanel(), app.js) em
// React+Tailwind, mesmo perfil visual do card de Lancamento (Fase 7):
// blocos pastel sem linhas divisorias, cores por status. Duas abas
// (Pedidos/Links gerados) como duas fontes de dados bem diferentes - a
// primeira sincrona via window.getAppState(), a segunda assincrona via
// fetch autenticado (useTrackingLinks). O dialog de gerar link
// (trackingDialog) continua 100% vanilla, disparado pelo mesmo
// data-dialog="trackingDialog" que o resto do sistema ja usa.
export function Requests() {
  const [tab, setTab] = useState<RequestsTab>("requests");
  const [filters, setFilters] = useState<RequestFiltersState>(defaultFilters);

  const { requests, summary } = useRequestsData(filters);
  const trackingLinks = useTrackingLinks(tab === "links");

  const updateFilters = (next: Partial<RequestFiltersState>) => setFilters((current) => ({ ...current, ...next }));

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-gradient-to-br from-[var(--primary-10)] via-surface to-surface p-5">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Inbox className="h-6 w-6" />
          </span>
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-muted">Entrada do cliente</span>
            <h2 className="text-xl font-bold text-brand-ink">Pedidos recebidos</h2>
          </div>
        </div>
        <button
          type="button"
          data-open-view="services"
          className="flex h-9 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-sm font-semibold text-ink transition-colors hover:bg-surface-2"
        >
          <ClipboardList className="h-4 w-4" />
          Ir para lançamentos
        </button>
      </div>

      <div className="inline-flex w-fit gap-1 rounded-2xl border border-border bg-surface p-1" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "requests"}
          onClick={() => setTab("requests")}
          className={`rounded-xl px-3.5 py-1.5 text-sm font-semibold transition-colors ${
            tab === "requests" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted hover:bg-surface-2 hover:text-ink"
          }`}
        >
          Pedidos
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

      {tab === "requests" ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Pedidos novos"
              primary={summary.pendingCount}
              secondary={`${summary.totalReferences} referência(s)`}
              icon={Inbox}
              iconClass="bg-amber-500/15 text-amber-600"
              onClick={() => updateFilters({ status: "Novo" })}
            />
            <StatCard
              label="Valor estimado"
              primary={money.format(summary.pendingAmount)}
              secondary="Pedidos ainda não importados"
              icon={TrendingUp}
              iconClass="bg-sky-500/15 text-sky-600"
              onClick={() => updateFilters({ status: "Novo" })}
            />
            <StatCard
              label="Importados"
              primary={summary.importedCount}
              secondary="Já viraram lançamento"
              icon={ClipboardList}
              iconClass="bg-emerald-500/15 text-emerald-600"
              onClick={() => updateFilters({ status: "Importado" })}
            />
            <StatCard
              label="Total recebido"
              primary={summary.totalCount}
              secondary="Histórico de pedidos"
              icon={Inbox}
              iconClass="bg-[var(--primary-15)] text-primary"
              highlight
              onClick={() => updateFilters({ status: "" })}
            />
          </div>

          <RequestFilters filters={filters} onChange={updateFilters} />

          {requests.length ? (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {requests.map((request) => (
                <RequestCard key={request.id} request={request} />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">Nenhum registro por aqui.</p>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-3">
            <p className="text-sm text-muted">Um link por cliente. Gerar um novo substitui o anterior (link, identificador e senha).</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => trackingLinks.refresh()}
                disabled={trackingLinks.loading}
                className="flex h-9 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-sm font-semibold text-ink transition-colors hover:bg-surface-2 disabled:opacity-60"
              >
                <RefreshCcw className={`h-4 w-4 ${trackingLinks.loading ? "animate-spin" : ""}`} />
                Atualizar
              </button>
              <button
                type="button"
                data-dialog="trackingDialog"
                className="flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                <PlusCircle className="h-4 w-4" />
                Gerar novo link
              </button>
            </div>
          </div>

          {trackingLinks.error ? (
            <p className="rounded-2xl border border-[var(--danger-40)] bg-[var(--danger-10)] p-4 text-sm text-danger">{trackingLinks.error}</p>
          ) : trackingLinks.links === null ? (
            <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">Carregando...</p>
          ) : trackingLinks.links.length ? (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {trackingLinks.links.map((link) => (
                <TrackingLinkCard key={link.id} link={link} onDelete={trackingLinks.removeLink} />
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
