import { ListChecks, Wallet, Clock, CheckCircle2, Banknote } from "lucide-react";

import { StatCard } from "@/components/ui/stat-card";
import { money } from "@/lib/format";
import type { SupplierServicesSnapshot } from "@/supplierDashboard/data";

// Simplificacao deliberada: o card "Total a pagar" do vanilla usa
// data-supplier-tab-shortcut="payables" pra abrir direto na aba Contas a
// pagar - window.showView so troca de secao (Fornecedores), sem escolher a
// sub-aba. Mesmo destino final (Fornecedores), sem o atalho fino.
export function SupplierServiceCards({ snapshot }: { snapshot: SupplierServicesSnapshot }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <StatCard
        label="Serviços no período"
        primary={snapshot.entries.length}
        secondary="Custos registrados"
        icon={ListChecks}
        iconClass="bg-violet-500/15 text-violet-600"
        onClick={() => window.showView("suppliers")}
      />
      <StatCard
        label="Custo no período"
        primary={money.format(snapshot.total)}
        secondary="Antes das baixas"
        icon={Banknote}
        iconClass="bg-slate-400/15 text-slate-500"
        onClick={() => window.showView("suppliers")}
      />
      <StatCard
        label="A fazer"
        primary={snapshot.pendingCount}
        secondary={`${money.format(snapshot.pendingTotal)} em produção`}
        icon={Clock}
        iconClass="bg-amber-500/15 text-amber-600"
        onClick={() => window.showView("suppliers")}
      />
      <StatCard
        label="Feitos"
        primary={snapshot.doneCount}
        secondary={`${money.format(snapshot.doneTotal)} concluídos`}
        icon={CheckCircle2}
        iconClass="bg-emerald-500/15 text-emerald-600"
        onClick={() => window.showView("suppliers")}
      />
      <StatCard
        label="Total a pagar"
        primary={money.format(snapshot.payableOpenTotal)}
        secondary="Contas abertas e parciais"
        icon={Wallet}
        iconClass="bg-[var(--primary-15)] text-primary"
        highlight
        onClick={() => window.showView("suppliers")}
      />
    </div>
  );
}
