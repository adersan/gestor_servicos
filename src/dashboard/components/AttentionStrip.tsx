import { money } from "@/lib/format";
import type { AttentionData } from "@/dashboard/data";

export function AttentionStrip({ data }: { data: AttentionData }) {
  const chips = [
    data.overdueBillingsCount > 0 && {
      key: "billings",
      tone: "border-danger text-danger",
      label: `${data.overdueBillingsCount} cobrança(s) atrasada(s) · ${money.format(data.overdueBillingsTotal)}`,
      onClick: () => window.showView("billing")
    },
    data.overdueServicesCount > 0 && {
      key: "services",
      tone: "border-accent text-accent",
      label: `${data.overdueServicesCount} serviço(s) há mais de 24h`,
      onClick: () => window.showView("services")
    },
    data.newRequestsCount > 0 && {
      key: "requests",
      tone: "border-brand text-brand-ink",
      label: `${data.newRequestsCount} pedido(s) novo(s) de cliente`,
      onClick: () => window.showView("requests")
    }
  ].filter(Boolean) as { key: string; tone: string; label: string; onClick: () => void }[];

  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-3">
      <span className="text-xs font-bold uppercase tracking-wide text-muted">Precisa de atenção</span>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.onClick}
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${chip.tone}`}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
