import { ListChecks, Wallet } from "lucide-react";

import { cn } from "@/lib/utils";

export type DashboardTab = "services" | "finance";

export function InnerTabs({ active, onChange }: { active: DashboardTab; onChange: (tab: DashboardTab) => void }) {
  const tabs: { key: DashboardTab; label: string; icon: typeof ListChecks }[] = [
    { key: "services", label: "Serviços", icon: ListChecks },
    { key: "finance", label: "Financeiro", icon: Wallet }
  ];
  return (
    <div className="inline-flex gap-1 rounded-2xl border border-border bg-surface p-1" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={active === tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            "flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-sm font-semibold transition-colors",
            active === tab.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted hover:bg-surface-2 hover:text-ink"
          )}
        >
          <tab.icon className="h-4 w-4" />
          {tab.label}
        </button>
      ))}
    </div>
  );
}
