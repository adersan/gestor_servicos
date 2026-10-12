/**
 * Porte fiel de createBillingPdf/pdfText do acompanhamento.js vanilla - PDF
 * montado "na mao" (sem lib), mesmo padrao usado em cliente.js/app.js/supplier.js
 * deste projeto. So trocou sintaxe JS->TS, a abordagem e identica.
 */
import { formatDate, formatMoney, requesterName } from "@/acompanhamento/format";
import type {
  TrackingBillingServiceItem,
  TrackingPayment,
  TrackingPaymentMethod
} from "@/acompanhamento/types";

export interface BillingPdfInput {
  client: { name: string };
  billing: {
    period_start: string;
    period_end: string;
    previous_balance: number;
    services_total: number;
    open_amount?: number;
    total_due: number;
  };
  services: TrackingBillingServiceItem[];
  payments: TrackingPayment[];
  paymentMethods: TrackingPaymentMethod[];
}

function pdfText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

export function createBillingPdf(data: BillingPdfInput): Blob {
  const paymentTotal = (data.payments || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 42;
  const pages: string[] = [];
  let commands: string[] = [];
  let y = 800;

  const color = {
    green: "0.086 0.31 0.263",
    blue: "0.176 0.447 0.769",
    payment: "0.094 0.525 0.294",
    orange: "0.812 0.424 0.071",
    gray: "0.455 0.506 0.49",
    dark: "0.12 0.18 0.16"
  };

  function addPage() {
    if (commands.length) pages.push(commands.join("\n"));
    commands = [];
    y = 800;
    commands.push(`${color.green} rg 0 790 ${pageWidth} 52 re f`);
    commands.push("1 1 1 rg BT /F1 17 Tf 42 812 Td (Gestor de Servicos) Tj ET");
    y = 766;
  }

  function text(value: unknown, x: number, size = 10, selectedColor = color.dark, bold = false) {
    commands.push(`${selectedColor} rg BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${pdfText(value)}) Tj ET`);
  }

  function line() {
    commands.push("0.86 0.86 0.83 RG 42 " + (y - 7) + " m 553 " + (y - 7) + " l S");
  }

  function ensureSpace(height = 28) {
    if (y - height < 44) addPage();
  }

  function heading(value: string) {
    ensureSpace(38);
    y -= 12;
    text(value, margin, 13, color.green, true);
    y -= 12;
    line();
    y -= 18;
  }

  addPage();
  text("Relatório de cobrança", margin, 9, color.gray, true);
  y -= 25;
  text(data.client.name, margin, 22, color.dark, true);
  y -= 19;
  text(`Periodo: ${formatDate(data.billing.period_start)} a ${formatDate(data.billing.period_end)}`, margin, 10, color.gray);
  y -= 34;

  heading("Formas de pagamento");
  if (!data.paymentMethods.length) {
    text("Consulte as formas de pagamento com o responsavel.", margin);
    y -= 24;
  } else {
    data.paymentMethods.forEach((method) => {
      ensureSpace(44);
      text(`${method.name} (${method.type})`, margin, 10, color.green, true);
      y -= 15;
      text(method.details || method.payment_link || "-", margin, 9, color.dark);
      y -= 24;
    });
  }

  const cards: Array<[string, number, string]> = [
    ["Saldo anterior", Number(data.billing.previous_balance), color.gray],
    ["Servicos", Number(data.billing.services_total), color.blue],
    ["Pagamentos", paymentTotal, color.payment],
    ["Total em aberto", Number(data.billing.open_amount ?? data.billing.total_due), color.orange]
  ];
  cards.forEach(([label, amount, selectedColor], index) => {
    const x = margin + index * 128;
    commands.push(`${selectedColor} rg ${x} ${y - 36} 116 58 re f`);
    commands.push(`1 1 1 rg BT /F1 8 Tf ${x + 9} ${y + 5} Td (${pdfText(label)}) Tj ET`);
    commands.push(`1 1 1 rg BT /F2 12 Tf ${x + 9} ${y - 17} Td (${pdfText(formatMoney(amount))}) Tj ET`);
  });
  y -= 72;

  heading("Serviços do período");
  if (!data.services.length) {
    text("Nenhum serviço neste fechamento.", margin);
    y -= 22;
  } else {
    const columnWidth = 510;
    ensureSpace(28);
    commands.push(`0.91 0.94 0.93 rg ${margin} ${y - 15} ${columnWidth} 22 re f`);
    commands.push(`${color.dark} rg BT /F2 7 Tf ${margin + 6} ${y - 2} Td (Data) Tj ET`);
    commands.push(`${color.dark} rg BT /F2 7 Tf ${margin + 70} ${y - 2} Td (Servico) Tj ET`);
    commands.push(`${color.dark} rg BT /F2 7 Tf ${margin + 360} ${y - 2} Td (Referencia) Tj ET`);
    commands.push(`${color.dark} rg BT /F2 7 Tf ${margin + 455} ${y - 2} Td (Valor) Tj ET`);
    y -= 27;
    for (const item of data.services) {
      const description = String(item.service_name || "").slice(0, 55);
      const reference = String(item.reference || "-");
      const referenceLines = reference.match(/.{1,18}/g) || ["-"];
      const rowHeight = 27 + Math.max(0, referenceLines.length - 1) * 12;
      ensureSpace(rowHeight);
      const rowY = y;
      commands.push(`0.97 0.98 0.97 rg ${margin} ${rowY - rowHeight + 11} ${columnWidth} ${rowHeight - 4} re f`);
      commands.push(`${color.gray} rg BT /F1 7.5 Tf ${margin + 5} ${rowY - 3} Td (${pdfText(formatDate(item.service_date))}) Tj ET`);
      commands.push(`${color.dark} rg BT /F1 8.5 Tf ${margin + 70} ${rowY - 3} Td (${pdfText(description)}) Tj ET`);
      referenceLines.forEach((lineText, index) =>
        commands.push(`${color.gray} rg BT /F2 8 Tf ${margin + 360} ${rowY - 3 - index * 12} Td (${pdfText(lineText)}) Tj ET`)
      );
      commands.push(`${color.blue} rg BT /F2 8 Tf ${margin + 447} ${rowY - 3} Td (${pdfText(formatMoney(Number(item.amount)))}) Tj ET`);
      y -= rowHeight;
    }
  }

  heading("Pagamentos");
  if (!data.payments.length) {
    text("Nenhum pagamento registrado.", margin);
    y -= 22;
  } else {
    data.payments.forEach((item) => {
      ensureSpace(32);
      text(formatDate(item.payment_date), margin, 9, color.gray);
      text(item.method || item.notes || "-", 145, 9, color.dark);
      text(formatMoney(Number(item.amount)), 462, 9, color.payment, true);
      y -= 17;
      line();
      y -= 8;
    });
  }

  pages.push(commands.join("\n"));

  const objects: string[] = [];
  const pageObjectNumbers = pages.map((_, index) => 5 + index * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageObjectNumbers.map((number) => `${number} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  objects[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

  pages.forEach((content, index) => {
    const pageNumber = pageObjectNumbers[index];
    const contentNumber = pageNumber + 1;
    objects[pageNumber] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentNumber} 0 R >>`;
    objects[contentNumber] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = pdf.length;
    pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let index = 1; index < objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

export function openBillingPdf(input: BillingPdfInput): void {
  const blob = createBillingPdf(input);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("aria-label", "Abrir relatório de cobrança em PDF");
  link.target = "_blank";
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function billingRequesterSummary(
  groups: Array<{ primary: TrackingBillingServiceItem; secondaries: TrackingBillingServiceItem[] }>
) {
  const map = new Map<string, { requester: string; count: number; total: number; services: Map<string, { name: string; count: number; total: number }> }>();
  groups.forEach(({ primary, secondaries }) => {
    const requester = requesterName(primary);
    if (!map.has(requester)) map.set(requester, { requester, count: 0, total: 0, services: new Map() });
    const entry = map.get(requester)!;
    const amount = [primary, ...secondaries].reduce((sum, service) => sum + Number(service.amount), 0);
    entry.count += 1;
    entry.total += amount;
    const service = entry.services.get(primary.service_name) || { name: primary.service_name, count: 0, total: 0 };
    service.count += 1;
    service.total += amount;
    entry.services.set(primary.service_name, service);
  });
  return [...map.values()]
    .map((entry) => ({ ...entry, services: [...entry.services.values()] }))
    .sort((a, b) => b.total - a.total || a.requester.localeCompare(b.requester, "pt-BR"));
}
