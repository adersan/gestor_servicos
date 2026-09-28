import type { LucideIcon } from "lucide-react";
import { Inbox, AlertOctagon, PiggyBank } from "lucide-react";

import { money } from "@/lib/format";
import type { FinanceSummaryData } from "@/dashboard/data";

function Strip({
  label,
  value,
  icon: Icon,
  tone,
  danger,
  onClick
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-shadow hover:shadow-md ${
        danger ? "border-[var(--danger-40)]" : "border-border"
      } bg-surface`}
    >
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <span className="block text-xs text-muted">{label}</span>
        <strong className={`text-lg ${danger ? "text-danger" : "text-ink"}`}>{money.format(value)}</strong>
      </div>
    </button>
  );
}

export function FinanceSummaryStrip({ data }: { data: FinanceSummaryData }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <Strip label="Em aberto" value={data.openTotal} icon={Inbox} tone="bg-sky-500/15 text-sky-600" onClick={() => window.showView("billing")} />
      <Strip
        label="Atrasado"
        value={data.overdueTotal}
        icon={AlertOctagon}
        tone="bg-[var(--danger-15)] text-danger"
        danger={data.overdueTotal > 0}
        onClick={() => window.showView("billing")}
      />
      <Strip label="Recebido hoje" value={data.receivedToday} icon={PiggyBank} tone="bg-emerald-500/15 text-emerald-600" onClick={() => window.showView("payments")} />
    </div>
  );
}
