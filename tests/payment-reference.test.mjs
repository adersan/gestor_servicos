import assert from "node:assert/strict";
import { parsePaymentReference } from "../netlify/functions/_shared/server.mjs";

assert.deepEqual(
  parsePaymentReference("advance:client-123"),
  { type: "advance", clientId: "client-123" },
  "must parse an advance payment reference"
);

assert.deepEqual(
  parsePaymentReference("billing-abc-456"),
  { type: "billing", billingId: "billing-abc-456" },
  "a bare reference must be treated as a billing id"
);

assert.equal(parsePaymentReference(""), null, "empty reference must return null");
assert.equal(parsePaymentReference(null), null, "missing reference must return null");
assert.equal(parsePaymentReference("advance:"), null, "advance reference without a client id must return null");
assert.deepEqual(
  parsePaymentReference("  advance:client-9  "),
  { type: "advance", clientId: "client-9" },
  "must trim surrounding whitespace before parsing an advance reference"
);
assert.deepEqual(
  parsePaymentReference("  billing-9  "),
  { type: "billing", billingId: "billing-9" },
  "must trim a bare billing reference"
);

console.log("payment reference test passed");
