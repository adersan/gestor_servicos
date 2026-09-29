import { useState } from "react";
import { Wallet, Plus, Link2 } from "lucide-react";

import { PeriodControls } from "@/dashboard/components/PeriodControls";
import { shiftMonth, type PeriodMode } from "@/payments/data";
import { usePaymentsData } from "@/payments/usePaymentsData";
import { PaymentSummaryCards } from "@/payments/components/PaymentSummaryCards";
import { PaymentFilters } from "@/payments/components/PaymentFilters";
import { PaymentHistoryList } from "@/payments/components/PaymentHistoryList";
import type { Period } from "@/types/global";

// Fase 2: reconstrucao de "Pagamentos" (vanilla renderPayments(), app.js) em
// React+Tailwind, so leitura - registrar/editar/excluir continuam nos modais
// vanilla de sempre (botoes abaixo so acionam data-dialog="...", igual o
// listener generico ja existente). Ver plano em
// .claude/plans/breezy-coalescing-sonnet.md.
export function Payments() {
  const [period, setPeriod] = useState<Period>(() => window.defaultPeriod());
  const [mode, setMode] = useState<PeriodMode>(() => window.defaultFinancePeriodMode());
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [search, setSearch] = useState("");

  const { summary, history } = usePaymentsData(period, mode, clientId, search);

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
            <Wallet className="h-6 w-6" />
          </span>
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-muted">Baixas</span>
            <h2 className="text-xl font-bold text-brand-ink">Pagamentos</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-dialog="paymentLinkDialog"
            className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-semibold text-ink transition-colors hover:bg-surface-2"
          >
            <Link2 className="h-4 w-4" />
            Link de pagamento
          </button>
          <button
            type="button"
            data-dialog="paymentDialog"
            className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Registrar pagamento
          </button>
        </div>
      </div>

      <PaymentSummaryCards summary={summary} clientName={clientName || undefined} />

      <PeriodControls
        period={period}
        mode={mode}
        onWeek={handleWeek}
        onMonth={handleMonth}
        onShiftMonth={handleShiftMonth}
        onCustomDates={handleCustomDates}
      />

      <PaymentFilters
        clientName={clientName}
        onClientChange={(id, name) => {
          setClientId(id);
          setClientName(name);
        }}
        search={search}
        onSearchChange={setSearch}
      />

      <PaymentHistoryList payments={history} />
    </div>
  );
}
