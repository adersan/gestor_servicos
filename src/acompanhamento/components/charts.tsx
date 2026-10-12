import type { CSSProperties } from "react";

import type { TrackingServiceItem } from "@/acompanhamento/types";

interface StatusCounts {
  pending: number;
  done: number;
  delivered: number;
}

export function StatusDonut({ total, counts }: { total: number; counts: StatusCounts }) {
  const safeTotal = Math.max(1, total);
  const pendingEnd = (counts.pending / safeTotal) * 100;
  const doneEnd = ((counts.pending + counts.done) / safeTotal) * 100;
  const style = {
    background: `conic-gradient(var(--orange) 0 ${pendingEnd}%, var(--blue) ${pendingEnd}% ${doneEnd}%, var(--green) ${doneEnd}%)`
  } as CSSProperties;

  return (
    <div className="grid grid-cols-[140px_1fr] items-center gap-4">
      <div
        className="grid aspect-square w-[140px] place-items-center rounded-full"
        style={style}
      >
        <div className="z-[1] aspect-square w-[90px] rounded-full bg-white text-center shadow-inner">
          <div className="flex h-full flex-col items-center justify-center">
            <strong className="text-lg text-ink">{total}</strong>
            <span className="text-xs text-muted">serviços</span>
          </div>
        </div>
      </div>
      <div className="grid gap-2">
        <span className="flex items-center justify-between gap-2 rounded-lg bg-[#fff7eb] px-3 py-2 text-xs text-[var(--orange)]">
          A fazer <strong>{counts.pending}</strong>
        </span>
        <span className="flex items-center justify-between gap-2 rounded-lg bg-[#eef6ff] px-3 py-2 text-xs text-[var(--blue)]">
          Feitos <strong>{counts.done}</strong>
        </span>
        <span className="flex items-center justify-between gap-2 rounded-lg bg-[#edf9f2] px-3 py-2 text-xs text-[var(--green)]">
          Entregues <strong>{counts.delivered}</strong>
        </span>
      </div>
    </div>
  );
}

export function ServiceBarChart({ services }: { services: TrackingServiceItem[] }) {
  const grouped = Object.values(
    services.reduce<Record<string, { name: string; count: number; total: number }>>((result, item) => {
      result[item.service_name] ||= { name: item.service_name, count: 0, total: 0 };
      result[item.service_name].count += 1;
      result[item.service_name].total += Number(item.amount);
      return result;
    }, {})
  )
    .sort((a, b) => b.count - a.count || b.total - a.total)
    .slice(0, 6);

  if (!grouped.length) {
    return <p className="text-sm text-muted">Sem serviços para o gráfico.</p>;
  }

  const max = Math.max(1, ...grouped.map((item) => item.count));

  return (
    <div className="grid gap-2">
      {grouped.map((item) => (
        <div key={item.name} className="grid grid-cols-[1fr_2fr_auto] items-center gap-3 text-xs text-ink">
          <span className="truncate text-muted">{item.name}</span>
          <div className="h-2 rounded-full bg-surface-2">
            <i
              className="block h-2 rounded-full bg-brand"
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </div>
          <strong>{item.count}</strong>
        </div>
      ))}
    </div>
  );
}
