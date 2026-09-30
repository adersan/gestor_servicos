import { useEffect, useMemo, useState } from "react";

import { loadSupplierEntries, subscribeToAppRender, type SupplierEntryFiltersState } from "@/supplierEntries/data";

export function useSupplierEntriesData(filters: SupplierEntryFiltersState) {
  const [tick, setTick] = useState(0);

  useEffect(() => subscribeToAppRender(() => setTick((value) => value + 1)), []);

  return useMemo(() => loadSupplierEntries(filters), [filters, tick]);
}
