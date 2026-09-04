import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");

function extractSnippet(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(start, -1, `Marker not found: ${startMarker}`);
  assert.notEqual(end, -1, `Marker not found: ${endMarker}`);
  return source.slice(start, end).replace(/\basync\s*$/, "");
}

// Testa a logica de polling isoladamente em Node puro (sem navegador) - o teste via
// Playwright pra esse fluxo esbarra numa particularidade do Chromium/Playwright deste
// ambiente que deixa de interceptar um fetch feito de dentro de um setTimeout de ~3s
// (reproduzido e confirmado isoladamente); aqui o setTimeout e substituido por uma
// chamada imediata, testando a MESMA logica sem depender de tempo real decorrido.
async function runPollTest(fetchImpl) {
  const context = {
    console,
    encodeURIComponent,
    setTimeout: (fn) => fn(),
    fetch: fetchImpl
  };
  vm.createContext(context);
  vm.runInContext(
    extractSnippet("const EXTRAS_HANDWRITING_POLL_INTERVAL_MS", "// Experimental: gera um texto novo"),
    context
  );
  return context.extrasPollHandwritingJob("job-1", "token-1");
}

// Sucesso apos duas tentativas (pending -> done)
{
  let calls = 0;
  const result = await runPollTest(async () => {
    calls++;
    const body = calls === 1 ? { status: "pending" } : { status: "done", imageBase64: "AAAA" };
    return { ok: true, json: async () => body };
  });
  assert.equal(result, "AAAA", "deve devolver o imageBase64 assim que o status vira done");
  assert.equal(calls, 2, "deve continuar tentando enquanto o status for pending");
}

// Erro reportado pelo job (ex.: falha na OpenAI)
{
  let threw = null;
  try {
    await runPollTest(async () => ({ ok: true, json: async () => ({ status: "error", errorMessage: "Falhou de verdade" }) }));
  } catch (error) {
    threw = error;
  }
  assert.equal(threw?.message, "Falhou de verdade", "deve propagar a mensagem de erro do job");
}

// Resposta HTTP nao-ok (ex.: sessao expirada)
{
  let threw = null;
  try {
    await runPollTest(async () => ({ ok: false, json: async () => ({ error: "Sem autorização" }) }));
  } catch (error) {
    threw = error;
  }
  assert.equal(threw?.message, "Sem autorização", "deve propagar o erro HTTP retornado pela function");
}

console.log("extras handwriting poll test passed");
