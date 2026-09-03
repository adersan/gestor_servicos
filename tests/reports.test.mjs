import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

function extractBlock(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(start, -1, `Start marker not found: ${startMarker}`);
  assert.notEqual(end, -1, `End marker not found: ${endMarker}`);
  return source.slice(start, end);
}

// Same fixture shape as the real 31/08-03/09/2026 "Cadastro" audit: a client
// entry named "CRV Cadastrado" that generated a linked supplier "Cadastro"
// entry, and one that was delivered without any supplier entry at all.
const period = { startDate: "2026-08-31", endDate: "2026-09-03" };

const clients = [
  { id: "c1", name: "Rodrigo Despachante" },
  { id: "c2", name: "CL Despachante" }
];

const services = [
  { id: "s1", clientId: "c1", date: "2026-08-31", description: "CRV Cadastrado", reference: "PKU8117", status: "Entregue", amount: 300, isSecondary: false, requestedBy: "", billingId: null, createdAt: "2026-08-31T12:00:00Z" },
  { id: "s2", clientId: "c2", date: "2026-09-01", description: "Digitação CRV", reference: "OUP6597", status: "Entregue", amount: 40, isSecondary: false, requestedBy: "", billingId: null, createdAt: "2026-09-01T12:00:00Z" },
  { id: "s3", clientId: "c2", date: "2026-09-05", description: "Fora do período", reference: "ZZZ0000", status: "A fazer", amount: 40, isSecondary: false, requestedBy: "", billingId: null, createdAt: "2026-09-05T12:00:00Z" }
];

const suppliers = [{ id: "sup1", name: "Fornecedor Cadastro" }];

const supplierEntries = [
  { id: "se1", supplierId: "sup1", clientId: "c2", clientServiceEntryId: "s2", date: "2026-09-01", description: "Cadastro", reference: "OUP6597", status: "Entregue", source: "Cliente", amount: 30, payableId: null, createdAt: "2026-09-01T12:00:00Z" }
];

const context = {
  state: { clients, services, suppliers, supplierEntries, billings: [], payments: [], supplierPayables: [] },
  window: { supplierModule: { payableStatus: () => "Aberta", payableOpen: () => 0, payablePaid: () => 0 } },
  money: { format: (value) => `R$ ${Number(value).toFixed(2)}` },
  inPeriod: (date, range) => date >= range.startDate && date <= range.endDate,
  matchesSearch: (search, ...values) => !search || values.join(" ").toLowerCase().includes(String(search).toLowerCase()),
  clientById: (id) => clients.find((client) => client.id === id),
  serviceStatusLabel: (status) => (status === "Pronto" ? "Feito" : status),
  formatDate: (value) => value,
  periodLabel: (range) => `${range.startDate} a ${range.endDate}`,
  billingNumberLabel: () => "",
  billingPaidAmount: () => 0,
  billingOpenAmount: () => 0,
  billingCurrentStatus: () => "Aberta",
  billingStatusLabel: () => "Aberta",
  isBillingOverdue: () => false,
  paymentAllocationState: () => "loose",
  paymentAllocationLabel: () => "",
  previousBalanceFor: () => 0,
  console
};
vm.createContext(context);

const definitionsSource = extractBlock("const REPORT_DEFINITIONS = [", "function activeReportDefinition()")
  .replace("const REPORT_DEFINITIONS", "var REPORT_DEFINITIONS");
vm.runInContext(definitionsSource, context);
const REPORT_DEFINITIONS = context.REPORT_DEFINITIONS;

function defById(id) {
  return REPORT_DEFINITIONS.find((def) => def.id === id);
}

// Regression check mirroring the real audit: a "Digitação CRV" client entry
// with a linked "Cadastro" supplier entry must show up in both reports,
// and the client entry that was delivered with zero supplier entries must
// be flagged as "Sem fornecedor" / excluded from the "with" filter.
{
  const clientEntries = defById("clientEntries");
  const allRows = clientEntries.getRows({ period, clientId: "", status: "", extra: "", search: "" });
  assert.equal(allRows.length, 2, "expects the 2 entries inside the period, excluding the one outside it");

  const withSupplier = clientEntries.getRows({ period, clientId: "", status: "", extra: "with", search: "" });
  assert.deepEqual(withSupplier.map((row) => row.id), ["s2"], "only s2 has a linked supplier entry");

  const withoutSupplier = clientEntries.getRows({ period, clientId: "", status: "", extra: "without", search: "" });
  assert.deepEqual(withoutSupplier.map((row) => row.id), ["s1"], "s1 was delivered without any supplier entry");

  const linkedColumn = clientEntries.columns.find((column) => column.key === "supplierLinked");
  assert.equal(linkedColumn.value(services[0]), "Não");
  assert.equal(linkedColumn.value(services[1]), "Sim");
}

{
  const supplierEntriesDef = defById("supplierEntries");
  const rows = supplierEntriesDef.getRows({ period, supplierId: "", clientId: "", status: "", extra: "", search: "" });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "se1");

  const byOrigin = supplierEntriesDef.getRows({ period, supplierId: "", clientId: "", status: "", extra: "Direto", search: "" });
  assert.equal(byOrigin.length, 0, "the only entry has source=Cliente, not Direto");

  const searched = supplierEntriesDef.getRows({ period, supplierId: "", clientId: "", status: "", extra: "", search: "cadastro" });
  assert.equal(searched.length, 1, "search should match the service description");
}

{
  const periodSummary = defById("periodSummary");
  // periodSummary needs serviceMetrics/financeMetrics; not extracted in this
  // lightweight test (they depend on servicesFor/paymentsAppliedFor helpers
  // defined earlier in app.js) - just assert the definition exists with the
  // right shape so a future regression in the column/getRows contract is caught.
  assert.equal(typeof periodSummary.getRows, "function");
  assert.equal(periodSummary.columns.length, 3);
}

console.log("reports engine test passed");
