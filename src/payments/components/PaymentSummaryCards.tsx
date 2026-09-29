import { History, CalendarCheck, PiggyBank } from "lucide-react";

import { StatCard } from "@/components/ui/stat-card";
import { money } from "@/lib/format";
import type { PaymentSummary } from "@/payments/data";

export function PaymentSummaryCards({ summary, clientName }: { summary: PaymentSummary; clientName?: string }) {
  const suffix = clientName ? ` · ${clientName}` : "";
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatCard
        label="Recebido no período anterior"
        primary={money.format(summary.previousTotal)}
        secondary={`${summary.previousLabel}${suffix}`}
        icon={History}
        iconClass="bg-slate-400/15 text-slate-500"
        onClick={() => window.showView("payments")}
      />
      <StatCard
        label="Recebido hoje"
        primary={money.format(summary.todayTotal)}
        secondary={`${summary.todayLabel}${suffix}`}
        icon={CalendarCheck}
        iconClass="bg-sky-500/15 text-sky-600"
        onClick={() => window.showView("payments")}
      />
      <StatCard
        label="Recebido no período"
        primary={money.format(summary.currentTotal)}
        secondary={`${summary.currentLabel}${suffix}`}
        icon={PiggyBank}
        iconClass="bg-[var(--primary-15)] text-primary"
        highlight
        onClick={() => window.showView("payments")}
      />
    </div>
  );
}
