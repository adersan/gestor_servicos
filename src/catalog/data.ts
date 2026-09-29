import { subscribeToAppRender } from "@/dashboard/data";
import type { CatalogItem } from "@/types/global";

export { subscribeToAppRender };

export interface PriceTableRow {
  name: string;
  clientCount: number;
}

// Espelha renderCatalog() (app.js) - mesmo filtro (matchesSearch sobre
// codigo/nome) e mesma ordenacao (localeCompare pt-BR), sem duplicar
// nenhuma regra - so chama window.matchesSearch ja existente.
export function loadCatalogItems(search: string): CatalogItem[] {
  const state = window.getAppState();
  return state.catalog
    .filter((item) => window.matchesSearch(search, item.code, item.name))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

// Espelha renderPriceTables() (app.js) - mesmo filtro e mesma contagem de
// clientes vinculados por tabela.
export function loadPriceTables(search: string): PriceTableRow[] {
  const state = window.getAppState();
  return state.priceTables
    .filter((name) => window.matchesSearch(search, name))
    .map((name) => ({
      name,
      clientCount: state.clients.filter((client) => client.priceGroup === name).length
    }));
}

export function loadPriceTableNames(): string[] {
  return window.getAppState().priceTables;
}
