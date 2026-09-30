import { money } from "@/lib/format";
import type { SupplierEntry } from "@/types/global";

const STATUS_PILL_STYLES: Record<string, string> = {
  "A fazer": "bg-[#fdeceb] text-danger",
  Feito: "bg-[#eef7ff] text-[#155f9f]",
  Entregue: "bg-[#edf9f2] text-[#117440]",
  Cancelado: "bg-[var(--danger-15)] text-danger italic"
};

function cardDateParts(dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00Z`);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "short" }).format(date).replace(".", "");
  return { day, month };
}

// Espelha o card de renderSupplierOnlineEntries() (supplier.js:643-653) -
// lista 100% somente leitura (o vanilla tambem nao tem nenhum botao de acao
// aqui), so cabecalho + bloco de detalhes pastel, sem bloco de acoes.
export function SupplierOnlineEntryCard({ entry }: { entry: SupplierEntry }) {
  const { clientName, supplierById } = window.supplierModule;
  const supplier = supplierById(entry.supplierId);
  const statusPillClass = STATUS_PILL_STYLES[entry.status] || STATUS_PILL_STYLES.Cancelado;
  const { day, month } = cardDateParts(entry.date);

  return (
    <article className="rounded-2xl border border-border bg-surface p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className="grid shrink-0 place-items-center rounded-xl bg-[var(--primary-15)] px-2.5 py-1.5 text-center leading-tight text-primary">
          <strong className="text-lg">{day}</strong>
          <span className="text-[10px] font-bold uppercase tracking-wide opacity-80">{month}</span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-extrabold text-ink">
            <span className={`mr-2 mb-0.5 inline-block rounded-full px-2.5 py-1 align-middle text-xs font-semibold ${statusPillClass}`}>
              {entry.status}
            </span>
            {entry.description}
          </h3>
          <span className="mt-1.5 inline-flex items-center rounded-lg border border-[#bdd8ef] bg-[#eef7ff] px-2.5 py-1 text-sm font-extrabold tracking-wide text-[#155f9f]">
            {entry.reference || "Sem referência"}
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-surface-2 p-3">
        <div className="min-w-0">
          <span className="block truncate text-sm font-extrabold text-[#1768ad]">{supplier?.name || ""}</span>
          <span className="text-xs text-muted">{entry.clientId ? clientName(entry.clientId) : "Sem cliente vinculado"}</span>
        </div>
        <strong className="shrink-0 whitespace-nowrap text-lg font-extrabold text-ink">{money.format(entry.amount)}</strong>
      </div>
    </article>
  );
}
