import { BarChart3 } from "lucide-react";

import type { DailyPoint } from "@/dashboard/data";

export function VolumeChart({ points }: { points: DailyPoint[] }) {
  const max = Math.max(...points.map((p) => p.value), 1);
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-muted" />
        <h3 className="text-sm font-semibold text-brand-ink">Volume diário de serviços</h3>
      </div>
      {points.length ? (
        <div className="flex items-end gap-1.5" style={{ height: "120px" }}>
          {points.map((point) => (
            <div key={point.date} className="group flex flex-1 flex-col items-center gap-1.5" title={`${point.date}: ${point.value}`}>
              <div
                className="w-full rounded-t-lg bg-gradient-to-t from-primary to-[var(--primary-60)] transition-all duration-500 ease-out group-hover:to-primary"
                style={{ height: `${point.value ? Math.max(6, (point.value / max) * 100) : 2}%` }}
              />
              <span className="text-[10px] text-muted">{point.date.slice(8, 10)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">Nenhum serviço no período.</p>
      )}
    </div>
  );
}
