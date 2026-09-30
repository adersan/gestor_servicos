import { money } from "@/lib/format";
import type { SupplierEntry } from "@/types/global";

const STATUS_PILL_STYLES: Record<string, string> = {
  "A fazer": "bg-[#fdeceb] text-danger",
  Feito: "bg-[#eef7ff] text-[#155f9f]",
  Entregue: "bg-[#edf9f2] text-[#117440]",
  Cancelado: "bg-[var(--danger-15)] text-danger italic"
};

const REFERENCE_STYLES: Record<string, string> = {
  "A fazer": "border-[#f2c1b8] bg-[#fdeceb] text-danger",
  Feito: "border-[#bdd8ef] bg-[#eef7ff] text-[#155f9f]",
  Entregue: "border-[#a9ddbd] bg-[#edf9f2] text-[#117440]",
  Cancelado: "border-[#f2c1b8] bg-[#fdeceb] text-danger italic"
};

const ACTION_BUTTON = "rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-2 disabled:opacity-50 disabled:pointer-events-none";
const POSITIVE_BUTTON = "rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600 transition-colors hover:bg-emerald-500/20 disabled:opacity-50 disabled:pointer-events-none";
const DANGER_BUTTON = "rounded-lg border border-[var(--danger-40)] bg-surface px-3 py-1.5 text-xs font-semibold text-danger transition-colors hover:bg-[var(--danger-10)] disabled:opacity-50 disabled:pointer-events-none";

function cardDateParts(dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "short" }).format(date).replace(".", "");
  return { day, month };
}

// Mesmo perfil visual do ServiceCard (Fase 7): cabecalho branco, bloco de
// detalhes pastel, bloco de acoes pastel, sem linhas divisorias, status
// colorido (aqui "Feito" ocupa o lugar de "Pronto"). Fornecedor fica em
// destaque (era o cliente no card de Lancamento) - cliente vinculado vira
// tag secundaria. Botoes de mutacao sem onClick - so os data-* que o
// listener generico ja existente (supplier.js) escuta; ficam desabilitados
// quando o lancamento ja esta numa conta a pagar (payableId), igual o
// vanilla ja fazia. Ver Fase 10.
export function SupplierEntryCard({ entry }: { entry: SupplierEntry }) {
  const { clientName, supplierById, originCancelledNote, supplierEntryStatusDates } = window.supplierModule;
  const supplier = supplierById(entry.supplierId);
  const statusPillClass = STATUS_PILL_STYLES[entry.status] || STATUS_PILL_STYLES.Cancelado;
  const referenceClass = REFERENCE_STYLES[entry.status] || REFERENCE_STYLES.Cancelado;
  const { day, month } = cardDateParts(entry.date);
  const statusDates = supplierEntryStatusDates(entry);
  const originNote = originCancelledNote(entry);
  const locked = Boolean(entry.payableId);

  return (
    <article className="rounded-2xl border border-border bg-surface p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className="grid shrink-0 place-items-center rounded-xl bg-[var(--primary-15)] px-2.5 py-1.5 text-center leading-tight text-primary">
          <strong className="text-lg">{day}</strong>
          <span className="text-[10px] font-bold uppercase tracking-wide opacity-80">{month}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-extrabold text-ink">
            <span className={`mr-2 mb-0.5 inline-block rounded-full px-2.5 py-1 align-middle text-xs font-semibold ${statusPillClass}`}>
              {entry.status}
            </span>
            {entry.description}
          </h3>
          <span className={`mt-1.5 inline-flex items-center rounded-lg border px-2.5 py-1 text-sm font-extrabold tracking-wide ${referenceClass}`}>
            {entry.reference || "Sem referência"}
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2.5 rounded-xl bg-surface-2 p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="truncate text-sm font-extrabold text-[#1768ad]">{supplier?.name || ""}</span>
          <strong className="shrink-0 whitespace-nowrap text-lg font-extrabold text-ink">{money.format(entry.amount)}</strong>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-surface px-2 py-1 text-xs font-semibold text-muted">
            {entry.clientId ? clientName(entry.clientId) : "Sem cliente vinculado"} · {entry.source}
          </span>
          {entry.lastChangedBy === "Fornecedor" && (
            <span className="rounded-full bg-[#eee8fa] px-2 py-1 text-xs font-semibold text-[#654697]">Alterado pelo fornecedor</span>
          )}
          {originNote && <span className="rounded-full bg-[#fff2d7] px-2 py-1 text-xs font-semibold text-[#7d4b05]">{originNote}</span>}
        </div>

        {entry.status === "Cancelado" && (
          <p className="rounded-lg bg-[#fdecea] px-2.5 py-2 text-xs leading-relaxed text-[#8d3d35]">
            <strong>Motivo:</strong> {entry.cancellationReason || "Não informado"}
            {entry.cancellationOriginalAmount !== null && entry.cancellationOriginalAmount !== undefined
              ? ` · Custo anterior: ${money.format(entry.cancellationOriginalAmount)}`
              : ""}
          </p>
        )}

        {statusDates && <p className="text-xs text-muted">{statusDates}</p>}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--primary-15)] p-3">
        <div className="flex flex-wrap gap-2">
          {entry.status !== "Cancelado" && (
            <>
              {entry.status === "A fazer" && (
                <button type="button" data-supplier-entry-status="Feito" data-entry-id={entry.id} disabled={locked} className={POSITIVE_BUTTON}>
                  Marcar feito
                </button>
              )}
              {entry.status === "Feito" && (
                <>
                  <button type="button" data-supplier-entry-status="Entregue" data-entry-id={entry.id} disabled={locked} className={POSITIVE_BUTTON}>
                    Marcar entregue
                  </button>
                  <button type="button" data-supplier-entry-status="A fazer" data-entry-id={entry.id} disabled={locked} className={ACTION_BUTTON}>
                    Voltar para A fazer
                  </button>
                </>
              )}
              {entry.status === "Entregue" && (
                <button type="button" data-supplier-entry-status="Feito" data-entry-id={entry.id} disabled={locked} className={ACTION_BUTTON}>
                  Voltar para Feito
                </button>
              )}
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {entry.status !== "Cancelado" && (
            <>
              <button type="button" data-edit-supplier-entry={entry.id} disabled={locked} className={ACTION_BUTTON}>
                Editar
              </button>
              <button type="button" data-cancel-supplier-entry={entry.id} disabled={locked} className={DANGER_BUTTON}>
                Cancelar
              </button>
            </>
          )}
          <button type="button" data-delete-supplier-entry={entry.id} disabled={locked} className={DANGER_BUTTON}>
            Excluir
          </button>
        </div>
      </div>
    </article>
  );
}
