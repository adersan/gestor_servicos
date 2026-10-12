/**
 * Equivalentes das funcoes de formatacao do acompanhamento.js vanilla.
 * amountText/searchableText perdem o acesso a variavel global trackingData -
 * aqui recebem o que precisam por parametro.
 */

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const SIMPLE_STATUS_INITIALS: Record<string, string> = {
  pending: "AF",
  done: "F",
  delivered: "E",
  cancelled: "C"
};

export function formatDate(value?: string | null): string {
  return value ? value.split("-").reverse().join("/") : "-";
}

export function formatServiceDay(value?: string | null): string {
  const parts = String(value || "").split("-");
  return parts.length === 3 ? parts[2] : "-";
}

export function formatDateTime(value?: string | null): string {
  return value ? new Date(value).toLocaleString("pt-BR") : "";
}

export function formatMoney(value: number | string | null | undefined): string {
  return money.format(Number(value || 0));
}

export function amountText(value: number | string | null | undefined, showAmounts: boolean): string {
  return showAmounts === false ? "Valor sob consulta" : formatMoney(value);
}

export interface StatusInfo {
  label: string;
  className: "done" | "delivered" | "cancelled" | "pending";
}

export function statusData(status: string): StatusInfo {
  if (status === "Pronto") return { label: "Feito", className: "done" };
  if (status === "Entregue") return { label: "Entregue", className: "delivered" };
  if (status === "Cancelado") return { label: "Cancelado", className: "cancelled" };
  return { label: "A fazer", className: "pending" };
}

export function searchableText(...values: Array<string | null | undefined>): string {
  return values
    .join(" ")
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toLowerCase();
}

export function requesterName(item: { requested_by?: string | null } | null | undefined): string {
  return String(item?.requested_by || "").trim() || "Sem solicitante";
}
