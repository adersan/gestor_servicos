import { money } from "@/lib/format";
import type { AccountRow } from "@/dashboard/data";

export function AccountList({ rows }: { rows: AccountRow[] }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-brand-ink">Saldos no período · Contas por cliente</h3>
        <button type="button" className="text-xs font-semibold text-primary" onClick={() => window.showView("payments")}>
          Ver pagamentos
        </button>
      </div>
      {rows.length ? (
        <div className="flex flex-col divide-y divide-border">
          {rows.map((row) => (
            <div key={row.client.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-ink">{row.client.name}</p>
                <p className="truncate text-xs text-muted">{row.client.priceGroup}</p>
              </div>
              <span className="whitespace-nowrap text-xs text-muted">
                {money.format(row.serviceAmount)} / abatido {money.format(row.paymentAmount)}
              </span>
              <strong className={`whitespace-nowrap ${row.balance < 0 ? "text-danger" : "text-ink"}`}>
                {money.format(row.balance)}
              </strong>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">Nenhum registro por aqui.</p>
      )}
    </div>
  );
}
