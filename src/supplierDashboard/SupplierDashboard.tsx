import { useState } from "react";
import { LayoutDashboard } from "lucide-react";

import { StatusBar } from "@/dashboard/components/StatusBar";
import { useSupplierDashboardData } from "@/supplierDashboard/useSupplierDashboardData";
import type { SupplierDashboardFilters as Filters } from "@/supplierDashboard/data";
import { SupplierDashboardTabs, type SupplierDashboardTab } from "@/supplierDashboard/components/SupplierDashboardTabs";
import { SupplierDashboardFilters } from "@/supplierDashboard/components/SupplierDashboardFilters";
import { SupplierServiceCards } from "@/supplierDashboard/components/SupplierServiceCards";
import { SupplierServiceRanking } from "@/supplierDashboard/components/SupplierServiceRanking";
import { SupplierFinanceCards } from "@/supplierDashboard/components/SupplierFinanceCards";
import { SupplierFinanceRanking } from "@/supplierDashboard/components/SupplierFinanceRanking";

function defaultFilters(): Filters {
  const week = window.currentOperationalWeek();
  return { supplierId: "", startDate: week.startDate, endDate: week.endDate };
}

// Fase 14 da migracao React (ultima do Fornecedor): "Fornecedores > Painel"
// (vanilla renderDashboard()/renderDashboardFinance(), supplier.js). Espelha
// a Fase 1 (Resumo geral): mesmas abas internas (Servicos/Financeiro),
// mesmo padrao de cards+ranking. Simplificacao deliberada: so atalhos de
// semana/mes (igual o vanilla, que tambem nao tem navegacao
// anterior/proximo nesta tela - so nas datas livres).
export function SupplierDashboard() {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [tab, setTab] = useState<SupplierDashboardTab>("services");
  const { services, finance } = useSupplierDashboardData(filters);

  const updateFilters = (next: Partial<Filters>) => setFilters((current) => ({ ...current, ...next }));
  const handleWeek = () => {
    const week = window.currentOperationalWeek();
    updateFilters({ startDate: week.startDate, endDate: week.endDate });
  };
  const handleMonth = () => {
    const month = window.monthPeriod();
    updateFilters({ startDate: month.startDate, endDate: month.endDate });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-gradient-to-br from-[var(--primary-10)] via-surface to-surface p-5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
          <LayoutDashboard className="h-6 w-6" />
        </span>
        <div>
          <span className="text-xs font-bold uppercase tracking-wide text-muted">Visão geral</span>
          <h2 className="text-xl font-bold text-brand-ink">Painel de fornecedores</h2>
        </div>
      </div>

      <SupplierDashboardTabs active={tab} onChange={setTab} />

      <SupplierDashboardFilters filters={filters} onChange={updateFilters} onWeek={handleWeek} onMonth={handleMonth} />

      {tab === "services" ? (
        <>
          <SupplierServiceCards snapshot={services} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SupplierServiceRanking items={services.ranking} />
            <StatusBar
              title="Situação dos serviços"
              total={services.pendingCount + services.doneCount}
              segments={[
                { key: "pending", label: "A fazer", count: services.pendingCount, colorClass: "bg-amber-500" },
                { key: "done", label: "Feitos", count: services.doneCount, colorClass: "bg-emerald-500" }
              ]}
            />
          </div>
        </>
      ) : (
        <>
          <SupplierFinanceCards snapshot={finance} />
          <SupplierFinanceRanking items={finance.ranking} />
        </>
      )}
    </div>
  );
}
