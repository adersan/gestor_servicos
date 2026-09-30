import type { SupplierEntry } from "@/types/global";

// Espelha o handler de "supplierEntryBulkActions" (supplier.js) - usa
// applySupplierEntryStatus/supplierEntryBulkStatusEligible expostos em
// window.supplierModule, extraidos do vanilla pra nao duplicar a regra de
// negocio (ver supplier.js, refactor associado a Fase 10).
export function SupplierEntryBulkActionsBar({
  selectedIds,
  entries,
  onClear
}: {
  selectedIds: Set<string>;
  entries: SupplierEntry[];
  onClear: () => void;
}) {
  const selected = entries.filter((entry) => selectedIds.has(entry.id));
  if (!selected.length) return null;

  const { SUPPLIER_ENTRY_STATUS_NEXT_TARGETS, SUPPLIER_ENTRY_BULK_STATUS_LABELS, supplierEntryBulkStatusEligible, applySupplierEntryStatus } =
    window.supplierModule;

  const availableTargets = new Set<string>();
  selected.forEach((entry) => {
    (SUPPLIER_ENTRY_STATUS_NEXT_TARGETS[entry.status] || []).forEach((target) => availableTargets.add(target));
  });

  const applyTarget = async (targetStatus: string) => {
    const eligible = selected.filter((entry) => supplierEntryBulkStatusEligible(entry, targetStatus));
    if (!eligible.length) return;
    const confirmed = await window.showAppConfirm(`Aplicar "${targetStatus}" a ${eligible.length} lançamento(s) selecionado(s)?`);
    if (!confirmed) return;
    const changedAt = new Date().toISOString();
    eligible.forEach((entry) => applySupplierEntryStatus(entry, targetStatus, changedAt));
    const skipped = selected.length - eligible.length;
    onClear();
    window.saveState();
    window.showAppAlert(
      `${eligible.length} lançamento(s) atualizado(s).${skipped ? ` ${skipped} ignorado(s) por status incompatível ou já em conta a pagar.` : ""}`,
      { type: "success" }
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-3">
      <span className="text-sm font-semibold text-ink">{selected.length} selecionado(s)</span>
      <div className="flex flex-wrap gap-2">
        {[...availableTargets].map((target) => (
          <button
            key={target}
            type="button"
            onClick={() => applyTarget(target)}
            className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600"
          >
            {SUPPLIER_ENTRY_BULK_STATUS_LABELS[target]}
          </button>
        ))}
        <button type="button" onClick={onClear} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink">
          Cancelar seleção
        </button>
      </div>
    </div>
  );
}
