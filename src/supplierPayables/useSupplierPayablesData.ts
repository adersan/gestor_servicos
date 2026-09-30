import { useEffect, useMemo, useState } from "react";

import { loadSupplierPayables, subscribeToAppRender, type SupplierPayableFiltersState } from "@/supplierPayables/data";

export function useSupplierPayablesData(filters: SupplierPayableFiltersState) {
  const [tick, setTick] = useState(0);

  useEffect(() => subscribeToAppRender(() => setTick((value) => value + 1)), []);

  return useMemo(() => loadSupplierPayables(filters), [filters, tick]);
}
