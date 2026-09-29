import { useState } from "react";
import { Receipt, AlertTriangle, FilePlus, Layers } from "lucide-react";

import { PeriodControls } from "@/dashboard/components/PeriodControls";
import { shiftMonth, type BillingStatusFilter, type PeriodMode } from "@/billing/data";
import { useBillingData } from "@/billing/useBillingData";
import { BillingFilters } from "@/billing/components/BillingFilters";
import { BillingCard } from "@/billing/components/BillingCard";
import type { Period } from "@/types/global";

// Fase 3: reconstrucao de "Cobrancas" (vanilla renderBillings(), app.js) em
// React+Tailwind, card completo com todos os botoes de acao reais (ver plano
// em .claude/plans/breezy-coalescing-sonnet.md, secao "Fase 3").
export function Billing() {
  const [period, setPeriod] = useState<Period>(() => window.defaultPeriod());
  const [mode, setMode] = useState<PeriodMode>(() => window.defaultFinancePeriodMode());
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [status, setStatus] = useState<BillingStatusFilter>("");
  const [search, setSearch] = useState("");

  const { items, overdueCount, accessBillingByClient } = useBillingData({
    clientId,
    startDate: period.startDate,
    endDate: period.endDate,
    status,
    search,
    overdueOnly
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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-gradient-to-br from-[var(--primary-10)] via-surface to-surface p-5">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Receipt className="h-6 w-6" />
          </span>
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-muted">Fechamento flexível</span>
            <h2 className="text-xl font-bold text-brand-ink">Cobranças</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-dialog="billingBatchDialog"
            className="flex h-9 items-center gap-1.5 rounded-xl border border-border bg-surface px-3 text-sm font-semibold text-ink transition-colors hover:bg-surface-2"
          >
            <Layers className="h-4 w-4" />
            Gerar todas
          </button>
          <button
            type="button"
            data-dialog="billingDialog"
            className="flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <FilePlus className="h-4 w-4" />
            Gerar cobrança
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOverdueOnly((value) => !value)}
        className={`flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
          overdueOnly ? "border-danger bg-danger/10 text-danger" : "border-border bg-surface text-ink"
        }`}
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        Atrasadas ({overdueCount})
      </button>

      {!overdueOnly && (
        <PeriodControls
          period={period}
          mode={mode}
          onWeek={handleWeek}
          onMonth={handleMonth}
          onShiftMonth={handleShiftMonth}
          onCustomDates={handleCustomDates}
        />
      )}

      <BillingFilters
        clientName={clientName}
        onClientChange={(id, name) => {
          setClientId(id);
          setClientName(name);
        }}
        status={status}
        onStatusChange={setStatus}
        search={search}
        onSearchChange={setSearch}
        showStatus={!overdueOnly}
      />

      {items.length ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {items.map((item) => (
            <BillingCard key={item.id} item={item} isAccessOwner={accessBillingByClient.get(item.clientId) === item.id} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
          Nenhum registro por aqui.
        </p>
      )}
    </div>
  );
}
