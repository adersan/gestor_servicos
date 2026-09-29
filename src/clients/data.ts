import { subscribeToAppRender } from "@/dashboard/data";
import type { Client } from "@/types/global";

export { subscribeToAppRender };

export interface ClientRow {
  client: Client;
  balance: number;
  overdue: boolean;
}

// Espelha renderClients() (app.js) - mesmo filtro (matchesSearch sobre
// nome/telefone/tabela/documento/email/cidade) e mesmo calculo de saldo
// (balanceFor) e atraso (isBillingOverdue) por cliente, sem duplicar nenhuma
// regra - so chama as funcoes ja existentes via window.*.
export function loadClientList(search: string): ClientRow[] {
  const state = window.getAppState();
  return state.clients
    .filter((client) =>
      window.matchesSearch(search, client.name, client.phone, client.priceGroup, client.document, client.email, client.city)
    )
    .map((client): ClientRow => ({
      client,
      balance: window.balanceFor(client.id),
      overdue: state.billings.some((billing) => billing.clientId === client.id && window.isBillingOverdue(billing))
    }));
}
