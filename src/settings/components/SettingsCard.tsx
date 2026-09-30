import type { ReactNode } from "react";

export function SettingsCard({ eyebrow, title, description, children }: { eyebrow: string; title: string; description?: string; children?: ReactNode }) {
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
      <div>
        <span className="block text-xs font-bold uppercase tracking-wide text-muted">{eyebrow}</span>
        <h3 className="text-base font-extrabold text-ink">{title}</h3>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {children}
    </article>
  );
}
