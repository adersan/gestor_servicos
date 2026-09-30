import { Receipt } from "lucide-react";

import { AvatarInitials } from "@/components/ui/avatar-initials";
import { money } from "@/lib/format";
import type { SupplierPayment } from "@/types/global";
import { SupplierPaymentStatusPill } from "@/supplierPayments/components/SupplierPaymentStatusPill";

const dateFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });

// Espelha PaymentHistoryList (src/payments/components): clique unico na linha
// ja abre o modal de detalhes vanilla de verdade
// (window.supplierModule.openSupplierPaymentDetail), simplificando o fluxo de
// 2 passos do vanilla (selecionar linha, depois "Detalhes") - mesmo destino
// final, mesma simplificacao ja aceita na fase de Pagamentos (Financeiro).
export function SupplierPaymentHistoryList({ payments }: { payments: SupplierPayment[] }) {
  const { supplierById, openSupplierPaymentDetail } = window.supplierModule;
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-4 flex items-center gap-2">
        <Receipt className="h-4 w-4 text-muted" />
        <h3 className="text-sm font-semibold text-brand-ink">Pagamentos registrados</h3>
      </div>
      {payments.length ? (
        <div className="flex max-h-[496px] flex-col divide-y divide-border overflow-y-auto">
          {payments.map((payment) => {
            const supplier = supplierById(payment.supplierId || "");
            return (
              <button
                key={payment.id}
                type="button"
                onClick={() => openSupplierPaymentDetail(payment)}
                className="flex items-center gap-3 py-2.5 text-left text-sm transition-colors hover:bg-surface-2"
              >
                <AvatarInitials name={supplier?.name ?? "?"} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{supplier?.name ?? "Fornecedor"}</p>
                  <p className="text-xs text-muted">{dateFormat.format(new Date(`${payment.date}T00:00:00Z`))}</p>
                </div>
                <SupplierPaymentStatusPill payment={payment} />
                <strong className="shrink-0 whitespace-nowrap text-ink">{money.format(payment.amount)}</strong>
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
