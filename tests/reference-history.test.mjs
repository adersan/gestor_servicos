import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const start = appSource.indexOf("function normalizeServiceReference");
const end = appSource.indexOf("function renderAdditionalServiceList", start);
assert.ok(start >= 0 && end > start, "reference history helpers not found");

const context = {
  state: {
    services: [
      {
        id: "old-billed",
        clientId: "client-a",
        serviceGroupId: "group-a",
        reference: " abc 123 ",
        description: "Digitacao CRV",
        date: "2026-06-18",
        status: "Entregue",
        billingId: "billing-a",
        createdAt: "2026-06-18T10:00:00Z"
      },
      {
        id: "old-cancelled",
        clientId: "client-b",
        serviceGroupId: "group-b",
        reference: "ABC 123",
        description: "Cadastro",
        date: "2026-06-17",
        status: "Cancelado",
        createdAt: "2026-06-17T10:00:00Z"
      },
      {
        id: "editing",
        clientId: "client-a",
        serviceGroupId: "group-edit",
        reference: "XYZ9A99",
        description: "Servico principal",
        date: "2026-06-20",
        status: "A fazer"
      },
      {
        id: "editing-complement",
        clientId: "client-a",
        serviceGroupId: "group-edit",
        reference: "XYZ9A99",
        description: "Complementar",
        date: "2026-06-20",
        status: "A fazer"
      }
    ]
  },
  clientById: (id) => ({ name: id === "client-a" ? "Cliente A" : "Cliente B" }),
  escapeHtml: (value) => String(value),
  formatDate: (date) => date.split("-").reverse().join("/"),
  serviceStatusLabel: (status) => status
};

vm.createContext(context);
vm.runInContext(appSource.slice(start, end), context);

const historical = context.historicalReferenceMatches({
  entryId: "",
  references: ["  abc   123 "]
});
assert.deepEqual(
  historical.map((item) => item.id),
  ["old-billed", "old-cancelled"],
  "must find the reference across clients, billings and statuses"
);

const editingMatches = context.historicalReferenceMatches({
  entryId: "editing",
  references: ["XYZ9A99"]
});
assert.equal(editingMatches.length, 0, "must ignore the complete group being edited");

const markup = context.historicalReferenceDialogMarkup(historical);
assert.match(markup, /Digitacao CRV/);
assert.match(markup, /18\/06\/2026/);
assert.match(markup, /Cliente A/);
assert.match(markup, /Entregue/);

const partialDuplicates = context.historicalReferenceMatches({
  entryId: "",
  references: ["ABC 123", "NEW-REF"]
});
const partialAction = context.resolveReferenceDuplicateAction(
  ["ABC 123", "NEW-REF"],
  partialDuplicates,
  false
);
assert.deepEqual(
  [...partialAction.duplicateReferenceSet],
  ["ABC 123"],
  "must identify only the reference that actually collided"
);
assert.deepEqual(
  partialAction.remainingReferences,
  ["NEW-REF"],
  "must keep the non-duplicated reference for launch"
);
assert.equal(
  partialAction.allowRemoveDuplicates,
  true,
  "must offer 'remove duplicates and continue' when something would still be launched"
);

const allDuplicatesAction = context.resolveReferenceDuplicateAction(
  ["ABC 123"],
  partialDuplicates.filter((item) => normalizeMatch(item.reference) === "ABC 123"),
  false
);
assert.equal(
  allDuplicatesAction.remainingReferences.length,
  0,
  "removing the only reference must leave nothing to launch"
);
assert.equal(
  allDuplicatesAction.allowRemoveDuplicates,
  false,
  "must not offer 'remove duplicates' when it would launch nothing"
);

const editingAction = context.resolveReferenceDuplicateAction(
  ["ABC 123"],
  partialDuplicates.filter((item) => normalizeMatch(item.reference) === "ABC 123"),
  true
);
assert.equal(
  editingAction.allowRemoveDuplicates,
  false,
  "editing an existing entry must never offer 'remove duplicates' (there is only one reference)"
);

function normalizeMatch(reference) {
  return String(reference || "").trim().replace(/\s+/g, " ").toUpperCase();
}

console.log("reference history test passed");
