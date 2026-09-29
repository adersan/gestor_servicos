import { useEffect, useMemo, useState } from "react";

import type { Period } from "@/types/global";
import { loadPaymentHistory, loadPaymentSummary, subscribeToAppRender, type PeriodMode } from "@/payments/data";

export function usePaymentsData(
  period: Period,
  mode: PeriodMode,
  clientId: string | null,
  search: string
) {
  const [tick, setTick] = useState(0);

  useEffect(() => subscribeToAppRender(() => setTick((value) => value + 1)), []);

  const summary = useMemo(
    () => loadPaymentSummary(period, mode, clientId),
    [period, mode, clientId, tick]
  );
  const history = useMemo(
    () => loadPaymentHistory({ clientId, startDate: period.startDate, endDate: period.endDate, search }),
    [period, clientId, search, tick]
  );

  return { summary, history };
}
