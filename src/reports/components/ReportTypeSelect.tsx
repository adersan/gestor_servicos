const GROUP_ORDER = ["Resumo", "Clientes", "Financeiro", "Fornecedores"];

// Agrupa window.REPORT_DEFINITIONS por def.group preservando a ordem relativa
// original do array - resultado identico a ordem estatica dos <optgroup> do
// <select> vanilla (conferido item a item), sem precisar duplicar essa lista.
export function ReportTypeSelect({ value, onChange }: { value: string; onChange: (typeId: string) => void }) {
  const definitions = window.REPORT_DEFINITIONS;
  const groups = GROUP_ORDER.map((group) => ({ group, items: definitions.filter((def) => def.group === group) })).filter(
    (group) => group.items.length
  );

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-ink">Tipo de relatório</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-ink"
      >
        {groups.map(({ group, items }) => (
          <optgroup key={group} label={group}>
            {items.map((def) => (
              <option key={def.id} value={def.id}>
                {def.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
