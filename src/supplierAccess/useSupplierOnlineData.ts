import { useEffect, useMemo, useState } from "react";

import { loadSupplierOnlineEntries, subscribeToAppRender, type SupplierOnlineFiltersState } from "@/supplierAccess/data";

export function useSupplierOnlineData(filters: SupplierOnlineFiltersState) {
  const [tick, setTick] = useState(0);

  useEffect(() => subscribeToAppRender(() => setTick((value) => value + 1)), []);

  return useMemo(() => loadSupplierOnlineEntries(filters), [filters, tick]);
}
