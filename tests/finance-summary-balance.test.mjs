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

// Cenario do pack.md: cliente faz servico, fecha cobranca, paga, e depois
// faz mais servico. balanceFor precisa refletir o saldo real acumulado a
// qualquer momento, sem depender de cobranca fechada.
const state = {
  services: [
    { clientId: "client", date: "2026-06-01", amount: 500, status: "Pronto" },
    { clientId: "client", date: "2026-06-10", amount: 300, status: "Pronto" },
    { clientId: "client", date: "2026-06-11", amount: 1000, status: "Cancelado" }
  ],
  payments: [
    { clientId: "client", date: "2026-06-02", amount: 500 },
    { clientId: "client", date: "2026-06-20", amount: 9999 }
  ]
};

const context = { state };
vm.createContext(context);
vm.runInContext(extractFunction("balanceFor", "availableAdvancePayments"), context);

// So o primeiro servico ainda existe: cliente deve 500.
assert.equal(context.balanceFor("client", "2026-06-01"), 500);

// Pagamento do dia seguinte quita o primeiro servico.
assert.equal(context.balanceFor("client", "2026-06-02"), 0);

// Antes do segundo servico, saldo continua zerado (nao antecipa consumo futuro).
assert.equal(context.balanceFor("client", "2026-06-09"), 0);

// Novo servico depois da cobranca/pagamento aparece no saldo, sem misturar com o ciclo anterior.
assert.equal(context.balanceFor("client", "2026-06-10"), 300);

// Servico cancelado nunca entra no saldo.
assert.equal(context.balanceFor("client", "2026-06-12"), 300);

// Pagamento futuro (depois do endDate consultado) nao pode abater saldo passado.
assert.equal(context.balanceFor("client", "2026-06-15"), 300);

console.log("finance summary balance test passed");
