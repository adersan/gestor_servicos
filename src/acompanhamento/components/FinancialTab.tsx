import { ServiceGroupList } from "@/acompanhamento/components/ServiceGroupList";
import { amountText, formatDate } from "@/acompanhamento/format";
import { groupedServices } from "@/acompanhamento/grouping";
import type { TrackingApiResponse } from "@/acompanhamento/types";

export function FinancialTab({ data }: { data: TrackingApiResponse }) {
  const unbilled = data.currentServices || [];
  const unbilledTotal = unbilled.reduce((sum, item) => sum + Number(item.amount), 0);
  const billing = data.billing;
  const openAmount = billing ? Number(billing.open_amount) : 0;
  const groups = groupedServices(unbilled);

  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <article className="rounded-xl border border-line bg-[#fff7eb] p-4">
          <span className="block text-xs text-muted">Consumo não faturado</span>
          <strong className="mt-1 block text-xl text-ink">{amountText(unbilledTotal, true)}</strong>
          <small className="text-xs text-muted">{unbilled.length} serviço(s)</small>
        </article>
        <article className="rounded-xl border border-line bg-[#eef6ff] p-4">
          <span className="block text-xs text-muted">Cobrança atual</span>
          <strong className="mt-1 block text-xl text-ink">{billing ? amountText(billing.total_due, true) : "-"}</strong>
          <small className="text-xs text-muted">
            {billing ? `${formatDate(billing.period_start)} a ${formatDate(billing.period_end)}` : "Nenhuma cobrança em aberto"}
          </small>
        </article>
        <article className="rounded-xl border border-line bg-brand-soft p-4">
          <span className="block text-xs text-muted">Saldo em aberto</span>
          <strong className="mt-1 block text-xl text-ink">{amountText(billing ? openAmount : 0, true)}</strong>
          <small className="text-xs text-muted">{billing ? billing.status : "Sem cobrança"}</small>
        </article>
        <article className="rounded-xl border border-line bg-[#f3effa] p-4">
          <span className="block text-xs text-muted">Total em aberto + não faturado</span>
          <strong className="mt-1 block text-xl text-ink">{amountText(openAmount + unbilledTotal, true)}</strong>
          <small className="text-xs text-muted">Saldo em aberto somado ao consumo não faturado</small>
        </article>
      </div>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-ink">Consumo ainda não faturado</h3>
          <span className="text-xs text-muted">{unbilled.length} serviço(s)</span>
        </div>
        <div className="mt-4">
          <ServiceGroupList
            groups={groups}
            mode="full"
            emptyMessage="Nenhum serviço pendente de faturamento."
            showAmounts
          />
        </div>
      </section>
    </div>
  );
}
