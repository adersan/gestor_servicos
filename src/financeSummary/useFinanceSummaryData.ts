import { useEffect, useMemo, useState } from "react";

import {
  loadFinanceSummaryRows,
  loadFinanceSummaryTotals,
  subscribeToAppRender,
  type FinanceSummaryFilters
} from "@/financeSummary/data";

export function useFinanceSummaryData(filters: FinanceSummaryFilters) {
  const [tick, setTick] = useState(0);

  useEffect(() => subscribeToAppRender(() => setTick((value) => value + 1)), []);

  const rows = useMemo(() => loadFinanceSummaryRows(filters), [filters, tick]);
  const totals = useMemo(() => loadFinanceSummaryTotals(rows), [rows]);

  return { rows, totals };
}
