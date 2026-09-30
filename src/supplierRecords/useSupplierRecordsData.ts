import { useEffect, useMemo, useState } from "react";

import { loadSuppliers, subscribeToAppRender, type SupplierRecordsFiltersState } from "@/supplierRecords/data";

export function useSupplierRecordsData(filters: SupplierRecordsFiltersState) {
  const [tick, setTick] = useState(0);

  useEffect(() => subscribeToAppRender(() => setTick((value) => value + 1)), []);

  return useMemo(() => loadSuppliers(filters), [filters, tick]);
}
