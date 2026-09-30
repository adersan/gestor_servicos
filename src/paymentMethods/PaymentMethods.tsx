import { useState } from "react";
import { Wallet2, PlusCircle } from "lucide-react";

import { usePaymentMethodsData } from "@/paymentMethods/usePaymentMethodsData";
import type { PaymentMethodFiltersState } from "@/paymentMethods/data";
import { PaymentMethodFilters } from "@/paymentMethods/components/PaymentMethodFilters";
import { PaymentMethodCard } from "@/paymentMethods/components/PaymentMethodCard";

function defaultFilters(): PaymentMethodFiltersState {
  return { status: "", search: "" };
}

// Fase 15 da migracao React: "Financeiro > Formas de pagamento" (vanilla
// renderPaymentMethods(), app.js:2182-2201). Ultima aba do Financeiro que
// ainda faltava (Pagamentos/Cobrancas/Resumo por cliente ja migradas nas
// Fases 2-4, antes desta sessao). Mesmo perfil visual dos cards ja
// portados - cabecalho branco, pastilha de situacao, bloco de acoes pastel.
export function PaymentMethods() {
  const [filters, setFilters] = useState<PaymentMethodFiltersState>(defaultFilters);
  const methods = usePaymentMethodsData(filters);

  const updateFilters = (next: Partial<PaymentMethodFiltersState>) => setFilters((current) => ({ ...current, ...next }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-gradient-to-br from-[var(--primary-10)] via-surface to-surface p-5">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Wallet2 className="h-6 w-6" />
          </span>
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-muted">Recebimento</span>
            <h2 className="text-xl font-bold text-brand-ink">Formas de pagamento</h2>
            <p className="text-sm text-muted">As formas ativas serão incluídas automaticamente nas próximas cobranças e no PDF.</p>
          </div>
        </div>
        <button
          type="button"
          data-dialog="paymentMethodDialog"
          className="flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <PlusCircle className="h-4 w-4" />
          Adicionar forma
        </button>
      </div>

      <PaymentMethodFilters filters={filters} onChange={updateFilters} />

      {methods.length ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {methods.map((method) => (
            <PaymentMethodCard key={method.id} method={method} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">Nenhum registro por aqui.</p>
      )}
    </div>
  );
}
