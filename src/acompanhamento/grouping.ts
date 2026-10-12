/**
 * Porte das funcoes puras de agrupamento/ordenacao do acompanhamento.js vanilla.
 * As que geravam string HTML viraram JSX nos componentes - aqui só a logica de
 * dados, sem DOM.
 */
import { requesterName, searchableText } from "@/acompanhamento/format";
import type {
  TrackingApiResponse,
  TrackingServiceItem,
  TrackingServiceSort
} from "@/acompanhamento/types";

export interface ServiceGroup<T> {
  primary: T;
  secondaries: T[];
}

export function groupedServices<T extends { id: string; is_secondary: boolean; primary_entry_id: string | null }>(
  services: T[]
): ServiceGroup<T>[] {
  const byId = new Map<string, ServiceGroup<T>>(services.map((item) => [item.id, { primary: item, secondaries: [] }]));
  const groups: ServiceGroup<T>[] = [];
  services.forEach((item) => {
    if (item.is_secondary && item.primary_entry_id && byId.has(item.primary_entry_id)) {
      byId.get(item.primary_entry_id)!.secondaries.push(item);
      return;
    }
    if (!item.is_secondary) groups.push(byId.get(item.id)!);
    else groups.push({ primary: item, secondaries: [] });
  });
  return groups;
}

export function sortBillingGroups<T extends { service_date: string; requested_by?: string | null }>(
  groups: ServiceGroup<T>[]
): ServiceGroup<T>[] {
  return [...groups].sort(
    (a, b) =>
      a.primary.service_date.localeCompare(b.primary.service_date) ||
      requesterName(a.primary).localeCompare(requesterName(b.primary), "pt-BR")
  );
}

export function sortTrackingServices(
  services: TrackingServiceItem[],
  sortBy: TrackingServiceSort
): TrackingServiceItem[] {
  const statusOrder: Record<string, number> = { "A fazer": 0, Pronto: 1, Entregue: 2 };
  return [...services].sort((a, b) => {
    if (sortBy === "requester") {
      return requesterName(a).localeCompare(requesterName(b), "pt-BR") || b.service_date.localeCompare(a.service_date);
    }
    if (sortBy === "status") {
      return (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3) || requesterName(a).localeCompare(requesterName(b), "pt-BR");
    }
    if (sortBy === "service") {
      return String(a.service_name || "").localeCompare(String(b.service_name || ""), "pt-BR") || requesterName(a).localeCompare(requesterName(b), "pt-BR");
    }
    return b.service_date.localeCompare(a.service_date) || requesterName(a).localeCompare(requesterName(b), "pt-BR");
  });
}

export function requesterOptionsFromServices(services: TrackingServiceItem[]): string[] {
  return [...new Set(services.map(requesterName))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function originCancelledNote(
  item: { notes?: string | null; cancellation_reason?: string | null },
  primary?: { status?: string; service_name?: string; cancellation_reason?: string | null } | null
): string {
  const note = String(item.notes || "");
  const reason =
    note.match(/cancelad[ao] por:\s*(.+)$/i)?.[1] ||
    note.match(/origem cancelada motivo:\s*(.+)$/i)?.[1] ||
    item.cancellation_reason ||
    primary?.cancellation_reason ||
    "";
  if (!reason) return "";
  const originName = primary?.status === "Cancelado" ? primary.service_name : note.match(/^(.+?) cancelad[ao] por:/i)?.[1];
  return originName ? `${originName} cancelado por ${reason}` : `Serviço de origem cancelado por ${reason}`;
}

export function complementNamesLabel(secondaries: TrackingServiceItem[]): string {
  return secondaries.map((item) => item.service_name).join(" + ");
}

export function trackingServiceUsageItems(
  data: Pick<TrackingApiResponse, "requestServices" | "services" | "currentServices">
): Array<{ id: string; label: string }> {
  const services = data.requestServices || [];
  const counts: Record<string, number> = {};
  [...(data.services || []), ...(data.currentServices || [])].forEach((entry) => {
    if (entry.service_id) counts[entry.service_id] = (counts[entry.service_id] || 0) + 1;
  });
  return services
    .map((service, index) => ({
      id: service.id,
      label: service.code ? `${service.code} - ${service.name}` : service.name,
      order: index
    }))
    .sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0) || a.order - b.order)
    .map(({ id, label }) => ({ id, label }));
}

export function trackingRequesterUsageItems(
  data: Pick<TrackingApiResponse, "clientRequesters" | "serviceRequests">
): Array<{ id: string; label: string }> {
  const requesters = data.clientRequesters || [];
  const counts: Record<string, number> = {};
  (data.serviceRequests || []).forEach((item) => {
    const name = (item.requested_by || "").trim();
    if (name) counts[name] = (counts[name] || 0) + 1;
  });
  return requesters
    .map((item, index) => ({ id: item.name, label: item.name, order: index }))
    .sort((a, b) => (counts[b.label] || 0) - (counts[a.label] || 0) || a.order - b.order)
    .map(({ id, label }) => ({ id, label }));
}

export function requestServiceOptionLabel(item: { code?: string; name: string } | null | undefined): string {
  return item ? (item.code ? `${item.code} - ${item.name}` : item.name) : "";
}

export function requestServiceMatch<T extends { id: string; code?: string; name: string }>(
  services: T[],
  value: string
): T | null {
  const search = searchableText(value).trim();
  if (!search) return null;
  const exact = services.find(
    (item) =>
      searchableText(requestServiceOptionLabel(item)) === search ||
      searchableText(item.name) === search ||
      searchableText(item.code || "") === search
  );
  if (exact) return exact;
  const partial = services.filter((item) => searchableText(requestServiceOptionLabel(item)).includes(search));
  return partial.length === 1 ? partial[0] : null;
}
