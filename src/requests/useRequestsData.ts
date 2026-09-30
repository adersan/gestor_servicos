import { useEffect, useMemo, useState } from "react";

import { loadRequests, subscribeToAppRender, type RequestFiltersState } from "@/requests/data";

export function useRequestsData(filters: RequestFiltersState) {
  const [tick, setTick] = useState(0);

  useEffect(() => subscribeToAppRender(() => setTick((value) => value + 1)), []);

  return useMemo(() => loadRequests(filters), [filters, tick]);
}
