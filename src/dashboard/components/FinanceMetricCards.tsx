import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { money } from "@/lib/format";
import type { FinanceMetrics } from "@/types/global";

export function FinanceMetricCards({ metrics }: { metrics: FinanceMetrics }) {
  const cards = [
    {
      label: "Saldo do período",
      value: money.format(metrics.balance),
      hint: "Serviços menos baixas deste período",
      onClick: () => window.showView("payments"),
      accent: "border-primary"
    },
    {
      label: "Serviços lançados",
      value: money.format(metrics.servicesTotal),
      hint: "Produção no período",
      onClick: () => window.showView("services")
    },
    {
      label: "Pagamentos",
      value: money.format(metrics.paymentTotal),
      hint: "Recebimentos no período",
      onClick: () => window.showView("payments")
    },
    {
      label: "Cobranças geradas",
      value: String(metrics.billings.length),
      hint: "Fechamentos no período",
      onClick: () => window.showView("billing")
    }
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <Card
          key={card.label}
          role="button"
          onClick={card.onClick}
          className={`cursor-pointer transition-shadow hover:shadow-md ${card.accent ?? ""}`}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted">{card.label}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-bold text-ink">{card.value}</p>
            <p className="text-xs text-muted">{card.hint}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
