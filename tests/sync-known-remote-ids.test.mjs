import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

// Regression test for: launching an entry on one device could get silently
// deleted from the server when another device (with a stale local cache,
// since auto-refresh only runs ~1x/day now) saved afterwards. upsertState()
// reconciles the server to match the full local list, including deleting
// rows missing from it - so a record only the OTHER device knew about used
// to look like "the user deleted this locally" and got wiped.

const dataSource = fs.readFileSync(new URL("../data.js", import.meta.url), "utf8");

function createFakeSupabase() {
  const tables = {};
  function ensureTable(name) {
    if (!tables[name]) tables[name] = new Map();
    return tables[name];
  }

  function selectBuilder(name) {
    const filters = [];
    const builder = {
      eq(col, val) { filters.push([col, val]); return builder; },
      order() { return builder; },
      then(resolve, reject) {
        try {
          let rows = Array.from(ensureTable(name).values()).map((row) => ({ ...row }));
          filters.forEach(([col, val]) => { rows = rows.filter((row) => row[col] === val); });
          resolve({ data: rows, error: null });
        } catch (error) {
          reject(error);
        }
      }
    };
    return builder;
  }

  function deleteBuilder(name) {
    return {
      in(col, ids) {
        const table = ensureTable(name);
        const idSet = new Set(ids);
        for (const row of table.values()) {
          if (idSet.has(row[col])) table.delete(row.id);
        }
        return Promise.resolve({ data: null, error: null });
      },
      eq(col, val) {
        const table = ensureTable(name);
        for (const row of Array.from(table.values())) {
          if (row[col] === val) table.delete(row.id);
        }
        return Promise.resolve({ data: null, error: null });
      }
    };
  }

  function updateBuilder(name, values) {
    return {
      eq(col, val) {
        const table = ensureTable(name);
        for (const row of table.values()) {
          if (row[col] === val) Object.assign(row, values);
        }
        return Promise.resolve({ data: null, error: null });
      }
    };
  }

  const client = {
    auth: {
      async getSession() { return { data: { session: null } }; }
    },
    from(name) {
      return {
        select() { return selectBuilder(name); },
        async upsert(rows) {
          const arr = Array.isArray(rows) ? rows : [rows];
          const table = ensureTable(name);
          arr.forEach((row) => table.set(row.id, { ...row }));
          return { data: arr, error: null };
        },
        delete() { return deleteBuilder(name); },
        update(values) { return updateBuilder(name, values); }
      };
    }
  };

  return { client, tables };
}

function loadDevice(client) {
  const sandbox = {
    window: { supabaseClient: client },
    console,
    structuredClone,
    Promise, Object, Array, Number, Boolean, String, Set, Map, JSON
  };
  vm.createContext(sandbox);
  vm.runInContext(dataSource, sandbox, { filename: "data.js" });
  return sandbox.window.dataStore;
}

function baseState(overrides = {}) {
  return {
    priceTables: [],
    clients: [],
    catalog: [],
    services: [],
    payments: [],
    paymentMethods: [],
    billings: [],
    suppliers: [],
    supplierServices: [],
    supplierEntries: [],
    supplierPayables: [],
    supplierPayments: [],
    clientRequesters: [],
    serviceRequests: [],
    periodSettings: null,
    ...overrides
  };
}

function entry(id, extra = {}) {
  return {
    id,
    clientId: "client-1",
    catalogId: null,
    date: "2026-07-29",
    description: "Servico teste",
    amount: 10,
    status: "A fazer",
    ...extra
  };
}

async function run() {
  const { client, tables } = createFakeSupabase();
  const deviceA = loadDevice(client);
  const deviceB = loadDevice(client);

  // Both devices start from an empty, freshly-fetched server (like opening the app for the first time).
  await deviceA.fetchAll();
  await deviceB.fetchAll();

  // Device A launches an entry ("X") and saves it - this is the entry the user reported.
  await deviceA.upsertState(baseState({ services: [entry("X")] }));
  assert.ok(tables.service_entries.has("X"), "entry X must exist on the server after device A saves it");

  // Device B never refreshed (simulates the ~1x/day auto-refresh gap), so its local
  // list still doesn't know about X. It now launches its own entry ("Y") and saves.
  await deviceB.upsertState(baseState({ services: [entry("Y")] }));

  assert.ok(
    tables.service_entries.has("X"),
    "BUG: device B's save deleted entry X, which it never even knew about - the exact data-loss scenario reported by the user"
  );
  assert.ok(tables.service_entries.has("Y"), "entry Y from device B must also exist");

  // A fresh device (or a manual refresh) must now see both entries.
  const deviceC = loadDevice(client);
  const freshState = await deviceC.fetchAll();
  assert.deepEqual(
    freshState.services.map((item) => item.id).sort(),
    ["X", "Y"],
    "a fresh fetch must see both devices' entries"
  );

  // Genuine local deletions must still propagate: device A refreshes (learns about X and Y),
  // then deletes X locally and saves - X should actually be removed from the server this time.
  const refreshedA = await deviceA.fetchAll();
  assert.deepEqual(refreshedA.services.map((item) => item.id).sort(), ["X", "Y"]);
  const withoutX = { ...refreshedA, services: refreshedA.services.filter((item) => item.id !== "X") };
  await deviceA.upsertState(withoutX);
  assert.ok(!tables.service_entries.has("X"), "a deletion the device actually knows about must still sync");
  assert.ok(tables.service_entries.has("Y"), "unrelated entry Y must survive the deletion of X");

  // Same protection must apply to payments (financial data), not just service entries.
  const { client: client2, tables: tables2 } = createFakeSupabase();
  const paymentDeviceA = loadDevice(client2);
  const paymentDeviceB = loadDevice(client2);
  await paymentDeviceA.fetchAll();
  await paymentDeviceB.fetchAll();
  await paymentDeviceA.upsertState(baseState({
    payments: [{ id: "P1", clientId: "client-1", date: "2026-07-29", amount: 50, method: "PIX" }]
  }));
  await paymentDeviceB.upsertState(baseState({
    payments: [{ id: "P2", clientId: "client-1", date: "2026-07-29", amount: 30, method: "PIX" }]
  }));
  assert.ok(tables2.payments.has("P1"), "BUG: a payment registered on one device must not be wiped by another device saving");
  assert.ok(tables2.payments.has("P2"));

  console.log("sync known-remote-ids safety test passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
