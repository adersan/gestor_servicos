import type { LucideIcon } from "lucide-react";
import { Wallet, FileText, CircleDollarSign, Receipt } from "lucide-react";

import { money } from "@/lib/format";
import type { FinanceMetrics } from "@/types/global";

function Card({
  label,
  value,
  hint,
  icon: Icon,
  iconClass,
  highlight,
  onClick
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  iconClass: string;
  highlight?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex flex-col gap-3 rounded-2xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
        highlight
          ? "border-[var(--primary-40)] bg-gradient-to-br from-[var(--primary-10)] via-surface to-surface"
          : "border-border bg-surface"
      }`}
    >
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconClass}`}>
        <Icon className="h-5 w-5" strokeWidth={2.25} />
      </span>
      <div>
        <p className="text-sm font-medium text-muted">{label}</p>
        <p className="text-2xl font-bold tracking-tight text-ink">{value}</p>
        <p className="text-xs text-muted">{hint}</p>
      </div>
    </button>
  );
}

export function FinanceMetricCards({ metrics }: { metrics: FinanceMetrics }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card
        label="Saldo do período"
        value={money.format(metrics.balance)}
        hint="Serviços menos baixas deste período"
        icon={Wallet}
        iconClass="bg-[var(--primary-15)] text-primary"
        highlight
        onClick={() => window.showView("payments")}
      />
      <Card
        label="Serviços lançados"
        value={money.format(metrics.servicesTotal)}
        hint="Produção no período"
        icon={FileText}
        iconClass="bg-sky-500/15 text-sky-600"
        onClick={() => window.showView("services")}
      />
      <Card
        label="Pagamentos"
        value={money.format(metrics.paymentTotal)}
        hint="Recebimentos no período"
        icon={CircleDollarSign}
        iconClass="bg-emerald-500/15 text-emerald-600"
        onClick={() => window.showView("payments")}
      />
      <Card
        label="Cobranças geradas"
        value={String(metrics.billings.length)}
        hint="Fechamentos no período"
        icon={Receipt}
        iconClass="bg-violet-500/15 text-violet-600"
        onClick={() => window.showView("billing")}
      />
    </div>
  );
}
