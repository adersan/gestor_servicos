import { useState } from "react";
import { Wallet, Plus } from "lucide-react";

import { PeriodControls } from "@/dashboard/components/PeriodControls";
import { shiftMonth, type PeriodMode } from "@/supplierPayments/data";
import { useSupplierPaymentsData } from "@/supplierPayments/useSupplierPaymentsData";
import { SupplierPaymentSummaryCards } from "@/supplierPayments/components/SupplierPaymentSummaryCards";
import { SupplierPaymentFilters } from "@/supplierPayments/components/SupplierPaymentFilters";
import { SupplierPaymentHistoryList } from "@/supplierPayments/components/SupplierPaymentHistoryList";
import type { Period } from "@/types/global";

// Fase 13 da migracao React: "Fornecedores > Pagamento" (vanilla
// renderSupplierPayments(), supplier.js). Espelha 1:1 a fase 2 (Pagamentos do
// Financeiro, src/payments/): mesmos 3 cards "Pago", mesma lista com
// selecao-de-linha-vira-clique-unico que ja abre o modal de detalhes
// vanilla real (window.supplierModule.openSupplierPaymentDetail). Registrar
// pagamento continua no modal vanilla de sempre (data-supplier-action,
// mesmo listener generico ja existente em supplier.js).
export function SupplierPayments() {
  const [period, setPeriod] = useState<Period>(() => window.defaultPeriod());
  const [mode, setMode] = useState<PeriodMode>(() => window.defaultFinancePeriodMode());
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [supplierName, setSupplierName] = useState("");
  const [search, setSearch] = useState("");

  const { summary, history } = useSupplierPaymentsData(period, mode, supplierId, search);

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
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-gradient-to-br from-[var(--primary-10)] via-surface to-surface p-5">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Wallet className="h-6 w-6" />
          </span>
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-muted">Baixas</span>
            <h2 className="text-xl font-bold text-brand-ink">Pagamento</h2>
          </div>
        </div>
        <button
          type="button"
          data-supplier-action="advancePayment"
          className="flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Registrar pagamento
        </button>
      </div>

      <SupplierPaymentSummaryCards summary={summary} supplierName={supplierName || undefined} />

      <PeriodControls
        period={period}
        mode={mode}
        onWeek={handleWeek}
        onMonth={handleMonth}
        onShiftMonth={handleShiftMonth}
        onCustomDates={handleCustomDates}
      />

      <SupplierPaymentFilters
        supplierName={supplierName}
        onSupplierChange={(id, name) => {
          setSupplierId(id);
          setSupplierName(name);
        }}
        search={search}
        onSearchChange={setSearch}
      />

      <SupplierPaymentHistoryList payments={history} />
    </div>
  );
}
