import { useEffect, useMemo, useState } from "react";

import {
  loadSupplierFinanceSnapshot,
  loadSupplierServicesSnapshot,
  subscribeToAppRender,
  type SupplierDashboardFilters
} from "@/supplierDashboard/data";

export function useSupplierDashboardData(filters: SupplierDashboardFilters) {
  const [tick, setTick] = useState(0);

  useEffect(() => subscribeToAppRender(() => setTick((value) => value + 1)), []);

  const services = useMemo(() => loadSupplierServicesSnapshot(filters), [filters, tick]);
  const finance = useMemo(() => loadSupplierFinanceSnapshot(filters), [filters, tick]);

  return { services, finance };
}
