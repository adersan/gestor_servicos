import { useEffect, useMemo, useState } from "react";

import { loadCatalogItems, loadPriceTableNames, loadPriceTables, subscribeToAppRender } from "@/catalog/data";

export function useCatalogData(catalogSearch: string, priceTableSearch: string) {
  const [tick, setTick] = useState(0);

  useEffect(() => subscribeToAppRender(() => setTick((value) => value + 1)), []);

  const catalogItems = useMemo(() => loadCatalogItems(catalogSearch), [catalogSearch, tick]);
  const priceTableNames = useMemo(() => loadPriceTableNames(), [tick]);
  const priceTables = useMemo(() => loadPriceTables(priceTableSearch), [priceTableSearch, tick]);

  return { catalogItems, priceTableNames, priceTables };
}
