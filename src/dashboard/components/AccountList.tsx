import { Landmark } from "lucide-react";

import { AvatarInitials } from "@/components/ui/avatar-initials";
import { money } from "@/lib/format";
import type { AccountRow } from "@/dashboard/data";

export function AccountList({ rows }: { rows: AccountRow[] }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-muted" />
          <h3 className="text-sm font-semibold text-brand-ink">Saldos no período · Contas por cliente</h3>
        </div>
        <button
          type="button"
          className="rounded-xl px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-[var(--primary-10)]"
          onClick={() => window.showView("payments")}
        >
          Ver pagamentos
        </button>
      </div>
      {rows.length ? (
        <div className="flex flex-col divide-y divide-border">
          {rows.map((row) => (
            <div key={row.client.id} className="flex items-center gap-3 py-2.5 text-sm">
              <AvatarInitials name={row.client.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{row.client.name}</p>
                <p className="truncate text-xs text-muted">{row.client.priceGroup}</p>
              </div>
              <span className="hidden whitespace-nowrap text-xs text-muted sm:inline">
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
