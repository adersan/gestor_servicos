import type { DailyPoint } from "@/dashboard/data";

export function VolumeChart({ points }: { points: DailyPoint[] }) {
  const max = Math.max(...points.map((p) => p.value), 1);
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-3 text-sm font-semibold text-brand-ink">Volume diário de serviços</h3>
      {points.length ? (
        <div className="flex items-end gap-1" style={{ height: "120px" }}>
          {points.map((point) => (
            <div key={point.date} className="flex flex-1 flex-col items-center gap-1" title={`${point.date}: ${point.value}`}>
              <div
                className="w-full rounded-t bg-primary"
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
