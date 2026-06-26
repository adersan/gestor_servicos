import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

function extractFunction(name, nextName) {
  const start = source.indexOf(`function ${name}`);
  const end = source.indexOf(`function ${nextName}`, start);
  assert.notEqual(start, -1, `Function ${name} was not found`);
  assert.notEqual(end, -1, `Function boundary ${nextName} was not found`);
  return source.slice(start, end);
}

const oldBilling = {
  id: "old",
  clientId: "client",
  startDate: "2026-06-14",
  endDate: "2026-06-19",
  amount: 2830,
  createdAt: "2026-06-19T17:27:28Z",
  status: "Parcial"
};
const newBilling = {
  id: "new",
  clientId: "client",
  startDate: "2026-06-22",
  endDate: "2026-06-27",
  amount: 883,
  previousBalance: 683,
  createdAt: "2026-06-26T16:27:09Z",
  status: "Aberta"
};
const state = { billings: [oldBilling, newBilling] };
const paidByBilling = { old: 2147, new: 0 };

const context = {
  state,
  formatDate: (date) => date,
  billingPaidAmount: (billing) => paidByBilling[billing.id] || 0,
  billingPayments: () => []
};
vm.createContext(context);
vm.runInContext([
  extractFunction("rawBillingOpenAmount", "billingRolloverTarget"),
  extractFunction("billingRolloverTarget", "consolidatePreviousBillings"),
  extractFunction("consolidatePreviousBillings", "releaseRolledBillings"),
  extractFunction("releaseRolledBillings", "normalizeBillingRollovers"),
  extractFunction("billingOpenAmount", "billingCurrentStatus"),
  extractFunction("billingCurrentStatus", "billingStatusLabel")
].join("\n"), context);

const selected = context.consolidatePreviousBillings(newBilling);
assert.deepEqual(selected.map((billing) => billing.id), ["old"]);
assert.equal(context.billingOpenAmount(oldBilling), 0);
assert.equal(context.billingOpenAmount(newBilling), 883);
assert.equal(context.billingCurrentStatus(oldBilling), "Consolidada");
assert.equal(oldBilling.rolledIntoBillingId, "new");
assert.equal(newBilling.rolledBalance, 683);

context.releaseRolledBillings(newBilling);
assert.equal(context.billingOpenAmount(oldBilling), 683);
assert.equal(context.billingCurrentStatus(oldBilling), "Parcial");
assert.equal(oldBilling.rolledIntoBillingId, undefined);

console.log("billing rollover test passed");
