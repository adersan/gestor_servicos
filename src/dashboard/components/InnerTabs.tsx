import { cn } from "@/lib/utils";

export type DashboardTab = "services" | "finance";

export function InnerTabs({ active, onChange }: { active: DashboardTab; onChange: (tab: DashboardTab) => void }) {
  const tabs: { key: DashboardTab; label: string }[] = [
    { key: "services", label: "Serviços" },
    { key: "finance", label: "Financeiro" }
  ];
  return (
    <div className="inline-flex gap-1 rounded-lg border border-border bg-surface p-1" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={active === tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
            active === tab.key ? "bg-primary text-primary-foreground" : "text-muted hover:text-ink"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
