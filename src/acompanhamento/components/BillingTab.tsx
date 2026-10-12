import { useState } from "react";

import { StatusBadge } from "@/acompanhamento/components/ServiceGroupList";
import { formatDate, formatMoney, requesterName } from "@/acompanhamento/format";
import { groupedServices, sortBillingGroups } from "@/acompanhamento/grouping";
import { billingRequesterSummary, openBillingPdf } from "@/acompanhamento/pdf";
import type { TrackingBilling, TrackingBillingServiceItem } from "@/acompanhamento/types";

const BILLING_STATUS_CLASS: Record<string, string> = {
  Aberta: "bg-[#fff7eb] text-[var(--orange)]",
  Parcial: "bg-[#fff7eb] text-[var(--orange)]",
  Paga: "bg-[#eef6ff] text-[var(--blue)]",
  Cancelada: "bg-[#fdecea] text-danger",
  Consolidada: "bg-[#edf9f2] text-[var(--green)]"
};

function BillingStatusChip({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${BILLING_STATUS_CLASS[status] || "bg-[#fff7eb] text-[var(--orange)]"}`}>
      {status}
    </span>
  );
}

function complementaryLabel(secondaries: TrackingBillingServiceItem[], item: TrackingBillingServiceItem) {
  if (secondaries.length) return "Complementar vinculado ao serviço original";
  return item.is_secondary ? "Complementar vinculado ao serviço original" : "";
}

async function copyPixKey(value: string, onCopied: () => void) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const field = document.createElement("textarea");
    field.value = value;
    document.body.appendChild(field);
    field.select();
    document.execCommand("copy");
    field.remove();
  }
  onCopied();
}

export function BillingTab({
  client,
  billing
}: {
  client: { name: string };
  billing: TrackingBilling;
}) {
  const [copiedMethodId, setCopiedMethodId] = useState<string | null>(null);
  const services = billing.services || [];
  const payments = billing.payments || [];
  const paymentMethods = billing.paymentMethods || [];
  const paymentTotal = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const serviceGroups = sortBillingGroups(groupedServices(services));
  const requesterRows = billingRequesterSummary(serviceGroups);
  const maxValue = Math.max(Number(billing.total_due), paymentTotal, Math.abs(Number(billing.previous_balance)), 1);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Período: {formatDate(billing.period_start)} a {formatDate(billing.period_end)} ·{" "}
          <BillingStatusChip status={billing.status} />
        </p>
        <button
          type="button"
          onClick={() =>
            openBillingPdf({
              client,
              billing,
              services,
              payments,
              paymentMethods
            })
          }
          className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white"
        >
          Abrir PDF
        </button>
      </div>

      <p className="rounded-xl border border-line bg-surface-2 p-3 text-xs text-muted">
        Esta cobrança se refere ao período de {formatDate(billing.period_start)} a {formatDate(billing.period_end)} e
        não inclui os serviços ainda em aberto (não faturados).
      </p>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h3 className="mb-3 text-sm font-semibold text-ink">Formas de pagamento</h3>
        {!paymentMethods.length ? (
          <p className="text-sm text-muted">Consulte as formas de pagamento com o responsável.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {paymentMethods.map((method) => {
              const isPix = String(method.type || "").toUpperCase().includes("PIX") && method.details;
              const pixKey = isPix
                ? method.details!.includes(":")
                  ? method.details!.split(":").pop()!.trim()
                  : method.details!.trim()
                : "";
              return (
                <article key={method.id} className="rounded-xl border border-line bg-surface-2 p-3">
                  <strong className="text-sm text-ink">
                    {method.name} ({method.type})
                  </strong>
                  <p className="mt-1 text-xs text-muted">{method.details || ""}</p>
                  {isPix && (
                    <button
                      type="button"
                      onClick={() => copyPixKey(pixKey, () => {
                        setCopiedMethodId(method.id);
                        setTimeout(() => setCopiedMethodId((current) => (current === method.id ? null : current)), 1800);
                      })}
                      className="mt-2 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-brand-soft"
                    >
                      {copiedMethodId === method.id ? "Chave copiada" : "Copiar chave PIX"}
                    </button>
                  )}
                  {method.payment_link && (
                    <a
                      href={method.payment_link}
                      target="_blank"
                      rel="noopener"
                      className="mt-2 block text-xs font-semibold text-brand underline"
                    >
                      Abrir link de pagamento
                    </a>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <article className="rounded-xl border border-line bg-[#fff7eb] p-4">
          <span className="block text-xs text-muted">Saldo anterior</span>
          <strong className="mt-1 block text-lg text-ink">{formatMoney(billing.previous_balance)}</strong>
        </article>
        <article className="rounded-xl border border-line bg-[#eef6ff] p-4">
          <span className="block text-xs text-muted">Serviços</span>
          <strong className="mt-1 block text-lg text-ink">{formatMoney(billing.services_total)}</strong>
        </article>
        <article className="rounded-xl border border-line bg-[#edf9f2] p-4">
          <span className="block text-xs text-muted">Pagamentos</span>
          <strong className="mt-1 block text-lg text-ink">{formatMoney(paymentTotal)}</strong>
        </article>
        <article className="rounded-xl border border-line bg-brand-soft p-4">
          <span className="block text-xs text-muted">Total em aberto</span>
          <strong className="mt-1 block text-lg text-ink">{formatMoney(billing.open_amount ?? billing.total_due)}</strong>
        </article>
      </div>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h3 className="mb-3 text-sm font-semibold text-ink">Resumo gráfico</h3>
        <div className="grid gap-2">
          {[
            { label: "Saldo anterior", value: Math.abs(Number(billing.previous_balance)), color: "bg-muted" },
            { label: "Serviços", value: Number(billing.services_total), color: "bg-[var(--blue)]" },
            { label: "Pagamentos", value: paymentTotal, color: "bg-[var(--green)]" }
          ].map((row) => (
            <div key={row.label} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-xs text-ink">
              <span className="text-muted">{row.label}</span>
              <div className="h-2 rounded-full bg-surface-2">
                <i className={`block h-2 rounded-full ${row.color}`} style={{ width: `${(row.value / maxValue) * 100}%` }} />
              </div>
              <strong>{formatMoney(row.value)}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h3 className="mb-3 text-sm font-semibold text-ink">Resumo por solicitante</h3>
        {!requesterRows.length ? (
          <p className="text-sm text-muted">Nenhum solicitante informado neste período.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {requesterRows.map((group) => (
              <article key={group.requester} className="rounded-xl border border-line bg-surface-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-sm text-ink">{group.requester}</strong>
                  <span className="text-xs text-muted">
                    {group.count} serviço(s) - {formatMoney(group.total)}
                  </span>
                </div>
                <ul className="mt-2 grid gap-1 text-xs text-muted">
                  {group.services.map((service) => (
                    <li key={service.name}>
                      {service.name}: {service.count} - {formatMoney(service.total)}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}

        <h3 className="mb-3 mt-5 text-sm font-semibold text-ink">Serviços do período</h3>
        {!serviceGroups.length ? (
          <p className="text-sm text-muted">Nenhum serviço neste fechamento.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-muted">
                  <th className="py-2 pr-2 font-semibold">Data</th>
                  <th className="py-2 pr-2 font-semibold">Serviço</th>
                  <th className="py-2 pr-2 font-semibold">Ref</th>
                  <th className="py-2 pr-2 font-semibold">Solicitante</th>
                  <th className="py-2 pr-2 font-semibold">Status</th>
                  <th className="py-2 text-right font-semibold">Valor</th>
                </tr>
              </thead>
              <tbody>
                {serviceGroups.map(({ primary: item, secondaries }) => (
                  <tr key={item.id} className="border-b border-line last:border-0">
                    <td className="py-2 pr-2 text-xs text-muted">{formatDate(item.service_date)}</td>
                    <td className="py-2 pr-2 text-xs text-ink">
                      {item.service_name}
                      {secondaries.length > 0 && (
                        <div className="mt-0.5 grid gap-0.5 text-xs text-muted">
                          {secondaries.map((secondary) => (
                            <span key={secondary.id}>
                              {secondary.service_name} · {formatMoney(secondary.amount)}
                            </span>
                          ))}
                        </div>
                      )}
                      {complementaryLabel(secondaries, item) && (
                        <span className="mt-0.5 block text-xs text-muted">{complementaryLabel(secondaries, item)}</span>
                      )}
                    </td>
                    <td className="py-2 pr-2 text-xs text-ink">{item.reference || "Sem referência"}</td>
                    <td className="py-2 pr-2 text-xs text-ink">{requesterName(item)}</td>
                    <td className="py-2 pr-2">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="py-2 text-right text-xs font-semibold text-[var(--blue)]">
                      {formatMoney([item, ...secondaries].reduce((sum, service) => sum + Number(service.amount), 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h3 className="mb-3 text-sm font-semibold text-ink">Pagamentos</h3>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th className="py-2 pr-2 font-semibold">Data</th>
              <th className="py-2 pr-2 font-semibold">Descrição</th>
              <th className="py-2 text-right font-semibold">Valor</th>
            </tr>
          </thead>
          <tbody>
            {payments.length ? (
              payments.map((item) => (
                <tr key={item.id} className="border-b border-line last:border-0">
                  <td className="py-2 pr-2 text-xs text-muted">{formatDate(item.payment_date)}</td>
                  <td className="py-2 pr-2 text-xs text-ink">{item.method || item.notes || "-"}</td>
                  <td className="py-2 text-right text-xs font-semibold text-[var(--green)]">{formatMoney(item.amount)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="py-2 text-xs text-muted">
                  Nenhum pagamento neste fechamento.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
