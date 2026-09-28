import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { money } from "@/lib/format";
import type { ServiceMetrics } from "@/types/global";

function MetricCard({
  label,
  count,
  amount,
  accent,
  onClick
}: {
  label: string;
  count: number;
  amount: number;
  accent?: string;
  onClick: () => void;
}) {
  return (
    <Card
      role="button"
      onClick={onClick}
      className={`cursor-pointer transition-shadow hover:shadow-md ${accent ?? ""}`}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-muted">{label}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-2xl font-bold text-ink">{count}</p>
        <p className="text-xs text-muted">{money.format(amount)}</p>
      </CardContent>
    </Card>
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
        onClick={() => window.showView("services")}
      />
      <MetricCard
        label="Feitos"
        count={metrics.done.length}
        amount={doneTotal}
        onClick={() => window.showView("services")}
      />
      <MetricCard
        label="Entregues"
        count={metrics.delivered.length}
        amount={deliveredTotal}
        onClick={() => window.showView("services")}
      />
      <MetricCard
        label="Serviços fornecedores"
        count={metrics.supplierEntries.length}
        amount={metrics.supplierTotal}
        onClick={() => window.showView("suppliers")}
      />
      <MetricCard
        label="Total de serviços"
        count={metrics.primaryServices.length}
        amount={metrics.primaryTotal}
        accent="border-primary"
        onClick={() => window.showView("services")}
      />
    </div>
  );
}
