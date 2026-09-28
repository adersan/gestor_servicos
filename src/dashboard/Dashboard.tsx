import { useState } from "react";
import { LayoutDashboard } from "lucide-react";

import type { Period } from "@/types/global";
import { shiftMonth, type PeriodMode } from "@/dashboard/data";
import { useDashboardData } from "@/dashboard/useDashboardData";
import { AttentionStrip } from "@/dashboard/components/AttentionStrip";
import { InnerTabs, type DashboardTab } from "@/dashboard/components/InnerTabs";
import { FinanceSummaryStrip } from "@/dashboard/components/FinanceSummaryStrip";
import { PeriodControls } from "@/dashboard/components/PeriodControls";
import { ServiceMetricCards } from "@/dashboard/components/ServiceMetricCards";
import { FinanceMetricCards } from "@/dashboard/components/FinanceMetricCards";
import { StatusBar } from "@/dashboard/components/StatusBar";
import { VolumeChart } from "@/dashboard/components/VolumeChart";
import { PaymentChart } from "@/dashboard/components/PaymentChart";
import { ClientRanking } from "@/dashboard/components/ClientRanking";
import { ServiceAlertPanel } from "@/dashboard/components/ServiceAlertPanel";
import { BillingAlertPanel } from "@/dashboard/components/BillingAlertPanel";
import { AccountList } from "@/dashboard/components/AccountList";

// Fase 1: reconstrucao do "Resumo" (dashboard vanilla, app.js renderDashboardV2)
// em React+Tailwind. Mesmos dados/metricas/destinos de navegacao de sempre, so
// o layout/visual mudou - ver escopo do redesenho no plano em
// .claude/plans/breezy-coalescing-sonnet.md.
export function Dashboard() {
  const [period, setPeriod] = useState<Period>(() => window.defaultPeriod());
  const [mode, setMode] = useState<PeriodMode>(() => window.defaultFinancePeriodMode());
  const [tab, setTab] = useState<DashboardTab>("services");

  const data = useDashboardData(period);

  const handleWeek = () => {
    setPeriod(window.currentOperationalWeek());
    setMode("week");
  };
  const handleMonth = () => {
    setPeriod(window.monthPeriod());
    setMode("month");
  };
  const handleShiftMonth = (direction: 1 | -1) => {
    setPeriod((current) => shiftMonth(current, direction));
    setMode("month");
  };
  const handleCustomDates = (startDate: string, endDate: string) => {
    if (!startDate || !endDate || endDate < startDate) return;
    setPeriod({ startDate, endDate });
    setMode("custom");
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-gradient-to-br from-[var(--primary-10)] via-surface to-surface p-5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
          <LayoutDashboard className="h-6 w-6" />
        </span>
        <div>
          <span className="text-xs font-bold uppercase tracking-wide text-muted">Visão geral</span>
          <h2 className="text-xl font-bold text-brand-ink">Resumo do negócio</h2>
          <p className="text-sm text-muted">Acompanhe serviços e financeiro por semana, mês ou período personalizado.</p>
        </div>
      </div>

      <AttentionStrip data={data.attention} />
      <InnerTabs active={tab} onChange={setTab} />
      {tab === "finance" && <FinanceSummaryStrip data={data.financeSummary} />}
      <PeriodControls
        period={period}
        mode={mode}
        onWeek={handleWeek}
        onMonth={handleMonth}
        onShiftMonth={handleShiftMonth}
        onCustomDates={handleCustomDates}
      />

      {tab === "services" ? (
        <>
          <ServiceMetricCards metrics={data.snapshot.serviceMetrics} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <StatusBar
              title="Status dos serviços"
              total={data.snapshot.serviceMetrics.primaryServices.length}
              segments={[
                { key: "pending", label: "A fazer", count: data.snapshot.serviceMetrics.pending.length, colorClass: "bg-amber-500" },
                { key: "done", label: "Feitos", count: data.snapshot.serviceMetrics.done.length, colorClass: "bg-emerald-500" },
                { key: "delivered", label: "Entregues", count: data.snapshot.serviceMetrics.delivered.length, colorClass: "bg-sky-500" }
              ]}
            />
            <VolumeChart points={data.dailyVolumes} />
          </div>
          <ClientRanking items={data.clientRanking} />
          <ServiceAlertPanel data={data.serviceAlerts} />
        </>
      ) : (
        <>
          <FinanceMetricCards metrics={data.snapshot.financeMetrics} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <PaymentChart points={data.dailyPayments} />
            <StatusBar
              title="Status das cobranças"
              total={data.billingStatusCounts.paid + data.billingStatusCounts.partial + data.billingStatusCounts.open}
              segments={[
                { key: "paid", label: "Pagas", count: data.billingStatusCounts.paid, colorClass: "bg-emerald-500" },
                { key: "partial", label: "Parciais", count: data.billingStatusCounts.partial, colorClass: "bg-amber-500" },
                { key: "open", label: "Em aberto", count: data.billingStatusCounts.open, colorClass: "bg-slate-400" }
              ]}
            />
          </div>
          <BillingAlertPanel data={data.billingAlerts} />
          <AccountList rows={data.accountRows} />
        </>
      )}
    </div>
  );
}
