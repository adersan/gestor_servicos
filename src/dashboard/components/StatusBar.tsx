export interface StatusSegment {
  key: string;
  label: string;
  count: number;
  colorClass: string;
}

// Barra empilhada simples (sem lib de graficos) - substitui o donut
// conic-gradient do vanilla por algo mais legivel em telas pequenas.
export function StatusBar({ title, total, segments }: { title: string; total: number; segments: StatusSegment[] }) {
  const totalForRatio = total || 1;
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-brand-ink">{title}</h3>
        <span className="text-xs text-muted">{total} no total</span>
      </div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-2">
        {segments.map((segment) => (
          <div
            key={segment.key}
            className={`${segment.colorClass} transition-all duration-500 ease-out`}
            style={{ width: `${(segment.count / totalForRatio) * 100}%` }}
            title={`${segment.label}: ${segment.count}`}
          />
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-4">
        {segments.map((segment) => (
          <div key={segment.key} className="flex items-center gap-1.5 text-xs text-muted">
            <span className={`h-2.5 w-2.5 rounded-full ${segment.colorClass}`} />
            {segment.label} <strong className="text-ink">{segment.count}</strong>
            <span className="text-muted">({Math.round((segment.count / totalForRatio) * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}
