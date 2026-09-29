import { useRef, useState } from "react";
import { Wrench, PlusCircle, Tags } from "lucide-react";

import { cn } from "@/lib/utils";
import { useCatalogData } from "@/catalog/useCatalogData";
import { CatalogTable } from "@/catalog/components/CatalogTable";
import { PriceTableCard } from "@/catalog/components/PriceTableCard";

type Panel = "catalogPanel" | "priceTablesPanel";

// Fase 6: reconstrucao de "Clientes > Servicos" (vanilla renderCatalog() +
// renderPriceTables(), app.js) em React+Tailwind. Catalogo mantem <table>
// real (decisao confirmada com o usuario, ver plano Fase 6) pra preservar a
// comparacao lado a lado entre tabelas de preco; tabelas de preco viram
// cards, mesmo padrao das fases anteriores.
export function Catalog() {
  const [catalogSearch, setCatalogSearch] = useState("");
  const [priceTableSearch, setPriceTableSearch] = useState("");
  const [activePanel, setActivePanel] = useState<Panel>("catalogPanel");
  const { catalogItems, priceTableNames, priceTables } = useCatalogData(catalogSearch, priceTableSearch);

  const catalogPanelRef = useRef<HTMLElement>(null);
  const priceTablesPanelRef = useRef<HTMLElement>(null);

  const scrollToPanel = (panel: Panel) => {
    setActivePanel(panel);
    const target = panel === "catalogPanel" ? catalogPanelRef.current : priceTablesPanelRef.current;
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const switchButtons = (
    <div className="flex gap-2 rounded-xl border border-border bg-surface p-1 lg:hidden" role="tablist">
      {(
        [
          { key: "catalogPanel", label: "Ver serviços" },
          { key: "priceTablesPanel", label: "Ver tabelas" }
        ] as { key: Panel; label: string }[]
      ).map((button) => (
        <button
          key={button.key}
          type="button"
          onClick={() => scrollToPanel(button.key)}
          className={cn(
            "flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
            activePanel === button.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted hover:bg-surface-2 hover:text-ink"
          )}
        >
          {button.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-4 p-4">
      {switchButtons}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
        <section ref={catalogPanelRef} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Wrench className="h-5 w-5" />
              </span>
              <div>
                <span className="text-xs font-bold uppercase tracking-wide text-muted">Catálogo</span>
                <h2 className="text-lg font-bold text-brand-ink">Serviços</h2>
              </div>
            </div>
            <button
              type="button"
              data-dialog="catalogDialog"
              className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <PlusCircle className="h-4 w-4" />
              Adicionar serviço
            </button>
          </div>
          <p className="text-sm text-muted">
            Cadastre cada serviço e seus preços. O valor poderá ser alterado em um lançamento específico.
          </p>
          <input
            type="search"
            placeholder="Buscar nome do serviço"
            value={catalogSearch}
            onChange={(event) => setCatalogSearch(event.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-ink outline-none"
          />
          <CatalogTable items={catalogItems} priceTableNames={priceTableNames} />
        </section>

        <section ref={priceTablesPanelRef} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Tags className="h-5 w-5" />
              </span>
              <div>
                <span className="text-xs font-bold uppercase tracking-wide text-muted">Grupos de preço</span>
                <h2 className="text-lg font-bold text-brand-ink">Tabelas</h2>
              </div>
            </div>
            <button
              type="button"
              data-dialog="priceTableDialog"
              className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <PlusCircle className="h-4 w-4" />
              Adicionar tabela
            </button>
          </div>
          <input
            type="search"
            placeholder="Buscar tabela de preço"
            value={priceTableSearch}
            onChange={(event) => setPriceTableSearch(event.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-ink outline-none"
          />
          {priceTables.length ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {priceTables.map((row) => (
                <PriceTableCard key={row.name} row={row} />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-border bg-surface-2 p-6 text-center text-sm text-muted">
              Nenhum registro por aqui.
            </p>
          )}
        </section>
      </div>

      {switchButtons}
    </div>
  );
}
