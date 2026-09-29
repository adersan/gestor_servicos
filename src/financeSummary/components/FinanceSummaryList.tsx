import { AvatarInitials } from "@/components/ui/avatar-initials";
import { money } from "@/lib/format";
import type { FinanceSummaryRow } from "@/financeSummary/data";

export function FinanceSummaryList({ rows }: { rows: FinanceSummaryRow[] }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      {rows.length ? (
        <div className="flex flex-col divide-y divide-border">
          {rows.map((row) => (
            <div key={row.client.id} className="flex items-center gap-3 py-2.5 text-sm">
              <AvatarInitials name={row.client.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{row.client.name}</p>
                <p className="truncate text-xs text-muted">{row.client.priceGroup || ""}</p>
              </div>
              <span className="hidden whitespace-nowrap text-xs text-muted sm:inline">
                Cobrança anterior {money.format(row.previousBalance)} · Consumo {money.format(row.periodServiceTotal)} · Pago{" "}
                {money.format(row.periodPaymentTotal)}
              </span>
              <strong className={`whitespace-nowrap ${row.openBalance < 0 ? "text-danger" : "text-ink"}`}>
                {money.format(row.openBalance)}
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
