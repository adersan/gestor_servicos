import type { ServiceAlerts } from "@/dashboard/data";

export function ServiceAlertPanel({ data }: { data: ServiceAlerts }) {
  return (
    <div className={`rounded-xl border p-4 ${data.overdue.length ? "border-danger" : "border-border"} bg-surface`}>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wide text-muted">Alertas operacionais</span>
          <h3 className="text-sm font-semibold text-brand-ink">Serviços pendentes</h3>
        </div>
        <button type="button" className="text-xs font-semibold text-primary" onClick={() => window.showView("services")}>
          Ver lançamentos
        </button>
      </div>
      <div className="mb-3 flex gap-4">
        <div>
          <span className="block text-xs text-muted">A fazer</span>
          <strong className="text-lg text-ink">{data.pendingCount}</strong>
        </div>
        <div>
          <span className="block text-xs text-muted">Acima de 24h</span>
          <strong className={`text-lg ${data.overdue.length ? "text-danger" : "text-ink"}`}>{data.overdue.length}</strong>
        </div>
      </div>
      {data.overdue.length ? (
        <ul className="flex flex-col gap-1.5">
          {data.overdue.map((item) => {
            const client = window.clientById(item.clientId);
            return (
              <li key={item.id} className="text-sm">
                <strong className="text-ink">{client?.name ?? ""}: {item.description}</strong>
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
