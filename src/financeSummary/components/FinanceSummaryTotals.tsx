import { History, FileText, CircleDollarSign, Wallet } from "lucide-react";

import { StatCard } from "@/components/ui/stat-card";
import { money } from "@/lib/format";
import type { FinanceSummaryTotals as Totals } from "@/financeSummary/data";

export function FinanceSummaryTotals({ totals, clientCount }: { totals: Totals; clientCount: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        label="Cobrança anterior"
        primary={money.format(totals.previous)}
        secondary="Saldo de antes do período"
        icon={History}
        iconClass="bg-slate-400/15 text-slate-500"
        onClick={() => window.showView("financeSummary")}
      />
      <StatCard
        label="Consumo do período"
        primary={money.format(totals.services)}
        secondary={`${clientCount} cliente(s)`}
        icon={FileText}
        iconClass="bg-sky-500/15 text-sky-600"
        onClick={() => window.showView("services")}
      />
      <StatCard
        label="Pago no período"
        primary={money.format(totals.payments)}
        icon={CircleDollarSign}
        iconClass="bg-emerald-500/15 text-emerald-600"
        onClick={() => window.showView("payments")}
      />
      <StatCard
        label="Saldo em aberto acumulado"
        primary={money.format(totals.open)}
        icon={Wallet}
        iconClass="bg-[var(--primary-15)] text-primary"
        highlight
        onClick={() => window.showView("billing")}
      />
    </div>
  );
}
