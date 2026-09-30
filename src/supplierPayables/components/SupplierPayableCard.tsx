import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { money } from "@/lib/format";
import type { SupplierPayable } from "@/types/global";

const STATUS_PILL_STYLES: Record<string, string> = {
  Aberta: "bg-[#fdeceb] text-danger",
  Parcial: "bg-[#eef7ff] text-[#155f9f]",
  Paga: "bg-[#edf9f2] text-[#117440]"
};

const ACTION_BUTTON = "rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-2";
const POSITIVE_BUTTON = "rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600 transition-colors hover:bg-emerald-500/20";
const DANGER_BUTTON = "rounded-lg border border-[var(--danger-40)] bg-surface px-3 py-1.5 text-xs font-semibold text-danger transition-colors hover:bg-[var(--danger-10)]";

// Mesmo perfil visual dos outros cards ja portados: cabecalho branco, bloco
// de valores pastel, bloco de acoes pastel. Historico de pagamento vira um
// accordion com estado local (diferente do vanilla, que usa
// data-toggle-payable-history pra alternar uma classe no DOM) - mais
// idiomatico em React, mesmo efeito final. Botoes de acao (abrir
// conta/compartilhar/baixa/cancelar/excluir pagamento do historico)
// continuam so com data-*, sem onClick - o listener generico do
// supplier.js ja escuta todos eles.
export function SupplierPayableCard({ payable }: { payable: SupplierPayable }) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const { payableOpen, payablePaid, supplierById, supplierPreferencesOf } = window.supplierModule;
  const supplier = supplierById(payable.supplierId);
  const open = payableOpen(payable);
  const paid = payablePaid(payable);
  const preferences = supplierPreferencesOf(payable);

  const state = window.getAppState();
  const entryCount = state.supplierEntries.filter((entry) => entry.payableId === payable.id).length;
  const history = state.supplierPayments
    .filter((payment) => payment.payableId === payable.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <article className="rounded-2xl border border-border bg-surface p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="block text-xs font-semibold uppercase tracking-wide text-muted">
            {window.formatDate(payable.startDate)} a {window.formatDate(payable.endDate)}
          </span>
          <h3 className="truncate text-base font-extrabold text-ink">{supplier?.name || ""}</h3>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_PILL_STYLES[payable.status] || STATUS_PILL_STYLES.Aberta}`}>
          {payable.status}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-4 rounded-xl bg-surface-2 p-3">
        <div>
          <span className="block text-[10px] font-bold uppercase tracking-wide text-muted">Valor original</span>
          <strong className="text-sm font-extrabold text-ink">{money.format(payable.amount)}</strong>
        </div>
        <div>
          <span className="block text-[10px] font-bold uppercase tracking-wide text-muted">Pago</span>
          <strong className="text-sm font-extrabold text-[#117440]">{money.format(paid)}</strong>
        </div>
        <div>
          <span className="block text-[10px] font-bold uppercase tracking-wide text-muted">Saldo</span>
          <strong className="text-sm font-extrabold text-[#1768ad]">{money.format(open)}</strong>
        </div>
      </div>

      <p className="mt-2.5 text-xs text-muted">
        {entryCount} serviço(s) nesta conta{payable.createdAt ? ` · Gerada em ${new Date(payable.createdAt).toLocaleDateString("pt-BR")}` : ""}
      </p>

      {preferences.length > 0 && (
        <p className="mt-2 rounded-lg bg-[#fff7e9] px-2.5 py-2 text-xs text-[#75420d]">
          Recebimento informado: {preferences.map((preference) => `${preference.method} · ${money.format(Number(preference.amount || 0))}`).join(" + ")}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2 rounded-xl bg-[var(--primary-15)] p-3">
        <button type="button" data-supplier-report={payable.id} className={ACTION_BUTTON}>
          Abrir conta
        </button>
        <button type="button" data-supplier-share={payable.id} className={ACTION_BUTTON}>
          Compartilhar
        </button>
        {open > 0 && (
          <>
            <button type="button" data-pay-supplier={payable.id} data-mode="partial" className={ACTION_BUTTON}>
              Baixa parcial
            </button>
            <button type="button" data-pay-supplier={payable.id} data-mode="full" className={POSITIVE_BUTTON}>
              Quitar
            </button>
          </>
        )}
        {!paid && (
          <button type="button" data-cancel-supplier-payable={payable.id} className={DANGER_BUTTON}>
            Cancelar conta
          </button>
        )}
        {history.length > 0 && (
          <button type="button" onClick={() => setHistoryOpen((current) => !current)} className={`flex items-center gap-1 ${ACTION_BUTTON}`}>
            Histórico de pagamento ({history.length})
            {historyOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      {historyOpen && history.length > 0 && (
        <div className="mt-3 flex flex-col gap-2 rounded-xl bg-surface-2 p-3">
          {history.map((payment) => (
            <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-muted">{window.formatDate(payment.date)}</span>
              <span className="flex-1 text-ink">
                {payment.method || "Não informada"} · {payment.note || "Sem observação"}
              </span>
              <strong className="text-ink">{money.format(payment.amount)}</strong>
              <button type="button" data-delete-supplier-payment={payment.id} className="text-xs font-semibold text-danger">
                Excluir
              </button>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
