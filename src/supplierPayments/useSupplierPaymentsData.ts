import { useEffect, useMemo, useState } from "react";

import type { Period } from "@/types/global";
import { loadSupplierPaymentHistory, loadSupplierPaymentSummary, subscribeToAppRender, type PeriodMode } from "@/supplierPayments/data";

export function useSupplierPaymentsData(
  period: Period,
  mode: PeriodMode,
  supplierId: string | null,
  search: string
) {
  const [tick, setTick] = useState(0);

  useEffect(() => subscribeToAppRender(() => setTick((value) => value + 1)), []);

  const summary = useMemo(
    () => loadSupplierPaymentSummary(period, mode, supplierId),
    [period, mode, supplierId, tick]
  );
  const history = useMemo(
    () => loadSupplierPaymentHistory({ supplierId, startDate: period.startDate, endDate: period.endDate, search }),
    [period, supplierId, search, tick]
  );

  return { summary, history };
}
