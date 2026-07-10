import assert from "node:assert/strict";
import { billingOpenAmount, selectBillingPaymentMethods } from "../netlify/functions/_shared/server.mjs";

// billingOpenAmount: calculationVersion >= 2 counts every payment regardless of timing
const billingV2 = { total_due: 1000, created_at: "2026-06-20T12:00:00Z", snapshot: { calculationVersion: 2 } };
const paymentsV2 = [
  { amount: 300, created_at: "2026-06-15T00:00:00Z" },
  { amount: 200, created_at: "2026-06-25T00:00:00Z" }
];
assert.equal(billingOpenAmount(billingV2, paymentsV2), 500);

// billingOpenAmount: legacy (calculationVersion 1, the default) only counts payments created after the billing
const billingV1 = { total_due: 1000, created_at: "2026-06-20T12:00:00Z", snapshot: {} };
const paymentsV1 = [
  { amount: 300, created_at: "2026-06-15T00:00:00Z" },
  { amount: 200, created_at: "2026-06-25T00:00:00Z" }
];
assert.equal(billingOpenAmount(billingV1, paymentsV1), 800);

// billingOpenAmount: a billing rolled into another always reports zero open balance
const rolledBilling = { total_due: 1000, created_at: "2026-06-20T12:00:00Z", snapshot: { rolledIntoBillingId: "other" } };
assert.equal(billingOpenAmount(rolledBilling, paymentsV2), 0);

// billingOpenAmount: never goes negative when overpaid
const overpaidBilling = { total_due: 100, created_at: "2026-06-20T12:00:00Z", snapshot: { calculationVersion: 2 } };
assert.equal(billingOpenAmount(overpaidBilling, [{ amount: 500, created_at: "2026-06-25T00:00:00Z" }]), 0);

// selectBillingPaymentMethods: snapshot.paymentMethods (frozen at billing time) wins over everything else
const allMethods = [
  { id: "m1", type: "PIX", name: "PIX Principal", details: "chave@pix", payment_link: "" },
  { id: "m2", type: "Boleto", name: "Boleto", details: "", payment_link: "https://pay/boleto" }
];
const billingWithSnapshotMethods = {
  snapshot: { paymentMethods: [{ id: "old-m", type: "PIX", name: "PIX antigo", link: "https://old" }] }
};
assert.deepEqual(selectBillingPaymentMethods(billingWithSnapshotMethods, allMethods), [
  { id: "old-m", type: "PIX", name: "PIX antigo", details: "", payment_link: "https://old" }
]);

// selectBillingPaymentMethods: falls back to paymentMethodIds filtering the active methods list
const billingWithIds = { snapshot: { paymentMethodIds: ["m2"] } };
assert.deepEqual(selectBillingPaymentMethods(billingWithIds, allMethods), [allMethods[1]]);

// selectBillingPaymentMethods: falls back to every active method when neither is present
const billingWithNeither = { snapshot: {} };
assert.deepEqual(selectBillingPaymentMethods(billingWithNeither, allMethods), allMethods);

console.log("billing shared helpers test passed");
