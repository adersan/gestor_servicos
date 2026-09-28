import type { LucideIcon } from "lucide-react";
import { Clock, CheckCircle2, PackageCheck, Truck, TrendingUp } from "lucide-react";

import { money } from "@/lib/format";
import type { ServiceMetrics } from "@/types/global";

function MetricCard({
  label,
  count,
  amount,
  icon: Icon,
  iconClass,
  highlight,
  onClick
}: {
  label: string;
  count: number;
  amount: number;
  icon: LucideIcon;
  iconClass: string;
  highlight?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex flex-col gap-3 overflow-hidden rounded-2xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
        highlight
          ? "border-[var(--primary-40)] bg-gradient-to-br from-[var(--primary-10)] via-surface to-surface"
          : "border-border bg-surface"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconClass}`}>
          <Icon className="h-5 w-5" strokeWidth={2.25} />
        </span>
        <TrendingUp className="h-4 w-4 text-muted opacity-0 transition-opacity group-hover:opacity-60" />
      </div>
      <div>
        <p className="text-sm font-medium text-muted">{label}</p>
        <p className="text-3xl font-bold tracking-tight text-ink">{count}</p>
        <p className="text-xs text-muted">{money.format(amount)}</p>
      </div>
    </button>
  );
}

export function ServiceMetricCards({ metrics }: { metrics: ServiceMetrics }) {
  const pendingTotal = metrics.pending.reduce((sum, item) => sum + Number(item.amount), 0);
  const doneTotal = metrics.done.reduce((sum, item) => sum + Number(item.amount), 0);
  const deliveredTotal = metrics.delivered.reduce((sum, item) => sum + Number(item.amount), 0);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <MetricCard
        label="A fazer"
        count={metrics.pending.length}
        amount={pendingTotal}
        icon={Clock}
        iconClass="bg-amber-500/15 text-amber-600"
        onClick={() => window.showView("services")}
      />
      <MetricCard
        label="Feitos"
        count={metrics.done.length}
        amount={doneTotal}
        icon={CheckCircle2}
        iconClass="bg-emerald-500/15 text-emerald-600"
        onClick={() => window.showView("services")}
      />
      <MetricCard
        label="Entregues"
        count={metrics.delivered.length}
        amount={deliveredTotal}
        icon={PackageCheck}
        iconClass="bg-sky-500/15 text-sky-600"
        onClick={() => window.showView("services")}
      />
      <MetricCard
        label="Serviços fornecedores"
        count={metrics.supplierEntries.length}
        amount={metrics.supplierTotal}
        icon={Truck}
        iconClass="bg-violet-500/15 text-violet-600"
        onClick={() => window.showView("suppliers")}
      />
      <MetricCard
        label="Total de serviços"
        count={metrics.primaryServices.length}
        amount={metrics.primaryTotal}
        icon={TrendingUp}
        iconClass="bg-[var(--primary-15)] text-primary"
        highlight
        onClick={() => window.showView("services")}
      />
    </div>
  );
}
