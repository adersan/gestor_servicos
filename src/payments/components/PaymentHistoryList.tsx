import { Receipt } from "lucide-react";

import { AvatarInitials } from "@/components/ui/avatar-initials";
import { dateFormat } from "@/payments/data";
import { money } from "@/lib/format";
import type { Payment } from "@/types/global";
import { PaymentStatusPill } from "@/payments/components/PaymentStatusPill";

// Clique unico na linha ja abre o modal de detalhes vanilla de verdade
// (window.openPaymentDetail) - simplifica o fluxo de 2 passos do vanilla
// (selecionar linha, depois clicar em "Detalhes"), mesmo destino final.
export function PaymentHistoryList({ payments }: { payments: Payment[] }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-4 flex items-center gap-2">
        <Receipt className="h-4 w-4 text-muted" />
        <h3 className="text-sm font-semibold text-brand-ink">Pagamentos registrados</h3>
      </div>
      {payments.length ? (
        <div className="flex max-h-[496px] flex-col divide-y divide-border overflow-y-auto">
          {payments.map((payment) => {
            const client = window.clientById(payment.clientId);
            return (
              <button
                key={payment.id}
                type="button"
                onClick={() => window.openPaymentDetail(payment)}
                className="flex items-center gap-3 py-2.5 text-left text-sm transition-colors hover:bg-surface-2"
              >
                <AvatarInitials name={client?.name ?? "?"} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{client?.name ?? "Cliente"}</p>
                  <p className="text-xs text-muted">{dateFormat.format(new Date(`${payment.date}T00:00:00Z`))}</p>
                </div>
                <PaymentStatusPill payment={payment} />
                <strong className="whitespace-nowrap text-ink">{money.format(payment.amount)}</strong>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted">Nenhum pagamento encontrado.</p>
      )}
    </div>
  );
}
