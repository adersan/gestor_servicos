import { History, CalendarCheck, PiggyBank } from "lucide-react";

import { StatCard } from "@/components/ui/stat-card";
import { money } from "@/lib/format";
import type { SupplierPaymentSummary } from "@/supplierPayments/data";

export function SupplierPaymentSummaryCards({ summary, supplierName }: { summary: SupplierPaymentSummary; supplierName?: string }) {
  const suffix = supplierName ? ` · ${supplierName}` : "";
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatCard
        label="Pago no período anterior"
        primary={money.format(summary.previousTotal)}
        secondary={`${summary.previousLabel}${suffix}`}
        icon={History}
        iconClass="bg-slate-400/15 text-slate-500"
        onClick={() => window.showView("suppliers")}
      />
      <StatCard
        label="Pago hoje"
        primary={money.format(summary.todayTotal)}
        secondary={`${summary.todayLabel}${suffix}`}
        icon={CalendarCheck}
        iconClass="bg-sky-500/15 text-sky-600"
        onClick={() => window.showView("suppliers")}
      />
      <StatCard
        label="Pago no período"
        primary={money.format(summary.currentTotal)}
        secondary={`${summary.currentLabel}${suffix}`}
        icon={PiggyBank}
        iconClass="bg-[var(--primary-15)] text-primary"
        highlight
        onClick={() => window.showView("suppliers")}
      />
    </div>
  );
}
