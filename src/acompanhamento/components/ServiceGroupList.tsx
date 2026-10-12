import { complementNamesLabel, originCancelledNote, type ServiceGroup } from "@/acompanhamento/grouping";
import { amountText, formatDate, formatDateTime, formatServiceDay, requesterName, SIMPLE_STATUS_INITIALS, statusData } from "@/acompanhamento/format";
import type { TrackingServiceItem } from "@/acompanhamento/types";

const STATUS_BADGE_CLASS: Record<string, string> = {
  pending: "bg-[#fff7eb] text-[var(--orange)]",
  done: "bg-[#eef6ff] text-[var(--blue)]",
  delivered: "bg-[#edf9f2] text-[var(--green)]",
  cancelled: "bg-[#fdecea] text-danger"
};

export function StatusBadge({ status }: { status: string }) {
  const info = statusData(status);
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_BADGE_CLASS[info.className]}`}>
      {info.label}
    </span>
  );
}

function ServiceCard({
  group,
  showAmounts
}: {
  group: ServiceGroup<TrackingServiceItem>;
  showAmounts: boolean;
}) {
  const { primary: item, secondaries } = group;
  const total = [item, ...secondaries].reduce((sum, service) => sum + Number(service.amount), 0);
  const note = originCancelledNote(item);

  return (
    <article className="flex items-start justify-between gap-4 rounded-xl border border-line bg-surface p-4">
      <time className="w-14 shrink-0 text-xs text-muted">{formatDate(item.service_date)}</time>
      <div className="min-w-0 flex-1">
        <h4 className="text-sm font-semibold text-ink">
          {item.service_name}
          {secondaries.length > 0 && (
            <span className="ml-2 text-xs font-normal text-muted">+ {complementNamesLabel(secondaries)}</span>
          )}
        </h4>
        {secondaries.length > 0 ? (
          <div className="mt-1 grid gap-0.5 text-xs text-muted">
            {secondaries.map((secondary) => (
              <span key={secondary.id}>
                {secondary.service_name} · {amountText(secondary.amount, showAmounts)}
                {originCancelledNote(secondary, item) && (
                  <em className="ml-1 text-[var(--orange)]">{originCancelledNote(secondary, item)}</em>
                )}
              </span>
            ))}
          </div>
        ) : (
          note && <em className="mt-1 block text-xs text-[var(--orange)]">{note}</em>
        )}
        <span className="mt-1 block text-xs text-muted">Solicitante: {requesterName(item)}</span>
        <p className="mt-1 text-xs text-ink">{item.reference || "Sem referência"}</p>
        {item.status === "Entregue" && item.delivered_at && (
          <p className="mt-1 text-xs text-muted">Entregue em {formatDateTime(item.delivered_at)}</p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <strong className="block text-sm text-ink">{amountText(total, showAmounts)}</strong>
        <span className="mt-1 inline-block">
          <StatusBadge status={item.status} />
        </span>
      </div>
    </article>
  );
}

function ServiceSimpleRow({ group, showAmounts }: { group: ServiceGroup<TrackingServiceItem>; showAmounts: boolean }) {
  const { primary: item, secondaries } = group;
  const status = statusData(item.status);
  const statusInitial = SIMPLE_STATUS_INITIALS[status.className] || status.label;
  const total = [item, ...secondaries].reduce((sum, service) => sum + Number(service.amount), 0);
  const fullServiceLabel = `${item.service_name}${secondaries.length ? ` + ${complementNamesLabel(secondaries)}` : ""}`;
  const compactServiceLabel = `${item.service_name}${secondaries.length ? ` +${secondaries.length}` : ""}`;

  return (
    <tr className="border-b border-line last:border-0">
      <td className="py-2 pr-2 text-xs text-muted">
        <span className="hidden sm:inline">{formatDate(item.service_date)}</span>
        <span className="sm:hidden">{formatServiceDay(item.service_date)}</span>
      </td>
      <td className="py-2 pr-2 text-xs font-semibold text-ink">{item.reference || "Sem referência"}</td>
      <td className="max-w-[160px] truncate py-2 pr-2 text-xs text-ink">
        <span className="hidden sm:inline">{fullServiceLabel}</span>
        <span className="sm:hidden">{compactServiceLabel}</span>
      </td>
      <td className="py-2 pr-2">
        <span className="hidden sm:inline">
          <StatusBadge status={item.status} />
        </span>
        <span className="text-xs font-semibold text-ink sm:hidden">{statusInitial}</span>
      </td>
      <td className="py-2 text-right text-xs font-semibold text-ink">{amountText(total, showAmounts)}</td>
    </tr>
  );
}

export function ServiceGroupList({
  groups,
  mode,
  emptyMessage,
  showAmounts
}: {
  groups: ServiceGroup<TrackingServiceItem>[];
  mode: "simple" | "full";
  emptyMessage: string;
  showAmounts: boolean;
}) {
  if (!groups.length) {
    return <p className="text-sm text-muted">{emptyMessage}</p>;
  }

  if (mode !== "simple") {
    return (
      <div className="grid gap-2">
        {groups.map((group) => (
          <ServiceCard key={group.primary.id} group={group} showAmounts={showAmounts} />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-line text-xs text-muted">
            <th className="py-2 pr-2 font-semibold">Data</th>
            <th className="py-2 pr-2 font-semibold">Referência</th>
            <th className="py-2 pr-2 font-semibold">Serviço</th>
            <th className="py-2 pr-2 font-semibold">Status</th>
            <th className="py-2 text-right font-semibold">Valor</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <ServiceSimpleRow key={group.primary.id} group={group} showAmounts={showAmounts} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { ServiceCard };
