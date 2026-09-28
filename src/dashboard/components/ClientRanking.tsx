import { money } from "@/lib/format";
import type { ClientVolume } from "@/dashboard/data";

export function ClientRanking({ items }: { items: ClientVolume[] }) {
  const max = Math.max(...items.map((item) => item.count), 1);
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-3 text-sm font-semibold text-brand-ink">Ranking de clientes</h3>
      {items.length ? (
        <div className="flex flex-col gap-2">
          {items.map((item, index) => (
            <div key={item.client.id} className="flex items-center gap-3 text-sm">
              <span className="w-5 text-center font-bold text-muted">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{item.client.name}</p>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full bg-primary" style={{ width: `${(item.count / max) * 100}%` }} />
                </div>
              </div>
              <span className="whitespace-nowrap text-xs text-muted">{item.count} serviço(s)</span>
              <strong className="whitespace-nowrap text-ink">{money.format(item.amount)}</strong>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">Nenhum serviço no período selecionado.</p>
      )}
    </div>
  );
}
