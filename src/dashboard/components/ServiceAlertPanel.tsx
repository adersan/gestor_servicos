import { ShieldAlert, ShieldCheck } from "lucide-react";

import type { ServiceAlerts } from "@/dashboard/data";

export function ServiceAlertPanel({ data }: { data: ServiceAlerts }) {
  const hasAlerts = data.overdue.length > 0;
  return (
    <div className={`rounded-2xl border p-4 ${hasAlerts ? "border-[var(--danger-40)]" : "border-border"} bg-surface`}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {hasAlerts ? <ShieldAlert className="h-4 w-4 text-danger" /> : <ShieldCheck className="h-4 w-4 text-emerald-600" />}
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-wide text-muted">Alertas operacionais</span>
            <h3 className="text-sm font-semibold text-brand-ink">Serviços pendentes</h3>
          </div>
        </div>
        <button
          type="button"
          className="rounded-xl px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-[var(--primary-10)]"
          onClick={() => window.showView("services")}
        >
          Ver lançamentos
        </button>
      </div>
      <div className="mb-4 flex gap-6">
        <div>
          <span className="block text-xs text-muted">A fazer</span>
          <strong className="text-lg text-ink">{data.pendingCount}</strong>
        </div>
        <div>
          <span className="block text-xs text-muted">Acima de 24h</span>
          <strong className={`text-lg ${hasAlerts ? "text-danger" : "text-ink"}`}>{data.overdue.length}</strong>
        </div>
      </div>
      {hasAlerts ? (
        <ul className="flex flex-col divide-y divide-border">
          {data.overdue.map((item) => {
            const client = window.clientById(item.clientId);
            return (
              <li key={item.id} className="py-2 text-sm first:pt-0 last:pb-0">
                <strong className="text-ink">
                  {client?.name ?? ""}: {item.description}
                </strong>
                <span className="block text-xs text-muted">
                  {item.reference || "Sem referência"} · {window.formatServiceAge(item)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted">Nenhum serviço ultrapassou 24 horas.</p>
      )}
    </div>
  );
}
