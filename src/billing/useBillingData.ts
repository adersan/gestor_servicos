import { useEffect, useMemo, useState } from "react";

import {
  loadAccessBillingIdByClient,
  loadBillingList,
  loadOverdueCount,
  subscribeToAppRender,
  type BillingFilters
} from "@/billing/data";

export function useBillingData(filters: BillingFilters) {
  const [tick, setTick] = useState(0);

  useEffect(() => subscribeToAppRender(() => setTick((value) => value + 1)), []);

  const items = useMemo(() => loadBillingList(filters), [filters, tick]);
  const overdueCount = useMemo(() => loadOverdueCount(), [tick]);
  const accessBillingByClient = useMemo(() => loadAccessBillingIdByClient(), [tick]);

  return { items, overdueCount, accessBillingByClient };
}
