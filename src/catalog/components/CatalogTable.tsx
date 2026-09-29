import { money } from "@/lib/format";
import type { CatalogItem } from "@/types/global";

// Tabela real (nao card) - preserva a comparacao lado a lado entre tabelas de
// preco que o layout em cards perderia. Decisao confirmada com o usuario na
// Fase 6 (ver plano). Botoes de acao sem handler React - mesmo data-* que o
// listener generico ja existente (app.js) escuta.
export function CatalogTable({ items, priceTableNames }: { items: CatalogItem[]; priceTableNames: string[] }) {
  if (!items.length) {
    return (
      <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
        Nenhum registro por aqui.
      </p>
    );
  }

  return (
    <div className="max-h-[496px] overflow-auto rounded-2xl border border-border bg-surface">
      <table className="w-full min-w-[480px] border-collapse text-sm">
        <thead>
          <tr className="sticky top-0 z-10 bg-surface-2 text-left text-xs font-semibold uppercase tracking-wide text-muted">
            <th className="px-4 py-3">Serviço</th>
            {priceTableNames.map((name) => (
              <th key={name} className="whitespace-nowrap px-4 py-3">
                {name}
              </th>
            ))}
            <th className="px-4 py-3">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((item) => (
            <tr key={item.id} className="odd:bg-surface even:bg-surface-2/40">
              <td className="px-4 py-3 font-semibold text-ink">
                {item.code ? `${item.code} - ${item.name}` : item.name}
              </td>
              {priceTableNames.map((name) => (
                <td key={name} className="whitespace-nowrap px-4 py-3 text-ink">
                  {money.format(item.prices[name] || 0)}
                </td>
              ))}
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    data-edit-catalog={item.id}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    data-delete-catalog={item.id}
                    className="rounded-lg border border-[var(--danger-40)] px-3 py-1.5 text-xs font-semibold text-danger"
                  >
                    Excluir
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
