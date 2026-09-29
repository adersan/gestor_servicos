import { Clock, CheckCircle2, PackageCheck, Truck, TrendingUp } from "lucide-react";

import { StatCard } from "@/components/ui/stat-card";
import { money } from "@/lib/format";
import type { ServiceMetrics } from "@/types/global";

export function ServiceMetricCards({ metrics }: { metrics: ServiceMetrics }) {
  const pendingTotal = metrics.pending.reduce((sum, item) => sum + Number(item.amount), 0);
  const doneTotal = metrics.done.reduce((sum, item) => sum + Number(item.amount), 0);
  const deliveredTotal = metrics.delivered.reduce((sum, item) => sum + Number(item.amount), 0);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <StatCard
        label="A fazer"
        primary={metrics.pending.length}
        secondary={money.format(pendingTotal)}
        icon={Clock}
        iconClass="bg-amber-500/15 text-amber-600"
        size="lg"
        showTrendIcon
        onClick={() => window.showView("services")}
      />
      <StatCard
        label="Feitos"
        primary={metrics.done.length}
        secondary={money.format(doneTotal)}
        icon={CheckCircle2}
        iconClass="bg-emerald-500/15 text-emerald-600"
        size="lg"
        showTrendIcon
        onClick={() => window.showView("services")}
      />
      <StatCard
        label="Entregues"
        primary={metrics.delivered.length}
        secondary={money.format(deliveredTotal)}
        icon={PackageCheck}
        iconClass="bg-sky-500/15 text-sky-600"
        size="lg"
        showTrendIcon
        onClick={() => window.showView("services")}
      />
      <StatCard
        label="Serviços fornecedores"
        primary={metrics.supplierEntries.length}
        secondary={money.format(metrics.supplierTotal)}
        icon={Truck}
        iconClass="bg-violet-500/15 text-violet-600"
        size="lg"
        showTrendIcon
        onClick={() => window.showView("suppliers")}
      />
      <StatCard
        label="Total de serviços"
        primary={metrics.primaryServices.length}
        secondary={money.format(metrics.primaryTotal)}
        icon={TrendingUp}
        iconClass="bg-[var(--primary-15)] text-primary"
        size="lg"
        showTrendIcon
        highlight
        onClick={() => window.showView("services")}
      />
    </div>
  );
}
