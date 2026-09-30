import { money } from "@/lib/format";
import type { SupplierEntry } from "@/types/global";

const shortDateFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "2-digit" });

export function SupplierEntrySimpleTable({
  entries,
  selectionActive,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll
}: {
  entries: SupplierEntry[];
  selectionActive: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string, checked: boolean) => void;
  onToggleSelectAll: (checked: boolean) => void;
}) {
  if (!entries.length) {
    return <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">Nenhum registro por aqui.</p>;
  }

  const { supplierById } = window.supplierModule;
  const selectable = entries.filter((entry) => !entry.payableId);
  const allSelected = selectable.length > 0 && selectable.every((entry) => selectedIds.has(entry.id));

  return (
    <div className="max-h-[640px] overflow-auto rounded-2xl border border-border bg-surface">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="sticky top-0 z-10 bg-surface-2 text-left text-xs font-semibold uppercase tracking-wide text-muted">
            <th className="px-4 py-3">Data</th>
            <th className="px-4 py-3">Referência</th>
            <th className="px-4 py-3">Fornecedor</th>
            <th className="px-4 py-3">Serviço</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Valor</th>
            {selectionActive && (
              <th className="px-4 py-3">
                <input type="checkbox" aria-label="Selecionar todos" checked={allSelected} onChange={(event) => onToggleSelectAll(event.target.checked)} />
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {entries.map((entry) => (
            <tr
              key={entry.id}
              onClick={() => window.supplierModule.openSupplierEntryQuickView(entry.id)}
              className="cursor-pointer odd:bg-surface even:bg-surface-2/40 hover:bg-surface-3"
            >
              <td className="whitespace-nowrap px-4 py-3">{shortDateFormat.format(new Date(`${entry.date}T00:00:00Z`))}</td>
              <td className="whitespace-nowrap px-4 py-3 font-semibold text-ink">{entry.reference || "Sem referência"}</td>
              <td className="px-4 py-3 text-ink">{supplierById(entry.supplierId)?.name || ""}</td>
              <td className="px-4 py-3 text-ink">{entry.description}</td>
              <td className="whitespace-nowrap px-4 py-3">
                <span className="inline-flex items-center rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink">{entry.status}</span>
              </td>
              <td className="whitespace-nowrap px-4 py-3 font-semibold text-ink">{money.format(entry.amount)}</td>
              {selectionActive && (
                <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                  {!entry.payableId && (
                    <input
                      type="checkbox"
                      aria-label="Selecionar"
                      checked={selectedIds.has(entry.id)}
                      onChange={(event) => onToggleSelect(entry.id, event.target.checked)}
                    />
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
