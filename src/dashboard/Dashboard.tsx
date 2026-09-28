import { useEffect, useMemo, useState } from "react";

import type { Period } from "@/types/global";
import {
  loadAccountList,
  loadAttentionData,
  loadBillingAlerts,
  loadBillingStatusCounts,
  loadClientRanking,
  loadDailyPayments,
  loadDailyVolumes,
  loadDashboardSnapshot,
  loadFinanceSummary,
  loadServiceAlerts,
  shiftMonth,
  subscribeToAppRender,
  type PeriodMode
} from "@/dashboard/data";
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
  const [tick, setTick] = useState(0);

  useEffect(() => subscribeToAppRender(() => setTick((value) => value + 1)), []);

  const snapshot = useMemo(() => loadDashboardSnapshot(period), [period, tick]);
  const attention = useMemo(() => loadAttentionData(), [tick]);
  const financeSummary = useMemo(() => loadFinanceSummary(), [tick]);
  const clientRanking = useMemo(() => loadClientRanking(snapshot.serviceMetrics), [snapshot]);
  const serviceAlerts = useMemo(() => loadServiceAlerts(), [tick]);
  const dailyVolumes = useMemo(() => loadDailyVolumes(period, snapshot.serviceMetrics), [period, snapshot]);
  const dailyPayments = useMemo(() => loadDailyPayments(period), [period, tick]);
  const billingStatusCounts = useMemo(() => loadBillingStatusCounts(period), [period, tick]);
  const billingAlerts = useMemo(() => loadBillingAlerts(), [tick]);
  const accountRows = useMemo(() => loadAccountList(period, snapshot.serviceMetrics), [period, snapshot]);

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
      <div className="rounded-xl border border-border bg-surface p-4">
        <span className="text-xs font-bold uppercase tracking-wide text-muted">Visão geral</span>
        <h2 className="text-xl font-bold text-brand-ink">Resumo do negócio</h2>
        <p className="text-sm text-muted">Acompanhe serviços e financeiro por semana, mês ou período personalizado.</p>
      </div>

      <AttentionStrip data={attention} />
      <InnerTabs active={tab} onChange={setTab} />
      {tab === "finance" && <FinanceSummaryStrip data={financeSummary} />}
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
          <ServiceMetricCards metrics={snapshot.serviceMetrics} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <StatusBar
              title="Status dos serviços"
              total={snapshot.serviceMetrics.primaryServices.length}
              segments={[
                { key: "pending", label: "A fazer", count: snapshot.serviceMetrics.pending.length, colorClass: "bg-amber-500" },
                { key: "done", label: "Feitos", count: snapshot.serviceMetrics.done.length, colorClass: "bg-emerald-500" },
                { key: "delivered", label: "Entregues", count: snapshot.serviceMetrics.delivered.length, colorClass: "bg-sky-500" }
              ]}
            />
            <VolumeChart points={dailyVolumes} />
          </div>
          <ClientRanking items={clientRanking} />
          <ServiceAlertPanel data={serviceAlerts} />
        </>
      ) : (
        <>
          <FinanceMetricCards metrics={snapshot.financeMetrics} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <PaymentChart points={dailyPayments} />
            <StatusBar
              title="Status das cobranças"
              total={billingStatusCounts.paid + billingStatusCounts.partial + billingStatusCounts.open}
              segments={[
                { key: "paid", label: "Pagas", count: billingStatusCounts.paid, colorClass: "bg-emerald-500" },
                { key: "partial", label: "Parciais", count: billingStatusCounts.partial, colorClass: "bg-amber-500" },
                { key: "open", label: "Em aberto", count: billingStatusCounts.open, colorClass: "bg-slate-400" }
              ]}
            />
          </div>
          <BillingAlertPanel data={billingAlerts} />
          <AccountList rows={accountRows} />
        </>
      )}
    </div>
  );
}
