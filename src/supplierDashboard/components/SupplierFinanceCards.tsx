import { Wallet, CheckCircle2, Receipt } from "lucide-react";

import { StatCard } from "@/components/ui/stat-card";
import { money } from "@/lib/format";
import type { SupplierFinanceSnapshot } from "@/supplierDashboard/data";

export function SupplierFinanceCards({ snapshot }: { snapshot: SupplierFinanceSnapshot }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatCard
        label="Total a pagar"
        primary={money.format(snapshot.openTotal)}
        secondary={`${snapshot.openCount} conta(s) em aberto`}
        icon={Wallet}
        iconClass="bg-[var(--primary-15)] text-primary"
        highlight
        onClick={() => window.showView("suppliers")}
      />
      <StatCard
        label="Total pago"
        primary={money.format(snapshot.paidTotal)}
        secondary={`${snapshot.paidCount} conta(s) quitada(s)`}
        icon={CheckCircle2}
        iconClass="bg-emerald-500/15 text-emerald-600"
        onClick={() => window.showView("suppliers")}
      />
      <StatCard
        label="Contas no período"
        primary={snapshot.payableCount}
        secondary="Geradas neste filtro"
        icon={Receipt}
        iconClass="bg-slate-400/15 text-slate-500"
        onClick={() => window.showView("suppliers")}
      />
    </div>
  );
}
