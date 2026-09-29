import { money } from "@/lib/format";
import type { ServiceEntry } from "@/types/global";

const STATUS_PILL_STYLES: Record<string, string> = {
  "A fazer": "bg-[#fdeceb] text-danger",
  Pronto: "bg-[#eef7ff] text-[#155f9f]",
  Entregue: "bg-[#edf9f2] text-[#117440]",
  Cancelado: "bg-[var(--danger-15)] text-danger italic"
};

const REFERENCE_STYLES: Record<string, string> = {
  "A fazer": "border-[#f2c1b8] bg-[#fdeceb] text-danger",
  Pronto: "border-[#bdd8ef] bg-[#eef7ff] text-[#155f9f]",
  Entregue: "border-[#a9ddbd] bg-[#edf9f2] text-[#117440]",
  Cancelado: "border-[#f2c1b8] bg-[#fdeceb] text-danger italic"
};

const ACTION_BUTTON = "rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-2";
const POSITIVE_BUTTON = "rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600 transition-colors hover:bg-emerald-500/20";
const DANGER_BUTTON = "rounded-lg border border-[var(--danger-40)] px-3 py-1.5 text-xs font-semibold text-danger transition-colors hover:bg-[var(--danger-10)]";

function cardDateParts(dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "short" }).format(date).replace(".", "");
  return { day, month };
}

// Replica serviceItemMarkup() (app.js) em card Tailwind - cabecalho com selo de
// data + status na frente do servico + referencia colorida por status, linha de
// cliente/valor, tags, log e acoes - mesma linguagem visual do card vanilla
// (.timeline-item/.service-card-*), so que em componente React. Todas as acoes
// reais sempre visiveis (sem accordion "Mais opções" do vanilla mobile, ver
// plano Fase 7). Botoes sem handler React, so os data-* que o listener
// generico ja existente (app.js) escuta.
export function ServiceCard({ item, linked = false }: { item: ServiceEntry; linked?: boolean }) {
  const overdue = window.isOverdueService(item);
  const originNote = window.originCancelledNote(item);
  const statusDates = window.serviceStatusDates(item);
  const statusPillClass = STATUS_PILL_STYLES[item.status] || STATUS_PILL_STYLES.Cancelado;
  const referenceClass = REFERENCE_STYLES[item.status] || REFERENCE_STYLES.Cancelado;
  const client = window.clientById(item.clientId);
  const { day, month } = cardDateParts(item.date);
  const showStatusActions = item.status !== "Cancelado";
  const hasTags = Boolean(
    item.requestedBy || item.isSecondary || overdue || (item.confirmationRequestedAt && item.status === "Pronto") || item.deliveredAt || originNote
  );

  return (
    <article
      className={`timeline-item rounded-2xl border bg-surface p-4 transition-shadow hover:shadow-md ${
        overdue ? "border-[var(--danger-40)]" : "border-border"
      } ${linked ? "ml-3 border-l-4 border-l-[var(--primary-40)]" : ""} ${item.isSecondary ? "bg-surface-2/40" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div className="grid shrink-0 place-items-center rounded-xl bg-[var(--primary-15)] px-2.5 py-1.5 text-center leading-tight text-primary">
          <strong className="text-lg">{day}</strong>
          <span className="text-[10px] font-bold uppercase tracking-wide opacity-80">{month}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-extrabold text-ink">
            <span className={`mr-2 mb-0.5 inline-block rounded-full px-2.5 py-1 align-middle text-xs font-semibold ${statusPillClass}`}>
              {window.serviceStatusLabel(item.status)}
            </span>
            {item.description}
          </h3>
          <span className={`mt-1.5 inline-flex items-center rounded-lg border px-2.5 py-1 text-sm font-extrabold tracking-wide ${referenceClass}`}>
            {item.reference || "Sem referência"}
          </span>
        </div>
      </div>

      <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-dashed border-border pt-3">
        <span className="truncate text-sm font-extrabold text-[#1768ad]">{client?.name || "Sem cliente"}</span>
        <strong className="shrink-0 whitespace-nowrap text-lg font-extrabold text-ink">{money.format(item.amount)}</strong>
      </div>

      {hasTags && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {item.requestedBy && (
            <span className="rounded-full bg-surface-2 px-2 py-1 text-xs font-semibold text-muted">Solicitante: {item.requestedBy}</span>
          )}
          {item.isSecondary && (
            <span className="rounded-full bg-[#eee8fa] px-2 py-1 text-xs font-semibold text-[#654697]">Serviço complementar</span>
          )}
          {overdue && (
            <span className="rounded-full bg-[var(--danger-15)] px-2 py-1 text-xs font-semibold text-danger">{window.formatServiceAge(item)}</span>
          )}
          {item.confirmationRequestedAt && item.status === "Pronto" && (
            <span className="rounded-full bg-[#fff5e8] px-2 py-1 text-xs font-semibold text-[#a45b10]">Confirmação solicitada</span>
          )}
          {item.deliveredAt && (
            <span className="rounded-full bg-[#edf9f2] px-2 py-1 text-xs font-semibold text-[#117440]">{window.deliveredLabel(item)}</span>
          )}
          {originNote && <span className="rounded-full bg-[#fff2d7] px-2 py-1 text-xs font-semibold text-[#7d4b05]">{originNote}</span>}
        </div>
      )}

      {item.status === "Cancelado" && (
        <p className="mt-2.5 rounded-lg bg-[#fdecea] px-2.5 py-2 text-xs leading-relaxed text-[#8d3d35]">
          <strong>Motivo:</strong> {item.cancellationReason || "Não informado"}
          {item.cancellationOriginalAmount !== null && item.cancellationOriginalAmount !== undefined
            ? ` · Valor anterior: ${money.format(item.cancellationOriginalAmount)}`
            : ""}
        </p>
      )}

      {statusDates && <p className="mt-2.5 border-t border-dashed border-border pt-2.5 text-xs text-muted">{statusDates}</p>}

      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-border pt-3">
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
