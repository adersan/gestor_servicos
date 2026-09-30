import { useState } from "react";
import { Check, Copy, Trash2 } from "lucide-react";

import type { SupplierLink } from "@/types/global";

const ACTION_BUTTON = "flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-2";
const DANGER_BUTTON = "flex items-center gap-1.5 rounded-lg border border-[var(--danger-40)] bg-surface px-3 py-1.5 text-xs font-semibold text-danger transition-colors hover:bg-[var(--danger-10)]";

// Espelha trackingLinkUrl() mas pro portal do fornecedor (supplier.js:671).
function supplierLinkUrl(accessCode: string) {
  return `${window.location.origin}/fornecedor.html?acesso=${encodeURIComponent(accessCode)}`;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={ACTION_BUTTON}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copiado" : label}
    </button>
  );
}

// Mesmo perfil visual do TrackingLinkCard (Fase 8). Copiar/excluir com
// onClick de verdade (useSupplierLinks.ts mantem a lista em estado React).
export function SupplierLinkCard({ link, onDelete }: { link: SupplierLink; onDelete: (id: string) => void }) {
  const url = supplierLinkUrl(link.accessCode);
  const expiryText = link.expiresAt ? `Expira em ${new Date(link.expiresAt).toLocaleString("pt-BR")}` : "Sem validade (até ser removido)";

  return (
    <article className="rounded-2xl border border-border border-l-4 border-l-[#7654a8] bg-surface p-4 transition-shadow hover:shadow-md">
      <h3 className="text-base font-extrabold text-ink">{link.supplierName}</h3>
      <p className="mt-1 text-xs text-muted">
        Período {window.formatDate(link.periodStart)} a {window.formatDate(link.periodEnd)} · Gerado em {new Date(link.createdAt).toLocaleString("pt-BR")} ·{" "}
        {expiryText}
      </p>

      <div className="mt-3 flex flex-col gap-2 rounded-xl bg-surface-2 p-3">
        <div className="grid gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted">Link (sem senha)</span>
          <strong className="break-all font-mono text-xs font-semibold text-ink">{url}</strong>
        </div>
        <div className="grid gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted">Identificador (com senha)</span>
          <strong className="break-all font-mono text-xs font-semibold text-ink">{link.identifier || ""}</strong>
        </div>
        <div className="grid gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted">Senha</span>
          <strong className="break-all font-mono text-xs font-semibold text-ink">{link.password || ""}</strong>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 rounded-xl bg-[var(--primary-15)] p-3">
        <CopyButton value={url} label="Copiar link" />
        <CopyButton value={link.identifier || ""} label="Copiar ID" />
        <CopyButton value={link.password || ""} label="Copiar senha" />
        <button type="button" className={DANGER_BUTTON} onClick={() => onDelete(link.id)}>
          <Trash2 className="h-3.5 w-3.5" />
          Excluir
        </button>
      </div>
    </article>
  );
}
