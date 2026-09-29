import type { PriceTableRow } from "@/catalog/data";

// Card Tailwind, mesmo padrao das demais telas - botoes sem handler React,
// so os data-* que o listener generico ja existente (app.js) escuta.
export function PriceTableCard({ row }: { row: PriceTableRow }) {
  return (
    <article className="price-table-card rounded-2xl border border-border bg-surface p-4">
      <h3 className="text-lg font-bold text-ink">{row.name}</h3>
      <p className="mt-1 text-sm text-muted">{row.clientCount} cliente(s) usando esta tabela</p>
      <div className="card-actions mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          data-edit-table={row.name}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink"
        >
          Editar
        </button>
        <button
          type="button"
          data-delete-table={row.name}
          className="rounded-lg border border-[var(--danger-40)] px-3 py-1.5 text-xs font-semibold text-danger"
        >
          Excluir
        </button>
      </div>
    </article>
  );
}
