import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Period } from "@/types/global";
import type { PeriodMode } from "@/dashboard/data";

export function PeriodControls({
  period,
  mode,
  onWeek,
  onMonth,
  onShiftMonth,
  onCustomDates
}: {
  period: Period;
  mode: PeriodMode;
  onWeek: () => void;
  onMonth: () => void;
  onShiftMonth: (direction: 1 | -1) => void;
  onCustomDates: (startDate: string, endDate: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant={mode === "week" ? "default" : "outline"} size="sm" onClick={onWeek}>
          Semana atual
        </Button>
        <Button variant={mode === "month" ? "default" : "outline"} size="sm" onClick={onMonth}>
          Mês atual
        </Button>
        {mode === "month" && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => onShiftMonth(-1)} aria-label="Mês anterior">
              ‹
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onShiftMonth(1)} aria-label="Próximo mês">
              ›
            </Button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 text-sm">
        <label className="flex items-center gap-1 text-muted">
          De
          <input
            type="date"
            value={period.startDate}
            onChange={(event) => onCustomDates(event.target.value, period.endDate)}
            className={cn("rounded-md border border-border bg-background px-2 py-1 text-ink")}
          />
        </label>
        <label className="flex items-center gap-1 text-muted">
          Até
          <input
            type="date"
            value={period.endDate}
            onChange={(event) => onCustomDates(period.startDate, event.target.value)}
            className={cn("rounded-md border border-border bg-background px-2 py-1 text-ink")}
          />
        </label>
      </div>
    </div>
  );
}
