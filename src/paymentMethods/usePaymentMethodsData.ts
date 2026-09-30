import { useEffect, useMemo, useState } from "react";

import { loadPaymentMethods, subscribeToAppRender, type PaymentMethodFiltersState } from "@/paymentMethods/data";

export function usePaymentMethodsData(filters: PaymentMethodFiltersState) {
  const [tick, setTick] = useState(0);

  useEffect(() => subscribeToAppRender(() => setTick((value) => value + 1)), []);

  return useMemo(() => loadPaymentMethods(filters), [filters, tick]);
}
