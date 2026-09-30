import { money } from "@/lib/format";
import { requestStatusKey } from "@/requests/data";
import type { ServiceRequest } from "@/types/global";

const STATUS_PILL_STYLES: Record<string, string> = {
  "a-fazer": "bg-[#fdeceb] text-danger",
  entregue: "bg-[#edf9f2] text-[#117440]",
  cancelado: "bg-[var(--danger-15)] text-danger italic"
};

const REFERENCE_STYLES: Record<string, string> = {
  "a-fazer": "border-[#f2c1b8] bg-[#fdeceb] text-danger",
  entregue: "border-[#a9ddbd] bg-[#edf9f2] text-[#117440]",
  cancelado: "border-[#f2c1b8] bg-[#fdeceb] text-danger italic"
};

const CARD_BORDER_STYLES: Record<string, string> = {
  "a-fazer": "border-l-danger",
  entregue: "border-l-[#18864b]",
  cancelado: "border-l-danger"
};

const ACTION_BUTTON = "rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-2";
const POSITIVE_BUTTON = "rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600 transition-colors hover:bg-emerald-500/20";
const DANGER_BUTTON = "rounded-lg border border-[var(--danger-40)] bg-surface px-3 py-1.5 text-xs font-semibold text-danger transition-colors hover:bg-[var(--danger-10)]";

// Card do pedido on-line, mesmo perfil visual do card de Lancamento
// (ServiceCard.tsx): cabecalho branco + bloco de detalhes pastel + bloco de
// acoes pastel, sem divisorias tracejadas, cores por status. Botoes de
// mutacao sem onClick - so os data-* que o listener generico ja existente
// (app.js) escuta (data-import-client-request/data-cancel-client-request/
// data-delete-client-request). Ver Fase 8.
export function RequestCard({ request }: { request: ServiceRequest }) {
  const client = window.clientById(request.clientId);
  const statusKey = requestStatusKey(request.status);
  const references = request.references || [];
  const isPending = request.status === "Novo";
  const statusPillClass = STATUS_PILL_STYLES[statusKey];
  const referenceClass = REFERENCE_STYLES[statusKey];

  return (
    <article className={`rounded-2xl border border-border border-l-4 bg-surface p-4 transition-shadow hover:shadow-md ${CARD_BORDER_STYLES[statusKey]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className="block text-xs font-semibold uppercase tracking-wide text-muted">
            {request.requestedDate ? window.formatDate(request.requestedDate) : ""}
          </span>
          <h3 className="truncate text-base font-extrabold text-ink">{client?.name || "Cliente"}</h3>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusPillClass}`}>{request.status}</span>
      </div>

      <strong className="mt-2.5 block text-lg font-extrabold text-ink">{request.serviceName || "Serviço"}</strong>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {references.length ? (
          references.map((reference) => (
            <span key={reference} className={`rounded-lg border px-2.5 py-1 text-sm font-extrabold tracking-wide ${referenceClass}`}>
              {reference}
            </span>
          ))
        ) : (
          <span className={`rounded-lg border px-2.5 py-1 text-sm font-extrabold tracking-wide ${referenceClass}`}>Sem referência</span>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-2 rounded-xl bg-surface-2 p-3">
        <span className="text-xs font-semibold text-muted">Solicitante: {request.requestedBy || "Não informado"}</span>
        {request.notes && <p className="text-xs text-muted">{request.notes}</p>}
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-muted">Valor unitário</span>
          <strong className="text-lg font-extrabold text-brand-ink">{money.format(Number(request.amount || 0))}</strong>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 rounded-xl bg-[var(--primary-15)] p-3">
        {isPending ? (
          <>
            <button type="button" data-import-client-request={request.id} className={POSITIVE_BUTTON}>
              Importar para lançamento
            </button>
            <button type="button" data-cancel-client-request={request.id} className={DANGER_BUTTON}>
              Cancelar pedido
            </button>
          </>
        ) : (
          <button type="button" data-delete-client-request={request.id} className={ACTION_BUTTON}>
            Excluir do histórico
          </button>
        )}
      </div>
    </article>
  );
}
