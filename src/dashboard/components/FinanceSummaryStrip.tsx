import { money } from "@/lib/format";
import type { FinanceSummaryData } from "@/dashboard/data";

export function FinanceSummaryStrip({ data }: { data: FinanceSummaryData }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <button
        type="button"
        onClick={() => window.showView("billing")}
        className="rounded-lg border border-border bg-surface p-3 text-left"
      >
        <span className="block text-xs text-muted">Em aberto</span>
        <strong className="text-lg text-ink">{money.format(data.openTotal)}</strong>
      </button>
      <button
        type="button"
        onClick={() => window.showView("billing")}
        className={`rounded-lg border p-3 text-left ${data.overdueTotal > 0 ? "border-danger" : "border-border"} bg-surface`}
      >
        <span className="block text-xs text-muted">Atrasado</span>
        <strong className={data.overdueTotal > 0 ? "text-lg text-danger" : "text-lg text-ink"}>
          {money.format(data.overdueTotal)}
        </strong>
      </button>
      <button
        type="button"
        onClick={() => window.showView("payments")}
        className="rounded-lg border border-border bg-surface p-3 text-left"
      >
        <span className="block text-xs text-muted">Recebido hoje</span>
        <strong className="text-lg text-ink">{money.format(data.receivedToday)}</strong>
      </button>
    </div>
  );
}
