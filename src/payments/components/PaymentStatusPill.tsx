import type { Payment } from "@/types/global";

const TONE: Record<string, string> = {
  credit: "bg-amber-500/15 text-amber-600",
  loose: "bg-slate-400/15 text-slate-500",
  "linked-open": "bg-sky-500/15 text-sky-600",
  "linked-paid": "bg-emerald-500/15 text-emerald-600"
};

// Mesma linguagem de 4 estados do vanilla (styles.css .payment-status-pill),
// so recolorida pra paleta padrao do Tailwind ja usada no resto do app React.
export function PaymentStatusPill({ payment }: { payment: Payment }) {
  const state = window.paymentAllocationState(payment);
  const label = window.paymentAllocationLabel(payment);
  return (
    <span className={`hidden shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold sm:inline-flex ${TONE[state]}`}>
      {label}
    </span>
  );
}
