import { formatDate } from "@/acompanhamento/format";
import type { TrackingServiceRequestHistoryItem } from "@/acompanhamento/types";

export function RequestHistory({ requests }: { requests: TrackingServiceRequestHistoryItem[] }) {
  if (!requests.length) {
    return <p className="text-sm text-muted">Nenhum pedido enviado por este link.</p>;
  }

  return (
    <div className="grid gap-2">
      {requests.slice(0, 8).map((item) => (
        <article key={item.id} className="rounded-xl border border-line bg-surface p-3">
          <div className="flex items-center justify-between gap-2">
            <strong className="text-sm text-ink">{item.service_name}</strong>
            <span className="text-xs text-muted">
              {formatDate(item.requested_date)} · {item.status}
            </span>
          </div>
          {item.references.length > 0 && (
            <p className="mt-2 flex flex-wrap gap-1.5">
              {item.references.map((reference) => (
                <span key={reference} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-ink">
                  {reference}
                </span>
              ))}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
