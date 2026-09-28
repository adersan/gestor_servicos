import { money } from "@/lib/format";
import type { BillingAlertData } from "@/dashboard/data";

export function BillingAlertPanel({ data }: { data: BillingAlertData }) {
  return (
    <div className={`rounded-xl border p-4 ${data.overdueCount ? "border-danger" : "border-border"} bg-surface`}>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wide text-muted">Alertas financeiros</span>
          <h3 className="text-sm font-semibold text-brand-ink">Cobranças em aberto</h3>
        </div>
        <button type="button" className="text-xs font-semibold text-primary" onClick={() => window.showView("payments")}>
          Ver pagamentos
        </button>
      </div>
      <div className="flex gap-6">
        <div>
          <span className="block text-xs text-muted">Em aberto</span>
          <strong className="text-lg text-ink">{money.format(data.openTotal)}</strong>
          <span className="block text-xs text-muted">{data.openCount} cobrança(s)</span>
        </div>
        <div>
          <span className="block text-xs text-muted">Em atraso</span>
          <strong className={`text-lg ${data.overdueCount ? "text-danger" : "text-ink"}`}>
            {money.format(data.overdueTotal)}
          </strong>
          <span className="block text-xs text-muted">{data.overdueCount} cobrança(s)</span>
        </div>
      </div>
    </div>
  );
}
