import { Star } from "lucide-react";

import type { Supplier } from "@/types/global";

const ACTION_BUTTON = "rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-2";
const DANGER_BUTTON = "rounded-lg border border-[var(--danger-40)] bg-surface px-3 py-1.5 text-xs font-semibold text-danger transition-colors hover:bg-[var(--danger-10)]";

// Mesmo perfil visual dos outros cards ja portados: cabecalho branco, bloco
// de acoes pastel, sem linhas divisorias. Botoes de mutacao sem onClick, so
// os data-* que o listener generico ja existente (supplier.js) escuta.
export function SupplierCard({ supplier }: { supplier: Supplier }) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-4 transition-shadow hover:shadow-md">
      {supplier.isDefault && (
        <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-[var(--primary-15)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
          <Star className="h-3 w-3" />
          Fornecedor padrão
        </span>
      )}
      <h3 className="truncate text-base font-extrabold text-ink">{supplier.name}</h3>
      <p className="mt-1 text-sm text-muted">
        {supplier.phone || "Sem telefone"} · {supplier.document || "Sem documento"}
      </p>

      <div className="mt-3 flex flex-wrap gap-2 rounded-xl bg-[var(--primary-15)] p-3">
        <button type="button" data-supplier-services={supplier.id} className={ACTION_BUTTON}>
          Serviços
        </button>
        <button type="button" data-edit-supplier={supplier.id} className={ACTION_BUTTON}>
          Editar
        </button>
        <button type="button" data-delete-supplier={supplier.id} className={DANGER_BUTTON}>
          Excluir
        </button>
      </div>
    </article>
  );
}
