import { useState } from "react";
import { CalendarClock, CheckCircle2, PlusCircle, Wallet } from "lucide-react";

import { StatCard } from "@/components/ui/stat-card";
import { money } from "@/lib/format";
import { useSupplierPayablesData } from "@/supplierPayables/useSupplierPayablesData";
import type { SupplierPayableFiltersState } from "@/supplierPayables/data";
import { SupplierPayableFilters } from "@/supplierPayables/components/SupplierPayableFilters";
import { SupplierPayableCard } from "@/supplierPayables/components/SupplierPayableCard";

function defaultFilters(): SupplierPayableFiltersState {
  return { supplierId: "", status: "", startDate: "", endDate: "", search: "" };
}

// Fase 12 da migracao React: "Fornecedores > Contas a pagar" (vanilla
// renderPayables(), supplier.js). Mesmo perfil visual das fases anteriores.
// Historico de pagamento por conta vira accordion com estado local
// (SupplierPayableCard). Simplificacao deliberada: atalhos de
// semana/mes usam so window.currentOperationalWeek()/monthPeriod()
// localmente, sem a navegacao anterior/proximo compartilhada com outras
// telas de Financeiro (data-finance-shift).
export function SupplierPayables() {
  const [filters, setFilters] = useState<SupplierPayableFiltersState>(defaultFilters);
  const { payables, totalOpen, totalPaid, openCount } = useSupplierPayablesData(filters);

  const updateFilters = (next: Partial<SupplierPayableFiltersState>) => setFilters((current) => ({ ...current, ...next }));

  const applyWeek = () => {
    const week = window.currentOperationalWeek();
    updateFilters({ startDate: week.startDate, endDate: week.endDate });
  };
  const applyMonth = () => {
    const month = window.monthPeriod();
    updateFilters({ startDate: month.startDate, endDate: month.endDate });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={applyWeek} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink">
            <CalendarClock className="h-3.5 w-3.5" />
            Semana atual
          </button>
          <button type="button" onClick={applyMonth} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink">
            <CalendarClock className="h-3.5 w-3.5" />
            Mês atual
          </button>
        </div>
        <button
          type="button"
          data-supplier-action="payable"
          className="flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <PlusCircle className="h-4 w-4" />
          Gerar pagamento
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Total a pagar" primary={money.format(totalOpen)} secondary="Saldo atual" icon={Wallet} iconClass="bg-[var(--primary-15)] text-primary" highlight onClick={() => updateFilters({ status: "open" })} />
        <StatCard label="Total já pago" primary={money.format(totalPaid)} secondary="Histórico de baixas" icon={CheckCircle2} iconClass="bg-emerald-500/15 text-emerald-600" onClick={() => updateFilters({ status: "paid" })} />
        <StatCard label="Contas abertas" primary={openCount} secondary="Inclui parciais" icon={Wallet} iconClass="bg-amber-500/15 text-amber-600" onClick={() => updateFilters({ status: "open" })} />
      </div>

      <SupplierPayableFilters filters={filters} onChange={updateFilters} />

      {payables.length ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {payables.map((payable) => (
            <SupplierPayableCard key={payable.id} payable={payable} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">Nenhum registro por aqui.</p>
      )}
    </div>
  );
}
