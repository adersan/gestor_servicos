import { useState } from "react";
import { Sigma } from "lucide-react";

import { PeriodControls } from "@/dashboard/components/PeriodControls";
import { shiftMonth, type PeriodMode } from "@/financeSummary/data";
import { useFinanceSummaryData } from "@/financeSummary/useFinanceSummaryData";
import { FinanceSummaryFilters } from "@/financeSummary/components/FinanceSummaryFilters";
import { FinanceSummaryTotals } from "@/financeSummary/components/FinanceSummaryTotals";
import { FinanceSummaryList } from "@/financeSummary/components/FinanceSummaryList";
import type { Period } from "@/types/global";

// Fase 4: reconstrucao de "Resumo por cliente" (vanilla renderFinanceSummary(),
// app.js) em React+Tailwind - 100% leitura, sem nenhum botao de acao no card.
// Ver plano em .claude/plans/breezy-coalescing-sonnet.md, Fase 4.
export function FinanceSummary() {
  const [period, setPeriod] = useState<Period>(() => window.defaultPeriod());
  const [mode, setMode] = useState<PeriodMode>(() => window.defaultFinancePeriodMode());
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [search, setSearch] = useState("");

  const { rows, totals } = useFinanceSummaryData({
    clientId,
    startDate: period.startDate,
    endDate: period.endDate,
    search
  });

  const handleWeek = () => {
    setPeriod(window.currentOperationalWeek());
    setMode("week");
  };
  const handleMonth = () => {
    setPeriod(window.monthPeriod());
    setMode("month");
  };
  const handleShiftMonth = (direction: 1 | -1) => {
    setPeriod((current) => shiftMonth(current, direction));
    setMode("month");
  };
  const handleCustomDates = (startDate: string, endDate: string) => {
    if (!startDate || !endDate || endDate < startDate) return;
    setPeriod({ startDate, endDate });
    setMode("custom");
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-gradient-to-br from-[var(--primary-10)] via-surface to-surface p-5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
          <Sigma className="h-6 w-6" />
        </span>
        <div>
          <span className="text-xs font-bold uppercase tracking-wide text-muted">Consumo, pagamentos e saldo real</span>
          <h2 className="text-xl font-bold text-brand-ink">Resumo por cliente</h2>
        </div>
      </div>

      <p className="rounded-xl bg-surface-2 p-3 text-sm text-muted">
        Saldo em aberto acumulado de cada cliente, mesmo sem cobrança fechada — inclui serviços já lançados e
        pagamentos já registrados no período, independente do status da cobrança.
      </p>

      <PeriodControls
        period={period}
        mode={mode}
        onWeek={handleWeek}
        onMonth={handleMonth}
        onShiftMonth={handleShiftMonth}
        onCustomDates={handleCustomDates}
      />

      <FinanceSummaryTotals totals={totals} clientCount={rows.length} />

      <FinanceSummaryFilters
        clientName={clientName}
        onClientChange={(id, name) => {
          setClientId(id);
          setClientName(name);
        }}
        search={search}
        onSearchChange={setSearch}
      />

      <FinanceSummaryList rows={rows} />
    </div>
  );
}
