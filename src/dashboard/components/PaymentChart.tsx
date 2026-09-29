import { LineChart } from "lucide-react";

import { money } from "@/lib/format";
import type { DailyPoint } from "@/dashboard/data";

export function PaymentChart({ points }: { points: DailyPoint[] }) {
  const max = Math.max(...points.map((p) => p.value), 1);
  const total = points.reduce((sum, p) => sum + p.value, 0);
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LineChart className="h-4 w-4 text-muted" />
          <h3 className="text-sm font-semibold text-brand-ink">Pagamentos por dia</h3>
        </div>
        <span className="text-sm font-bold text-ink">{money.format(total)}</span>
      </div>
      <div className="flex items-end gap-1.5" style={{ height: "120px" }}>
        {points.map((point) => (
          <div
            key={point.date}
            className="group flex flex-1 flex-col items-center gap-1.5"
            title={`${point.date}: ${money.format(point.value)}`}
          >
            <div
              className="w-full rounded-t-lg bg-gradient-to-t from-accent to-accent/60 transition-all duration-500 ease-out group-hover:from-accent group-hover:to-accent"
              style={{ height: `${point.value ? Math.max(6, (point.value / max) * 100) : 2}%` }}
            />
            <span className="text-[10px] text-muted">{point.date.slice(8, 10)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
