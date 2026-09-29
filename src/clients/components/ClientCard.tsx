import { money } from "@/lib/format";
import type { ClientRow } from "@/clients/data";

// Card completo, com os 3 botoes de acao reais - cada um so renderiza o
// mesmo atributo data-* que o listener generico ja existente (app.js) escuta,
// mesmo padrao de BillingCard.tsx (ver plano, Fase 5).
export function ClientCard({ row }: { row: ClientRow }) {
  const { client, balance, overdue } = row;
  const cityState = [client.city, client.state].filter(Boolean).join(" - ");

  return (
    <article className={`client-card rounded-2xl border bg-surface p-4 ${overdue ? "border-[var(--danger-40)]" : "border-border"}`}>
      <h3 className="text-lg font-bold text-ink">{client.name}</h3>
      {client.phone && <p className="text-sm text-muted">{client.phone}</p>}
      {client.document && <p className="text-sm text-muted">{client.document}</p>}
      {client.email && <p className="text-sm text-muted">{client.email}</p>}
      {cityState && <p className="text-sm text-muted">{cityState}</p>}

      <div className="mt-2 flex flex-wrap gap-2">
        <span className="inline-flex items-center rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink">
          {client.priceGroup}
        </span>
        {client.billingFrequency && (
          <span className="inline-flex items-center rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink">
            {window.billingFrequencyLabel(client.billingFrequency)}
          </span>
        )}
      </div>

      <div className="mt-3 rounded-lg bg-surface-2 p-3 text-sm">
        Saldo atual:{" "}
        <strong className={balance > 0 ? "text-danger" : "text-ink"}>{money.format(balance)}</strong>
      </div>

      <div className="card-actions mt-3 flex flex-wrap gap-2">
        <button type="button" data-edit-client={client.id} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink">
          Editar
        </button>
        <button
          type="button"
          data-manage-client-requesters={client.id}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink"
        >
          Gerenciar solicitantes
        </button>
        <button
          type="button"
          data-delete-client={client.id}
          className="rounded-lg border border-[var(--danger-40)] px-3 py-1.5 text-xs font-semibold text-danger"
        >
          Excluir
        </button>
      </div>
    </article>
  );
}
