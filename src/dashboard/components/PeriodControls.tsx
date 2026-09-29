import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
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
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant={mode === "week" ? "default" : "outline"} size="sm" onClick={onWeek}>
          Semana atual
        </Button>
        <Button variant={mode === "month" ? "default" : "outline"} size="sm" onClick={onMonth}>
          Mês atual
        </Button>
        {mode === "month" && (
          <div className="flex items-center overflow-hidden rounded-xl border border-border">
            <button
              type="button"
              onClick={() => onShiftMonth(-1)}
              aria-label="Mês anterior"
              className="flex h-8 w-8 items-center justify-center text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="h-5 w-px bg-border" />
            <button
              type="button"
              onClick={() => onShiftMonth(1)}
              aria-label="Próximo mês"
              className="flex h-8 w-8 items-center justify-center text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 text-sm text-muted">
        <CalendarDays className="h-4 w-4" />
        <input
          type="date"
          value={period.startDate}
          onChange={(event) => onCustomDates(event.target.value, period.endDate)}
          className="rounded-xl border border-border bg-background px-2 py-1 text-ink"
        />
        <span>até</span>
        <input
          type="date"
          value={period.endDate}
          onChange={(event) => onCustomDates(period.startDate, event.target.value)}
          className="rounded-xl border border-border bg-background px-2 py-1 text-ink"
        />
      </div>
    </div>
  );
}
