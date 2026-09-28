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
  subscribeToAppRender
} from "@/dashboard/data";

// Centraliza toda a leitura de dados do Dashboard num unico hook: qualquer
// mudanca em app.js (evento "gestor:render") ou no periodo selecionado
// recalcula tudo de uma vez, mantendo os componentes de apresentacao puros.
export function useDashboardData(period: Period) {
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

  return {
    snapshot,
    attention,
    financeSummary,
    clientRanking,
    serviceAlerts,
    dailyVolumes,
    dailyPayments,
    billingStatusCounts,
    billingAlerts,
    accountRows
  };
}
