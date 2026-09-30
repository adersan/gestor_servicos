import type { SupplierPayment } from "@/types/global";

const TONE: Record<string, string> = {
  credit: "bg-amber-500/15 text-amber-600",
  loose: "bg-slate-400/15 text-slate-500",
  "linked-open": "bg-sky-500/15 text-sky-600",
  "linked-paid": "bg-emerald-500/15 text-emerald-600"
};

// Espelha PaymentStatusPill (src/payments/components), mesma paleta de 4
// estados, so trocando cliente por fornecedor na fonte de dados.
export function SupplierPaymentStatusPill({ payment }: { payment: SupplierPayment }) {
  const { supplierPaymentAllocationState, supplierPaymentAllocationLabel } = window.supplierModule;
  const state = supplierPaymentAllocationState(payment);
  const label = supplierPaymentAllocationLabel(payment);
  return (
    <span className={`hidden shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold sm:inline-flex ${TONE[state]}`}>
      {label}
    </span>
  );
}
