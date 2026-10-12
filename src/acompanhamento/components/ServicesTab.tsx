import { useMemo, useState } from "react";

import { ServiceBarChart, StatusDonut } from "@/acompanhamento/components/charts";
import { RequestHistory } from "@/acompanhamento/components/RequestHistory";
import { RequestWizardDialog } from "@/acompanhamento/components/RequestWizardDialog";
import { ServiceGroupList } from "@/acompanhamento/components/ServiceGroupList";
import { amountText, searchableText, statusData } from "@/acompanhamento/format";
import { groupedServices, requesterOptionsFromServices, sortTrackingServices } from "@/acompanhamento/grouping";
import { getStoredServiceDisplayMode, setStoredServiceDisplayMode } from "@/acompanhamento/storage";
import type { TrackingApiResponse, TrackingServiceItem, TrackingServiceSort } from "@/acompanhamento/types";

interface ServicesTabProps {
  data: TrackingApiResponse;
  onSubmitRequest: (payload: {
    serviceId: string;
    references: string;
    requestedBy: string;
    notes: string;
  }) => Promise<void>;
  onAddRequester: (name: string) => Promise<{ id: string; name: string; normalizedName: string }>;
}

function matchesFilters(
  item: TrackingServiceItem,
  requesterFilter: string,
  startFilter: string,
  endFilter: string
): boolean {
  const requester = (item.requested_by || "").trim() || "Sem solicitante";
  return (
    (!requesterFilter || requester === requesterFilter) &&
    (!startFilter || item.service_date >= startFilter) &&
    (!endFilter || item.service_date <= endFilter)
  );
}

function searchMatches(group: { primary: TrackingServiceItem; secondaries: TrackingServiceItem[] }, search: string): boolean {
  if (!search) return true;
  const { primary, secondaries } = group;
  const status = statusData(primary.status);
  return searchableText(
    primary.service_name,
    primary.reference,
    primary.status,
    primary.requested_by,
    status.label,
    ...secondaries.flatMap((item) => [item.service_name, item.reference, item.status, item.requested_by])
  ).includes(search);
}

