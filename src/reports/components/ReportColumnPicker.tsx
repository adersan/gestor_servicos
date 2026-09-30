import type { ReportDefinition } from "@/types/global";

export function ReportColumnPicker({
  def,
  selected,
  onChange
}: {
  def: ReportDefinition;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
  };

  return (
    <fieldset className="rounded-2xl border border-border bg-surface p-4">
      <legend className="px-1 text-sm font-semibold text-ink">Colunas</legend>
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange(new Set(def.columns.map((column) => column.key)))}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-2"
        >
          Marcar todas
        </button>
        <button
          type="button"
          onClick={() => onChange(new Set())}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-2"
        >
          Desmarcar todas
        </button>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {def.columns.map((column) => (
          <label key={column.key} className="flex items-center gap-1.5 text-sm text-ink">
            <input type="checkbox" checked={selected.has(column.key)} onChange={() => toggle(column.key)} />
            {column.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
