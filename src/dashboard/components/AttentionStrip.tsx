import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Clock3, Sparkles } from "lucide-react";

import { money } from "@/lib/format";
import type { AttentionData } from "@/dashboard/data";

interface Chip {
  key: string;
  icon: LucideIcon;
  tone: string;
  label: string;
  onClick: () => void;
}

export function AttentionStrip({ data }: { data: AttentionData }) {
  const chips: Chip[] = [
    data.overdueBillingsCount > 0 && {
      key: "billings",
      icon: AlertTriangle,
      tone: "border-[var(--danger-30)] bg-[var(--danger-10)] text-danger",
      label: `${data.overdueBillingsCount} cobrança(s) atrasada(s) · ${money.format(data.overdueBillingsTotal)}`,
      onClick: () => window.showView("billing")
    },
    data.overdueServicesCount > 0 && {
      key: "services",
      icon: Clock3,
      tone: "border-amber-500/30 bg-amber-500/10 text-amber-600",
      label: `${data.overdueServicesCount} serviço(s) há mais de 24h`,
      onClick: () => window.showView("services")
    },
    data.newRequestsCount > 0 && {
      key: "requests",
      icon: Sparkles,
      tone: "border-[var(--primary-30)] bg-[var(--primary-10)] text-primary",
      label: `${data.newRequestsCount} pedido(s) novo(s) de cliente`,
      onClick: () => window.showView("requests")
    }
  ].filter(Boolean) as Chip[];

  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface p-3">
      <span className="text-xs font-bold uppercase tracking-wide text-muted">Precisa de atenção</span>
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.onClick}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-transform hover:scale-105 ${chip.tone}`}
        >
          <chip.icon className="h-3.5 w-3.5" />
          {chip.label}
        </button>
      ))}
    </div>
  );
}
