export function ServiceBulkActionsBar({
  selectedIds,
  onClear
}: {
  selectedIds: Set<string>;
  onClear: () => void;
}) {
  const selectedPrimaries = [...selectedIds]
    .map((id) => window.serviceGroupsById.get(id)?.primary)
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (!selectedPrimaries.length) return null;

  const availableTargets = new Set<string>();
  selectedPrimaries.forEach((primary) => {
    (window.SERVICE_STATUS_NEXT_TARGETS[primary.status] || []).forEach((target) => availableTargets.add(target));
  });

  // Replica renderServiceBulkActionsBar() (app.js:1909-1929) - aplica via loop
  // de applyServiceStatus + saveState, mesma funcao real, zero regra nova.
  // Ver plano, Fase 7.
  const applyTarget = async (targetStatus: string) => {
    const eligible = selectedPrimaries.filter((primary) =>
      (window.SERVICE_STATUS_NEXT_TARGETS[primary.status] || []).includes(targetStatus));
    if (!eligible.length) return;
    const confirmed = await window.showAppConfirm(
      `Aplicar "${window.serviceStatusLabel(targetStatus)}" a ${eligible.length} lançamento(s) selecionado(s)?`
    );
    if (!confirmed) return;
    const changedAt = new Date().toISOString();
    eligible.forEach((primary) => window.applyServiceStatus(primary, targetStatus, changedAt));
    const skipped = selectedPrimaries.length - eligible.length;
    onClear();
    window.saveState();
    window.showAppAlert(
      `${eligible.length} lançamento(s) atualizado(s).${skipped ? ` ${skipped} ignorado(s) por status incompatível.` : ""}`,
      { type: "success" }
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-3">
      <span className="text-sm font-semibold text-ink">{selectedPrimaries.length} selecionado(s)</span>
      <div className="flex flex-wrap gap-2">
        {[...availableTargets].map((target) => (
          <button
            key={target}
            type="button"
            onClick={() => applyTarget(target)}
            className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-600"
          >
            {window.SERVICE_BULK_STATUS_LABELS[target]}
          </button>
        ))}
        <button type="button" onClick={onClear} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-ink">
          Cancelar seleção
        </button>
      </div>
    </div>
  );
}
