import { Wallet, FileText, CircleDollarSign, Receipt } from "lucide-react";

import { StatCard } from "@/components/ui/stat-card";
import { money } from "@/lib/format";
import type { FinanceMetrics } from "@/types/global";

export function FinanceMetricCards({ metrics }: { metrics: FinanceMetrics }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        label="Saldo do período"
        primary={money.format(metrics.balance)}
        secondary="Serviços menos baixas deste período"
        icon={Wallet}
        iconClass="bg-[var(--primary-15)] text-primary"
        highlight
        onClick={() => window.showView("payments")}
      />
      <StatCard
        label="Serviços lançados"
        primary={money.format(metrics.servicesTotal)}
        secondary="Produção no período"
        icon={FileText}
        iconClass="bg-sky-500/15 text-sky-600"
        onClick={() => window.showView("services")}
      />
      <StatCard
        label="Pagamentos"
        primary={money.format(metrics.paymentTotal)}
        secondary="Recebimentos no período"
        icon={CircleDollarSign}
        iconClass="bg-emerald-500/15 text-emerald-600"
        onClick={() => window.showView("payments")}
      />
      <StatCard
        label="Cobranças geradas"
        primary={metrics.billings.length}
        secondary="Fechamentos no período"
        icon={Receipt}
        iconClass="bg-violet-500/15 text-violet-600"
        onClick={() => window.showView("billing")}
      />
    </div>
  );
}
