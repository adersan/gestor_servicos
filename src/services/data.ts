import { subscribeToAppRender } from "@/dashboard/data";
import type { ServiceEntry, ServiceGroup } from "@/types/global";

export { subscribeToAppRender };

// Mesmo formato do app.js (const dateFormat = new Intl.DateTimeFormat(...)).
export const dateFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });
export const shortDateFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "2-digit" });

export interface ServiceFiltersState {
  clientId: string;
  clientName: string;
  status: string;
  startDate: string;
  endDate: string;
  search: string;
}

export interface ServiceGroupsResult {
  groups: ServiceGroup[];
  matchingPrimaryCount: number;
  searchAcrossHistory: boolean;
  periodLabel: string;
}

const STATUS_ORDER: Record<string, number> = { "A fazer": 0, Pronto: 1, Entregue: 2, Cancelado: 3 };

function groupKey(item: ServiceEntry): string {
  return item.serviceGroupId ? `${item.serviceGroupId}:${item.reference || ""}` : item.id;
}

// Espelha renderServices() (app.js:1811-1873) - mesmo filtro, agrupamento e
// ordenacao, sem duplicar regra de status/atraso (isOverdueService,
// formatServiceAge continuam vindo de window.*). Ver plano, Fase 7.
export function loadServiceGroups(filters: ServiceFiltersState): ServiceGroupsResult {
  const state = window.getAppState();
  const { clientId, clientName, status, startDate, endDate, search } = filters;

  const searchAcrossHistory = Boolean(search) && state.services.some((item) => window.matchesSearch(search, item.reference));

  const periodLabel = searchAcrossHistory
    ? "Busca por referência em todo o histórico"
    : startDate && endDate
    ? `${window.formatDate(startDate)} a ${window.formatDate(endDate)}`
    : "Todos os períodos";

  const generallyEligible = state.services
    .filter((item) => !clientId || item.clientId === clientId)
    .filter((item) => !clientName || window.matchesSearch(clientName, window.clientById(item.clientId)?.name))
    .filter((item) => searchAcrossHistory || !startDate || item.date >= startDate)
    .filter((item) => searchAcrossHistory || !endDate || item.date <= endDate);

  const matchingItems = generallyEligible
    .filter((item) => !status || item.status === status)
    .filter((item) => window.matchesSearch(
      search,
      item.description,
      item.reference,
      item.requestedBy,
      window.clientById(item.clientId)?.name,
      window.serviceStatusLabel(item.status)
    ));

  const matchingGroupKeys = new Set(matchingItems.map(groupKey));
  const matchingPrimaryCount = matchingItems.filter((item) => !item.isSecondary).length;

  const groupedMap = new Map<string, ServiceEntry[]>();
  generallyEligible.forEach((item) => {
    const key = groupKey(item);
    if (!matchingGroupKeys.has(key)) return;
    const list = groupedMap.get(key) || [];
    list.push(item);
    groupedMap.set(key, list);
  });

  const groups: ServiceGroup[] = Array.from(groupedMap.values())
    .map((group): ServiceGroup => {
      const primary = group.find((item) => !item.isSecondary) || group[0];
      const complementary = group.filter((item) => item.id !== primary.id);
      const ordered = primary.status === "Cancelado" && complementary.some((item) => item.status !== "Cancelado")
        ? [...complementary, primary]
        : [primary, ...complementary];
      return { primary, complementary, ordered };
    })
    .sort((a, b) => {
      const statusDifference = (STATUS_ORDER[a.primary.status] ?? 4) - (STATUS_ORDER[b.primary.status] ?? 4);
      return statusDifference || b.primary.date.localeCompare(a.primary.date)
        || String(b.primary.createdAt || "").localeCompare(String(a.primary.createdAt || ""));
    });

  return { groups, matchingPrimaryCount, searchAcrossHistory, periodLabel };
}