export function ServicesTab({ data, onSubmitRequest, onAddRequester }: ServicesTabProps) {
  const [requesterFilter, setRequesterFilter] = useState("");
  const [sortBy, setSortBy] = useState<TrackingServiceSort>("date");
  const [startFilter, setStartFilter] = useState("");
  const [endFilter, setEndFilter] = useState("");
  const [search, setSearch] = useState("");
  const [displayMode, setDisplayMode] = useState<"simple" | "full">(getStoredServiceDisplayMode());
  const [wizardOpen, setWizardOpen] = useState(false);

  const showAmounts = data.showAmounts !== false;
  const normalizedSearch = searchableText(search);

  const { services, cancelledServices, primaryServices, primaryCancelledServices, counts, values, total } = useMemo(() => {
    const allServices = sortTrackingServices(
      (data.services || []).filter((item) => item.status !== "Cancelado"),
      sortBy
    ).filter((item) => matchesFilters(item, requesterFilter, startFilter, endFilter));
    const allCancelled = sortTrackingServices(
      (data.services || []).filter((item) => item.status === "Cancelado"),
      sortBy
    ).filter((item) => matchesFilters(item, requesterFilter, startFilter, endFilter));
    const primary = allServices.filter((item) => !item.is_secondary);
    const primaryCancelled = allCancelled.filter((item) => !item.is_secondary);
    const countsResult = {
      pending: primary.filter((item) => item.status === "A fazer").length,
      done: primary.filter((item) => item.status === "Pronto").length,
      delivered: primary.filter((item) => item.status === "Entregue").length
    };
    const valuesResult = {
      pending: allServices.filter((item) => item.status === "A fazer").reduce((sum, item) => sum + Number(item.amount), 0),
      done: allServices.filter((item) => item.status === "Pronto").reduce((sum, item) => sum + Number(item.amount), 0),
      delivered: allServices.filter((item) => item.status === "Entregue").reduce((sum, item) => sum + Number(item.amount), 0)
    };
    const totalResult = allServices.reduce((sum, item) => sum + Number(item.amount), 0);
    return {
      services: allServices,
      cancelledServices: allCancelled,
      primaryServices: primary,
      primaryCancelledServices: primaryCancelled,
      counts: countsResult,
      values: valuesResult,
      total: totalResult
    };
  }, [data.services, sortBy, requesterFilter, startFilter, endFilter]);

  const serviceGroups = useMemo(
    () => groupedServices(services).filter((group) => searchMatches(group, normalizedSearch)),
    [services, normalizedSearch]
  );
  const cancelledGroups = useMemo(
    () => groupedServices(cancelledServices).filter((group) => searchMatches(group, normalizedSearch)),
    [cancelledServices, normalizedSearch]
  );

  const requesterOptions = useMemo(() => requesterOptionsFromServices(data.services || []), [data.services]);

  function toggleDisplayMode() {
    const next = displayMode === "simple" ? "full" : "simple";
    setDisplayMode(next);
    setStoredServiceDisplayMode(next);
  }

  return (
    <div className="grid gap-5">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={toggleDisplayMode}
          aria-pressed={displayMode === "simple"}
          className={
            displayMode === "simple"
              ? "rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white"
              : "rounded-xl border border-line bg-surface px-4 py-2 text-xs font-semibold text-ink hover:bg-brand-soft"
          }
        >
          {displayMode === "simple" ? "Exibir completo" : "Exibir simples"}
        </button>
      </div>

      {data.allowRequests && (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-ink">Pedidos</h3>
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white"
            >
              Novo pedido
            </button>
          </div>
          <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Pedidos enviados</h4>
          <div className="mt-2">
            <RequestHistory requests={data.serviceRequests || []} />
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <article className="rounded-xl border border-line bg-[#fff7eb] p-4">
          <span className="block text-xs text-muted">A fazer</span>
          <strong className="mt-1 block text-xl text-ink">{counts.pending}</strong>
          <small className="text-xs text-muted">{amountText(values.pending, showAmounts)}</small>
        </article>
        <article className="rounded-xl border border-line bg-[#eef6ff] p-4">
          <span className="block text-xs text-muted">Feitos</span>
          <strong className="mt-1 block text-xl text-ink">{counts.done}</strong>
          <small className="text-xs text-muted">{amountText(values.done, showAmounts)}</small>
        </article>
        <article className="rounded-xl border border-line bg-[#edf9f2] p-4">
          <span className="block text-xs text-muted">Entregues</span>
          <strong className="mt-1 block text-xl text-ink">{counts.delivered}</strong>
          <small className="text-xs text-muted">{amountText(values.delivered, showAmounts)}</small>
        </article>
        <article className="rounded-xl border border-line bg-brand-soft p-4">
          <span className="block text-xs text-muted">Total do período</span>
          <strong className="mt-1 block text-xl text-ink">{showAmounts ? amountText(total, showAmounts) : primaryServices.length}</strong>
          <small className="text-xs text-muted">{primaryServices.length} serviço(s)</small>
        </article>
        <article className="rounded-xl border border-line bg-[#fdecea] p-4">
          <span className="block text-xs text-muted">Cancelados</span>
          <strong className="mt-1 block text-xl text-ink">{primaryCancelledServices.length}</strong>
          <small className="text-xs text-muted">serviço(s) cancelado(s)</small>
        </article>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-line bg-surface p-5">
          <h3 className="mb-3 text-sm font-semibold text-ink">Resumo por status</h3>
          <StatusDonut total={primaryServices.length} counts={counts} />
        </article>
        <article className="rounded-2xl border border-line bg-surface p-5">
          <h3 className="mb-3 text-sm font-semibold text-ink">Serviços mais pedidos</h3>
          <ServiceBarChart services={primaryServices} />
        </article>
      </div>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-ink">Serviços do período</h3>
          <span className="text-xs text-muted">
            {normalizedSearch
              ? `${serviceGroups.length} de ${primaryServices.length} serviço(s)`
              : `${primaryServices.length} serviço(s)`}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            type="search"
            placeholder="Buscar placa, serviço, status ou solicitante"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="min-w-[220px] flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
          />
          <input
            type="date"
            aria-label="Data inicial"
            value={startFilter}
            onChange={(event) => setStartFilter(event.target.value)}
            className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
          />
          <input
            type="date"
            aria-label="Data final"
            value={endFilter}
            onChange={(event) => setEndFilter(event.target.value)}
            className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
          />
          <select
            aria-label="Filtrar por solicitante"
            value={requesterFilter}
            onChange={(event) => setRequesterFilter(event.target.value)}
            className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
          >
            <option value="">Todos os solicitantes</option>
            {requesterOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            aria-label="Ordenar servicos"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as TrackingServiceSort)}
            className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
          >
            <option value="date">Data</option>
            <option value="requester">Solicitante</option>
            <option value="status">Status</option>
            <option value="service">Servico</option>
          </select>
        </div>
        <div className="mt-4">
          <ServiceGroupList
            groups={serviceGroups}
            mode={displayMode}
            emptyMessage="Nenhum serviço encontrado neste período."
            showAmounts={showAmounts}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-ink">Serviços cancelados</h3>
          <span className="text-xs text-muted">{primaryCancelledServices.length} serviço(s)</span>
        </div>
        <div className="mt-4">
          <ServiceGroupList
            groups={cancelledGroups}
            mode={displayMode}
            emptyMessage="Nenhum serviço cancelado neste período."
            showAmounts={showAmounts}
          />
        </div>
      </section>

      {data.allowRequests && (
        <RequestWizardDialog
          open={wizardOpen}
          data={data}
          onClose={() => setWizardOpen(false)}
          onSubmit={onSubmitRequest}
          onAddRequester={onAddRequester}
        />
      )}
    </div>
  );
}
