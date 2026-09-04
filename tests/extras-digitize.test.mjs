import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

function extractFunction(name, nextName) {
  const start = source.indexOf(`function ${name}`);
  const end = source.indexOf(`function ${nextName}`, start);
  assert.notEqual(start, -1, `Function ${name} was not found`);
  assert.notEqual(end, -1, `Function boundary ${nextName} was not found`);
  return source.slice(start, end).replace(/\basync\s*$/, "");
}

const context = { console };
vm.createContext(context);
vm.runInContext(extractFunction("extrasOtsuThreshold", "extrasDigitizeSignatureCanvas"), context);

// Histograma bimodal: um monte de pixels bem claros (papel, ~240) e um monte bem
// escuros (tinta, ~20) - o limiar escolhido deve cair entre os dois grupos, nunca
// dentro de um deles (senao a "tinta" ou o "papel" inteiro vira o outro por engano).
{
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < 50; i++) histogram[20]++; // tinta
  for (let i = 0; i < 200; i++) histogram[240]++; // papel
  const totalPixels = 50 + 200;
  const threshold = context.extrasOtsuThreshold(histogram, totalPixels);
  assert.ok(threshold > 20 && threshold < 240, `threshold ${threshold} deveria ficar entre os dois grupos`);
}

// Imagem toda uniforme (sem tinta nenhuma) nao deve travar/derrubar a funcao.
{
  const histogram = new Array(256).fill(0);
  histogram[200] = 100;
  const threshold = context.extrasOtsuThreshold(histogram, 100);
  assert.ok(Number.isFinite(threshold), "threshold deve ser um numero finito mesmo sem variancia");
}

console.log("extras digitize test passed");
