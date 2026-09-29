import { ShieldAlert, ShieldCheck } from "lucide-react";

import { money } from "@/lib/format";
import type { BillingAlertData } from "@/dashboard/data";

export function BillingAlertPanel({ data }: { data: BillingAlertData }) {
  const hasAlerts = data.overdueCount > 0;
  return (
    <div className={`rounded-2xl border p-4 ${hasAlerts ? "border-[var(--danger-40)]" : "border-border"} bg-surface`}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {hasAlerts ? <ShieldAlert className="h-4 w-4 text-danger" /> : <ShieldCheck className="h-4 w-4 text-emerald-600" />}
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-wide text-muted">Alertas financeiros</span>
            <h3 className="text-sm font-semibold text-brand-ink">Cobranças em aberto</h3>
          </div>
        </div>
        <button
          type="button"
          className="rounded-xl px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-[var(--primary-10)]"
          onClick={() => window.showView("payments")}
        >
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
          <strong className={`text-lg ${hasAlerts ? "text-danger" : "text-ink"}`}>{money.format(data.overdueTotal)}</strong>
          <span className="block text-xs text-muted">{data.overdueCount} cobrança(s)</span>
        </div>
      </div>
    </div>
  );
}
