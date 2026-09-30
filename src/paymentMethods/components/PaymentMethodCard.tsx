import type { PaymentMethod } from "@/types/global";

const ACTION_BUTTON = "rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-2";
const DANGER_BUTTON = "rounded-lg border border-[var(--danger-40)] bg-surface px-3 py-1.5 text-xs font-semibold text-danger transition-colors hover:bg-[var(--danger-10)]";

// Mesmo perfil visual dos outros cards ja portados: cabecalho branco, bloco
// de acoes pastel, sem linhas divisorias. Botoes de mutacao sem onClick, so
// os data-* que o listener generico ja existente (app.js) escuta.
export function PaymentMethodCard({ method }: { method: PaymentMethod }) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="block text-xs font-semibold uppercase tracking-wide text-muted">{method.type}</span>
          <h3 className="truncate text-base font-extrabold text-ink">{method.name}</h3>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
            method.active ? "bg-[#edf9f2] text-[#117440]" : "bg-[#fdeceb] text-danger"
          }`}
        >
          {method.active ? "Ativa" : "Inativa"}
        </span>
      </div>

      <p className="mt-2 text-sm text-muted">{method.details || "Sem instruções cadastradas"}</p>
      {method.link && <p className="mt-1 truncate text-sm text-muted">{method.link}</p>}

      <div className="mt-3 flex flex-wrap gap-2 rounded-xl bg-[var(--primary-15)] p-3">
        <button type="button" data-edit-method={method.id} className={ACTION_BUTTON}>
          Editar
        </button>
        <button type="button" data-delete-method={method.id} className={DANGER_BUTTON}>
          Excluir
        </button>
      </div>
    </article>
  );
}
