import { money } from "@/lib/format";
import type { Billing } from "@/types/global";

const STATUS_TONE: Record<string, string> = {
  Aberta: "bg-slate-400/15 text-slate-500",
  Parcial: "bg-amber-500/15 text-amber-600",
  Paga: "bg-emerald-500/15 text-emerald-600",
  Cancelada: "bg-slate-400/15 text-slate-500",
  Consolidada: "bg-violet-500/15 text-violet-600"
};

const CARD_STATUS_BORDER: Record<string, string> = {
  "billing-paid": "border-emerald-500/40",
  "billing-overdue-card": "border-[var(--danger-40)]",
  "billing-pending": "border-border",
  "billing-consolidated": "border-violet-500/40",
  "": "border-border"
};

// Card completo, com TODOS os botoes de acao reais - cada um so renderiza o
// mesmo atributo data-* que o listener generico ja existente (app.js) escuta,
// sem nenhum onClick/logica de escrita nova. O botao "Ver detalhes" e o
// proprio listener generico cuidam do expandir/colapsar via classList, sem
// estado React envolvido (ver plano, Fase 3).
export function BillingCard({ item, isAccessOwner }: { item: Billing; isAccessOwner: boolean }) {
  const client = window.clientById(item.clientId);
  const status = window.billingCurrentStatus(item);
  const cardStatusClass = window.billingCardStatusClass(item);
  const openAmount = window.billingOpenAmount(item);
  const rollover = window.billingRolloverTarget(item);
  const lastSend = item.sendHistory?.length ? item.sendHistory[item.sendHistory.length - 1] : null;
  const canPay = openAmount > 0 && item.status !== "Cancelada";
  const canSharePaymentLink = openAmount > 0.001 && item.status !== "Cancelada" && window.billingHasCardPaymentMethod(item);
  const canCancel = status === "Aberta" || status === "Parcial";

  return (
    <article className={`billing-card rounded-2xl border bg-surface p-4 ${CARD_STATUS_BORDER[cardStatusClass] ?? "border-border"}`}>
      <span className="text-xs font-medium text-muted">
        {item.billingNumber ? `Cobrança #${item.billingNumber} · ` : ""}
        {window.formatDate(item.startDate)} a {window.formatDate(item.endDate)}
      </span>
      <h3 className="text-lg font-bold text-ink">{client?.name ?? ""}</h3>
      <p className="mt-1 flex items-center gap-2 text-sm text-muted">
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_TONE[status] ?? ""}`}>
          {window.billingStatusLabel(item)}
        </span>
        · Saldo em aberto
      </p>
      <strong className="mt-2 block text-3xl font-bold text-ink">{money.format(openAmount)}</strong>

      <button type="button" data-toggle-finance-card className="mobile-finance-more mt-2 text-sm font-semibold text-primary">
        Ver detalhes
      </button>

      <div className="mobile-finance-details mt-3 flex flex-col gap-2 border-t border-border pt-3 text-sm">
        <p className="font-semibold text-ink">
          {item.statusReason || (status === "Paga" ? "Quitada pelos pagamentos vinculados" : "Aguardando pagamento")}
        </p>
        <p className="text-muted">Pagamentos: {window.billingPaymentSummary(item)}</p>
        {rollover && (
          <p className="text-sky-600">
            Saldo incorporado na cobrança de {window.formatDate(rollover.startDate)} a {window.formatDate(rollover.endDate)}.
          </p>
        )}
        {Number(item.creditGenerated || 0) > 0 && (
          <p className="text-amber-600">
            Crédito gerado para a próxima cobrança: <strong>{money.format(item.creditGenerated!)}</strong>
          </p>
        )}
        <p className="text-muted">
          {lastSend ? `Último envio: ${new Date(lastSend.sentAt).toLocaleString("pt-BR")}` : "Ainda não enviada pelo sistema"}
        </p>
        <p className="text-muted">
          Histórico no portal: <strong className="text-ink">{item.historyEnabled ? "Liberado" : "Bloqueado"}</strong>
        </p>

        <div className="access-box rounded-lg bg-surface-2 p-3">
          {item.identifier ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted">
                  ID <strong className="block text-ink">{item.identifier}</strong>
                </span>
                <button
                  type="button"
                  data-copy-access="identifier"
                  data-billing-id={item.id}
                  className="rounded-md border border-border px-2 py-1 text-xs font-semibold text-ink"
                >
                  Copiar ID
                </button>
              </div>
              {item.password ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted">
                    Senha <strong className="block text-ink">{item.password}</strong>
                  </span>
                  <button
                    type="button"
                    data-copy-access="password"
                    data-billing-id={item.id}
                    className="rounded-md border border-border px-2 py-1 text-xs font-semibold text-ink"
                  >
                    Copiar senha
                  </button>
                </div>
              ) : (
                <span className="text-xs text-muted">Senha exibida somente ao gerar o acesso.</span>
              )}
            </div>
          ) : (
            <span className="text-xs text-muted">Acesso do cliente ainda não gerado.</span>
          )}
        </div>

        <div className="card-actions flex flex-wrap gap-2 pt-1">
          <button type="button" data-view-report={item.id} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink">
            Ver relatório
          </button>
          <button type="button" data-share-whatsapp={item.id} className="rounded-lg border border-emerald-500/40 px-3 py-1.5 text-xs font-semibold text-emerald-600">
            WhatsApp
          </button>
          <button type="button" data-share-report={item.id} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink">
            Compartilhar relatório
          </button>
          {canSharePaymentLink && (
            <button type="button" data-share-payment-link={item.id} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink">
              Compartilhar link de pagamento
            </button>
          )}
          {canPay && (
            <>
              <button
                type="button"
                data-pay-billing={item.id}
                data-payment-mode="partial"
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink"
              >
                Pagar parcialmente
              </button>
              <button
                type="button"
                data-pay-billing={item.id}
                data-payment-mode="full"
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Quitar
              </button>
            </>
          )}
          <button type="button" data-renew-access={item.id} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink">
            Gerar novo acesso
          </button>
          {item.identifier && isAccessOwner && (
            <button type="button" data-toggle-history={item.id} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink">
              {item.historyEnabled ? "Bloquear histórico" : "Liberar histórico"}
            </button>
          )}
          {canCancel && (
            <button type="button" data-cancel-billing={item.id} className="rounded-lg border border-[var(--danger-40)] px-3 py-1.5 text-xs font-semibold text-danger">
              Cancelar
            </button>
          )}
          <button type="button" data-delete-billing={item.id} className="rounded-lg border border-[var(--danger-40)] px-3 py-1.5 text-xs font-semibold text-danger">
            Excluir
          </button>
        </div>
      </div>
    </article>
  );
}
