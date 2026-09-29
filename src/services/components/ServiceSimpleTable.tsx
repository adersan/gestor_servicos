import { shortDateFormat } from "@/services/data";
import { money } from "@/lib/format";
import type { ServiceGroup } from "@/types/global";

export function ServiceSimpleTable({
  groups,
  selectionActive,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll
}: {
  groups: ServiceGroup[];
  selectionActive: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string, checked: boolean) => void;
  onToggleSelectAll: (checked: boolean) => void;
}) {
  if (!groups.length) {
    return (
      <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
        Nenhum registro por aqui.
      </p>
    );
  }

  const allSelected = groups.length > 0 && groups.every((group) => selectedIds.has(group.primary.id));

  return (
    <div className="max-h-[640px] overflow-auto rounded-2xl border border-border bg-surface">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="sticky top-0 z-10 bg-surface-2 text-left text-xs font-semibold uppercase tracking-wide text-muted">
            <th className="px-4 py-3">Data</th>
            <th className="px-4 py-3">Referência</th>
            <th className="px-4 py-3">Cliente</th>
            <th className="px-4 py-3">Serviço</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Valor</th>
            {selectionActive && (
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  aria-label="Selecionar todos"
                  checked={allSelected}
                  onChange={(event) => onToggleSelectAll(event.target.checked)}
                />
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {groups.map(({ primary, complementary }) => {
            const total = [primary, ...complementary].reduce((sum, item) => sum + Number(item.amount), 0);
            const overdue = window.isOverdueService(primary);
            const fullServiceLabel = `${primary.description}${complementary.length ? ` + ${complementary.length} complementar(es)` : ""}`;
            return (
              <tr
                key={primary.id}
                onClick={() => window.openServiceQuickView(primary.id)}
                className={`cursor-pointer odd:bg-surface even:bg-surface-2/40 hover:bg-surface-3 ${overdue ? "text-danger" : ""}`}
              >
                <td className="whitespace-nowrap px-4 py-3">{shortDateFormat.format(new Date(`${primary.date}T00:00:00Z`))}</td>
                <td className="whitespace-nowrap px-4 py-3 font-semibold text-ink">{primary.reference || "Sem referência"}</td>
                <td className="px-4 py-3 text-ink">{window.clientById(primary.clientId)?.name || ""}</td>
                <td className="px-4 py-3 text-ink">{fullServiceLabel}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className="inline-flex items-center rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink">
                    {window.serviceStatusLabel(primary.status)}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-semibold text-ink">{money.format(total)}</td>
                {selectionActive && (
                  <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label="Selecionar"
                      checked={selectedIds.has(primary.id)}
                      onChange={(event) => onToggleSelect(primary.id, event.target.checked)}
                    />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
