import { useEffect, useMemo, useState } from "react";

import { loadServiceGroups, subscribeToAppRender, type ServiceFiltersState } from "@/services/data";

export function useServicesData(filters: ServiceFiltersState) {
  const [tick, setTick] = useState(0);

  useEffect(() => subscribeToAppRender(() => setTick((value) => value + 1)), []);

  const result = useMemo(() => loadServiceGroups(filters), [filters, tick]);

  // Mantem serviceGroupsById (app.js) sincronizado com o que a tela React
  // esta mostrando - openServiceQuickView e a aplicacao de status em massa
  // leem esse Map compartilhado. Ver plano, Fase 7.
  useEffect(() => {
    window.serviceGroupsById.clear();
    result.groups.forEach((group) => window.serviceGroupsById.set(group.primary.id, group));
  }, [result]);

  return result;
}
