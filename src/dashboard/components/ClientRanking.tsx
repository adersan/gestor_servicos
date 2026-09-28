import { Trophy, Users } from "lucide-react";

import { AvatarInitials } from "@/components/ui/avatar-initials";
import { money } from "@/lib/format";
import type { ClientVolume } from "@/dashboard/data";

const MEDAL_COLORS = ["text-amber-500", "text-slate-400", "text-amber-700"];

export function ClientRanking({ items }: { items: ClientVolume[] }) {
  const max = Math.max(...items.map((item) => item.count), 1);
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-4 flex items-center gap-2">
        <Users className="h-4 w-4 text-muted" />
        <h3 className="text-sm font-semibold text-brand-ink">Ranking de clientes</h3>
      </div>
      {items.length ? (
        <div className="flex flex-col gap-3">
          {items.map((item, index) => (
            <div key={item.client.id} className="flex items-center gap-3 text-sm">
              <span className="flex w-5 items-center justify-center">
                {index < 3 ? (
                  <Trophy className={`h-4 w-4 ${MEDAL_COLORS[index]}`} />
                ) : (
                  <span className="text-xs font-bold text-muted">{index + 1}</span>
                )}
              </span>
              <AvatarInitials name={item.client.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{item.client.name}</p>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                    style={{ width: `${(item.count / max) * 100}%` }}
                  />
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
