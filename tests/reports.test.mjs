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
  { id: "s3", clientId: "c2", date: "2026-09-05", description: "Fora do período", reference: "ZZZ0000", status: "A fazer", amount: 40, isSecondary: false, requestedBy: "", billingId: null, createdAt: "2026-09-05T12:00:00Z" },
  { id: "s4", clientId: "c1", date: "2026-09-02", description: "CRV Cadastrado", reference: "OTHER123", status: "Entregue", amount: 300, isSecondary: false, requestedBy: "", billingId: null, createdAt: "2026-09-02T12:00:00Z" }
];

const suppliers = [{ id: "sup1", name: "Fornecedor Cadastro" }];

const supplierEntries = [
  { id: "se1", supplierId: "sup1", clientId: "c2", clientServiceEntryId: "s2", date: "2026-09-01", description: "Cadastro", reference: "OUP6597", status: "Entregue", source: "Cliente", amount: 30, payableId: null, createdAt: "2026-09-01T12:00:00Z" },
  { id: "se2", supplierId: "sup1", clientId: "c1", clientServiceEntryId: "s4", date: "2026-09-02", description: "Cadastro", reference: "OTHER123", status: "Entregue", source: "Cliente", amount: 50, payableId: null, createdAt: "2026-09-02T12:00:00Z" }
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
  assert.equal(allRows.length, 3, "expects the 3 entries inside the period, excluding the one outside it");

  const withSupplier = clientEntries.getRows({ period, clientId: "", status: "", extra: "with", search: "" });
  assert.deepEqual(withSupplier.map((row) => row.id).sort(), ["s2", "s4"], "s2 and s4 have a linked supplier entry");

  const withoutSupplier = clientEntries.getRows({ period, clientId: "", status: "", extra: "without", search: "" });
  assert.deepEqual(withoutSupplier.map((row) => row.id), ["s1"], "s1 was delivered without any supplier entry");

  const linkedColumn = clientEntries.columns.find((column) => column.key === "supplierLinked");
  assert.equal(linkedColumn.value(services[0]), "Não");
  assert.equal(linkedColumn.value(services[1]), "Sim");
}

{
  const supplierEntriesDef = defById("supplierEntries");
  const rows = supplierEntriesDef.getRows({ period, supplierId: "", clientId: "", status: "", extra: "", search: "" });
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => row.id).sort(), ["se1", "se2"]);

  const byOrigin = supplierEntriesDef.getRows({ period, supplierId: "", clientId: "", status: "", extra: "Direto", search: "" });
  assert.equal(byOrigin.length, 0, "both entries have source=Cliente, not Direto");

  const searched = supplierEntriesDef.getRows({ period, supplierId: "", clientId: "", status: "", extra: "", search: "cadastro" });
  assert.equal(searched.length, 2, "search should match the service description on both entries");
}

// Detalhamento por servico (cliente): "CRV Cadastrado" appears twice (s1+s4,
// 300 each = 600 total), "Digitacao CRV" once (40) - the answer to "quantos
// servicos do tipo X fiz e quanto esta dando", the exact question the user
// asked for, computed live without needing to close any cobranca.
{
  const breakdown = defById("clientServiceBreakdown");
  const rows = breakdown.getRows({ period, clientId: "", status: "", extra: "", search: "" });
  const crv = rows.find((row) => row.service === "CRV Cadastrado");
  const digitacao = rows.find((row) => row.service === "Digitação CRV");
  assert.equal(crv.count, 2);
  assert.equal(crv.total, 600);
  assert.equal(digitacao.count, 1);
  assert.equal(digitacao.total, 40);
  assert.equal(rows[0].service, "CRV Cadastrado", "sorted by total desc");
}

// Detalhamento por servico (fornecedor): both supplier entries are named
// "Cadastro" (se1=30, se2=50) - same idea, on the fornecedor side, without
// needing to close a conta a pagar.
{
  const breakdown = defById("supplierServiceBreakdown");
  const rows = breakdown.getRows({ period, supplierId: "", clientId: "", status: "", extra: "", search: "" });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].service, "Cadastro");
  assert.equal(rows[0].count, 2);
  assert.equal(rows[0].total, 80);
}

// Margem por servico: "CRV Cadastrado" cobra 600 do cliente, custa 50 ao
// fornecedor (s1 sem vinculo=0 + s4 vinculado a se2=50) -> margem 550;
// "Digitacao CRV" cobra 40, custa 30 (s2 vinculado a se1) -> margem 10.
{
  const margin = defById("serviceMargin");
  const rows = margin.getRows({ period, clientId: "", status: "", extra: "", search: "" });
  const crv = rows.find((row) => row.service === "CRV Cadastrado");
  const digitacao = rows.find((row) => row.service === "Digitação CRV");
  assert.equal(crv.revenue, 600);
  assert.equal(crv.cost, 50);
  assert.equal(crv.margin, 550);
  assert.equal(digitacao.revenue, 40);
  assert.equal(digitacao.cost, 30);
  assert.equal(digitacao.margin, 10);
  assert.equal(rows[0].service, "CRV Cadastrado", "sorted by margin desc");
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
