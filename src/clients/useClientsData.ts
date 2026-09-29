import { useEffect, useMemo, useState } from "react";

import { loadClientList, subscribeToAppRender } from "@/clients/data";

export function useClientsData(search: string) {
  const [tick, setTick] = useState(0);

  useEffect(() => subscribeToAppRender(() => setTick((value) => value + 1)), []);

  const rows = useMemo(() => loadClientList(search), [search, tick]);

  return { rows };
}
