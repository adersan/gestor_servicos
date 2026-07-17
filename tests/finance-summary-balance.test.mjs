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

// Cenario do correcao.md: "Cobranca anterior" do Resumo por cliente precisa separar o
// saldo que veio de ANTES do periodo do consumo/pagamento DENTRO do periodo, sem deixar
// um pagamento de divida antiga mascarar o saldo do periodo atual (bug relatado pelo usuario).
const summaryState = {
  billings: [
    { id: "A1", clientId: "A", endDate: "2026-06-14", amount: 3580, calculationVersion: 2, status: "Aberta" },
    { id: "B1", clientId: "B", endDate: "2026-06-14", amount: 3000, calculationVersion: 2, status: "Aberta" },
    { id: "C1", clientId: "C", endDate: "2026-06-10", amount: 3000, calculationVersion: 2, status: "Aberta" },
    { id: "D1", clientId: "D", endDate: "2026-06-01", amount: 5000, calculationVersion: 2, status: "Cancelada" }
  ],
  payments: [
    { clientId: "A", billingId: "A1", date: "2026-06-16", amount: 3580 },
    { clientId: "B", billingId: "B1", date: "2026-06-16", amount: 1500 },
    { clientId: "C", billingId: "C1", date: "2026-06-12", amount: 3000 }
  ]
};
const summaryContext = { state: summaryState };
vm.createContext(summaryContext);
vm.runInContext([
  extractFunction("billingPaidAmount", "billingPayments"),
  extractFunction("rawBillingOpenAmount", "billingRolloverTarget"),
  extractFunction("billingOpenAmount", "billingCurrentStatus"),
  extractFunction("billingCurrentStatus", "billingStatusLabel"),
  extractFunction("previousBalanceFor", "renderFinanceSummary")
].join("\n"), summaryContext);

// A: cobranca de 3580 quitada por um pagamento DENTRO do periodo -> cobranca anterior
// mostra os 3580 (nao soma zero so porque ja foi paga), e o pagamento aparece separado
// em "pagamentos do periodo" pelo proprio renderFinanceSummary.
assert.equal(summaryContext.previousBalanceFor("A", "2026-06-15"), 3580);

// B: cobranca de 3000 com baixa parcial de 1500 dentro do periodo -> cobranca anterior
// continua mostrando o valor cheio (1500 em aberto + 1500 pago no periodo = 3000).
assert.equal(summaryContext.previousBalanceFor("B", "2026-06-15"), 3000);

// C: cobranca de 3000 quitada ANTES do periodo comecar -> nao entra mais como cobranca
// anterior (0), o pagamento tambem nao aparece nos pagamentos do periodo.
assert.equal(summaryContext.previousBalanceFor("C", "2026-06-15"), 0);

// D: cobranca cancelada nunca conta como saldo anterior.
assert.equal(summaryContext.previousBalanceFor("D", "2026-06-15"), 0);

console.log("finance summary balance test passed");
