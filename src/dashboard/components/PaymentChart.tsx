import { money } from "@/lib/format";
import type { DailyPoint } from "@/dashboard/data";

export function PaymentChart({ points }: { points: DailyPoint[] }) {
  const max = Math.max(...points.map((p) => p.value), 1);
  const total = points.reduce((sum, p) => sum + p.value, 0);
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-brand-ink">Pagamentos por dia</h3>
        <span className="text-sm font-bold text-ink">{money.format(total)}</span>
      </div>
      <div className="flex items-end gap-1" style={{ height: "120px" }}>
        {points.map((point) => (
          <div
            key={point.date}
            className="flex flex-1 flex-col items-center gap-1"
            title={`${point.date}: ${money.format(point.value)}`}
          >
            <div
              className="w-full rounded-t bg-accent"
              style={{ height: `${point.value ? Math.max(6, (point.value / max) * 100) : 2}%` }}
            />
            <span className="text-[10px] text-muted">{point.date.slice(8, 10)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
