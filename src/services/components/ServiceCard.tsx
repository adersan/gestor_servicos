import { dateFormat } from "@/services/data";
import { money } from "@/lib/format";
import type { ServiceEntry } from "@/types/global";

const STATUS_STYLES: Record<string, string> = {
  "A fazer": "bg-[var(--danger-15)] text-danger",
  Pronto: "bg-[var(--primary-15)] text-primary",
  Entregue: "bg-emerald-500/15 text-emerald-600",
  Cancelado: "bg-surface-2 text-muted"
};

const ACTION_BUTTON = "rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-2";
const POSITIVE_BUTTON = "rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600 transition-colors hover:bg-emerald-500/20";
const DANGER_BUTTON = "rounded-lg border border-[var(--danger-40)] px-3 py-1.5 text-xs font-semibold text-danger transition-colors hover:bg-[var(--danger-10)]";

// Replica serviceItemMarkup() (app.js:1770-1798) em card Tailwind - todas as
// acoes reais sempre visiveis (sem accordion "Mais opções" do vanilla mobile,
// ver plano Fase 7). Botoes sem handler React, so os data-* que o listener
// generico ja existente (app.js) escuta.
export function ServiceCard({ item, linked = false }: { item: ServiceEntry; linked?: boolean }) {
  const overdue = window.isOverdueService(item);
  const originNote = window.originCancelledNote(item);
  const statusDates = window.serviceStatusDates(item);
  const statusClass = STATUS_STYLES[item.status] || STATUS_STYLES.Cancelado;
  const metaLine = [item.reference || "Sem referência", window.clientById(item.clientId)?.name, item.requestedBy ? `Solicitante: ${item.requestedBy}` : null]
    .filter(Boolean)
    .join(" · ");

  const showStatusActions = item.status !== "Cancelado";

  return (
    <article
      className={`timeline-item flex flex-col gap-3 rounded-2xl border bg-surface p-4 ${
        overdue ? "border-[var(--danger-40)]" : "border-border"
      } ${linked ? "ml-3 border-l-4 border-l-[var(--primary-40)]" : ""} ${item.isSecondary ? "bg-surface-2/40" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <time className="block text-xs font-semibold uppercase tracking-wide text-muted">
            {dateFormat.format(new Date(`${item.date}T00:00:00Z`))}
          </time>
          <h3 className="mt-0.5 truncate text-base font-bold text-ink">{item.description}</h3>
          <p className="truncate text-sm text-muted">{metaLine}</p>
        </div>
        <strong className="whitespace-nowrap text-lg font-bold text-ink">{money.format(item.amount)}</strong>
      </div>

      {originNote && <span className="text-xs font-semibold text-danger">{originNote}</span>}

      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass}`}>
          {window.serviceStatusLabel(item.status)}
        </span>
        {item.isSecondary && (
          <span className="inline-flex items-center rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink">
            Serviço complementar
          </span>
        )}
        {overdue && (
          <span className="inline-flex items-center rounded-full bg-[var(--danger-15)] px-2.5 py-1 text-xs font-semibold text-danger">
            {window.formatServiceAge(item)}
          </span>
        )}
        {item.confirmationRequestedAt && item.status === "Pronto" && (
          <span className="inline-flex items-center rounded-full bg-[var(--primary-15)] px-2.5 py-1 text-xs font-semibold text-primary">
            Confirmação solicitada
          </span>
        )}
        {item.deliveredAt && (
          <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-600">
            {window.deliveredLabel(item)}
          </span>
        )}
      </div>

      {statusDates && <p className="text-xs text-muted">{statusDates}</p>}

      {item.status === "Cancelado" && (
        <p className="text-xs text-muted">
          <strong>Motivo:</strong> {item.cancellationReason || "Não informado"}
          {item.cancellationOriginalAmount !== null && item.cancellationOriginalAmount !== undefined
            ? ` · Valor anterior: ${money.format(item.cancellationOriginalAmount)}`
            : ""}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <div className="flex flex-wrap gap-2">
          {item.status === "A fazer" && (
            <button type="button" data-service-status="Pronto" data-entry-id={item.id} className={POSITIVE_BUTTON}>
              Marcar feito
            </button>
          )}
          {item.status === "Pronto" && (
            <>
              <button type="button" data-service-status="Entregue" data-entry-id={item.id} className={POSITIVE_BUTTON}>
                Marcar entregue
              </button>
              <button type="button" data-request-delivery={item.id} className={ACTION_BUTTON}>
                Solicitar confirmação
              </button>
              <button type="button" data-service-status="A fazer" data-entry-id={item.id} className={ACTION_BUTTON}>
                Voltar para A fazer
              </button>
            </>
          )}
          {item.status === "Entregue" && (
            <button type="button" data-service-status="Pronto" data-entry-id={item.id} className={ACTION_BUTTON}>
              Voltar para Feito
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {showStatusActions && (
            <>
              <button type="button" data-edit-entry={item.id} className={ACTION_BUTTON}>
                Editar
              </button>
              <button type="button" data-cancel-entry={item.id} className={DANGER_BUTTON}>
                Cancelar
              </button>
            </>
          )}
          <button type="button" data-delete-entry={item.id} className={DANGER_BUTTON}>
            Excluir
          </button>
        </div>
      </div>
    </article>
  );
}
