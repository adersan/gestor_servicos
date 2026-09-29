import type { LucideIcon } from "lucide-react";
import { TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  primary: string | number;
  secondary?: string;
  icon: LucideIcon;
  iconClass: string;
  highlight?: boolean;
  showTrendIcon?: boolean;
  size?: "md" | "lg";
  onClick: () => void;
}

// Card de metrica compartilhado - extraido de ServiceMetricCards/FinanceMetricCards
// (Fase 1) pra nao duplicar o mesmo card em cada tela nova (Fase 2: Pagamentos
// reusa direto). Visual identico ao que ja estava publicado nas duas telas.
export function StatCard({
  label,
  primary,
  secondary,
  icon: Icon,
  iconClass,
  highlight,
  showTrendIcon,
  size = "md",
  onClick
}: StatCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex flex-col gap-3 overflow-hidden rounded-2xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg",
        highlight
          ? "border-[var(--primary-40)] bg-gradient-to-br from-[var(--primary-10)] via-surface to-surface"
          : "border-border bg-surface"
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn("flex h-10 w-10 items-center justify-center rounded-2xl", iconClass)}>
          <Icon className="h-5 w-5" strokeWidth={2.25} />
        </span>
        {showTrendIcon && (
          <TrendingUp className="h-4 w-4 text-muted opacity-0 transition-opacity group-hover:opacity-60" />
        )}
      </div>
      <div>
        <p className="text-sm font-medium text-muted">{label}</p>
        <p className={cn("font-bold tracking-tight text-ink", size === "lg" ? "text-3xl" : "text-2xl")}>{primary}</p>
        {secondary && <p className="text-xs text-muted">{secondary}</p>}
      </div>
    </button>
  );
}
