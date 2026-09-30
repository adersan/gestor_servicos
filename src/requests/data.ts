import { subscribeToAppRender } from "@/dashboard/data";
import type { ServiceRequest } from "@/types/global";

export { subscribeToAppRender };

export interface RequestFiltersState {
  status: string;
  search: string;
}

export interface RequestSummary {
  pendingCount: number;
  totalReferences: number;
  pendingAmount: number;
  importedCount: number;
  totalCount: number;
}

export interface RequestsResult {
  requests: ServiceRequest[];
  summary: RequestSummary;
}

const STATUS_ORDER: Record<string, number> = { Novo: 0, Importado: 1, Cancelado: 2 };

// Espelha renderServiceRequests() (app.js) - mesmo filtro/ordenacao, sem
// duplicar regra de negocio (matchesSearch/clientById continuam vindo de
// window.*). Ver Fase 8.
export function loadRequests(filters: RequestFiltersState): RequestsResult {
  const state = window.getAppState();
  const requests = state.serviceRequests || [];
  const { status, search } = filters;

  const filtered = requests
    .filter((item) => !status || item.status === status)
    .filter((item) =>
      window.matchesSearch(
        search,
        window.clientById(item.clientId)?.name,
        item.serviceName,
        item.requestedBy,
        item.notes,
        ...(item.references || [])
      )
    )
    .sort((a, b) => {
      const statusDifference = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
      return statusDifference || String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    });

  const pending = requests.filter((item) => item.status === "Novo");
  const imported = requests.filter((item) => item.status === "Importado");
  const totalReferences = pending.reduce((sum, item) => sum + (item.references?.length || 0), 0);
  const pendingAmount = pending.reduce(
    (sum, item) => sum + Number(item.amount || 0) * Math.max(1, item.references?.length || 1),
    0
  );

  return {
    requests: filtered,
    summary: {
      pendingCount: pending.length,
      totalReferences,
      pendingAmount,
      importedCount: imported.length,
      totalCount: requests.length
    }
  };
}

export function requestStatusKey(status: string): "a-fazer" | "entregue" | "cancelado" {
  if (status === "Importado") return "entregue";
  if (status === "Cancelado") return "cancelado";
  return "a-fazer";
}
