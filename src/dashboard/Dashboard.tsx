import { useState } from "react";
import { LayoutDashboard, ClipboardList, CircleDollarSign, Wallet } from "lucide-react";

import type { Period } from "@/types/global";
import { cn } from "@/lib/utils";
import { money } from "@/lib/format";
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

function HeroStat({
  icon: Icon,
  iconClass,
  label,
  value
}: {
  icon: typeof LayoutDashboard;
  iconClass: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-[9.5rem] items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-2.5">
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", iconClass)}>
        <Icon className="h-[18px] w-[18px]" strokeWidth={2.25} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
        <p className="truncate text-base font-bold text-ink">{value}</p>
      </div>
    </div>
  );
}

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
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-[var(--primary-15)] via-[var(--primary-10)] to-surface p-5 shadow-sm">
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[var(--primary-60)] text-primary-foreground shadow-md ring-4 ring-[var(--primary-15)]">
              <LayoutDashboard className="h-7 w-7" />
            </span>
            <div>
              <span className="text-xs font-bold uppercase tracking-wide text-muted">Visão geral</span>
              <h2 className="text-2xl font-bold text-brand-ink">Resumo do negócio</h2>
              <p className="text-sm text-muted">Acompanhe serviços e financeiro por semana, mês ou período personalizado.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <HeroStat
              icon={ClipboardList}
              iconClass="bg-sky-500/15 text-sky-600"
              label="Serviços no período"
              value={String(data.snapshot.serviceMetrics.primaryServices.length)}
            />
            <HeroStat
              icon={CircleDollarSign}
              iconClass="bg-emerald-500/15 text-emerald-600"
              label="Faturado no período"
              value={money.format(data.snapshot.financeMetrics.servicesTotal)}
            />
            <HeroStat
              icon={Wallet}
              iconClass={data.snapshot.financeMetrics.balance > 0 ? "bg-amber-500/15 text-amber-600" : "bg-emerald-500/15 text-emerald-600"}
              label="Saldo do período"
              value={money.format(data.snapshot.financeMetrics.balance)}
            />
          </div>
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
