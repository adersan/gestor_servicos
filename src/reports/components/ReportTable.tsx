import { money } from "@/lib/format";
import type { ReportResults } from "@/reports/data";

// Espelha a tabela de resultado do vanilla (renderReportResults, app.js):
// cabecalho, linhas, e uma linha de totais quando alguma coluna e summable.
export function ReportTable({ results }: { results: ReportResults }) {
  if (!results.rows.length || !results.columns.length) {
    return <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">{results.countLabel || "Nenhum registro por aqui."}</p>;
  }

  const hasTotals = results.totals.some((total) => total !== null);

  return (
    <div className="max-h-[560px] overflow-auto rounded-2xl border border-border bg-surface">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-surface-2">
          <tr>
            {results.columns.map((column) => (
              <th key={column.key} className={`whitespace-nowrap px-3 py-2 text-left font-semibold text-ink ${column.align === "right" ? "text-right" : ""}`}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {results.rows.map((row, index) => (
            <tr key={index}>
              {results.columns.map((column) => (
                <td key={column.key} className={`whitespace-nowrap px-3 py-2 text-ink ${column.align === "right" ? "text-right" : ""}`}>
                  {column.value(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {hasTotals && (
          <tfoot>
            <tr className="border-t border-border bg-surface-2 font-semibold text-ink">
              {results.columns.map((column, index) => (
                <td key={column.key} className={`whitespace-nowrap px-3 py-2 ${column.align === "right" ? "text-right" : ""}`}>
                  {results.totals[index] !== null ? money.format(results.totals[index] as number) : index === 0 ? "Total" : ""}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
